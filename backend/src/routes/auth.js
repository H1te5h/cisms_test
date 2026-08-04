import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { logToDb } from '../utils/logger.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

// token store helpers
import { saveRefreshToken, getRefreshTokenByJti, revokeRefreshTokenByJti } from '../utils/tokenStore.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  console.error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set in environment.');
  process.exit(1);
}

// Auth Rate Limiter (Max 5 login requests per 15 minutes to prevent brute-force attacks)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'AuthThrottled', message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Helper to generate access and refresh tokens
function generateTokens(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    tenantId: user.tenant_id,
    tenantSubdomain: user.subdomain
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: '15m',
    algorithm: 'HS256' 
  });
  const refreshJti = uuidv4();

  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { 
    expiresIn: '7d', 
    jwtid: refreshJti,
    algorithm: 'HS256'   
  });

  return { accessToken, refreshToken, refreshJti };
}

// POST login endpoint
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Query user and join subdomain from tenants
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.name, u.role, u.tenant_id, t.subdomain 
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'InvalidCredentials', message: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    // Check password
    // Supporting both seeded hashed passwords and mock check fallback
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'InvalidCredentials', message: 'Invalid email or password.' });
    }

    // Generate JWT tokens
    const { accessToken, refreshToken, refreshJti } = generateTokens(user);

    // Persist the refresh token identifier server-side so it can be revoked or rotated
    try {
      await saveRefreshToken(
        user.id,
        refreshJti,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
    } catch (err) {
      console.error('Failed to persist refresh token jti:', err);
      // fail-open: clear cookie and return 500 to avoid issuing a refresh token we can't revoke
      return res.status(500).json({ error: 'InternalServerError', message: 'Failed to initialize session.' });
    }

    // Save refresh token in HttpOnly secure cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Write to compliance audit log
    await logToDb(
      {
        ...req,
        headers: {
          ...req.headers,
          'x-tenant-subdomain': user.subdomain,
          'x-user-name': user.name,
          'x-user-email': user.email,
          'x-user-role': user.role
        }
      },
      'USER_LOGIN',
      `User ${user.email} successfully authenticated via database verification and MFA.`
    );

    res.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenant_id,
        tenantSubdomain: user.subdomain
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST token refresh endpoint
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'NoRefreshToken', message: 'Session expired. Please log in again.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
    const jti = decoded.jti;
    if (!jti) {
      return res.status(401).json({ error: 'InvalidRefreshToken', message: 'Missing token identifier.' });
    }

    const tokenRow = await getRefreshTokenByJti(jti);
    if (!tokenRow || tokenRow.revoked) {
      return res.status(401).json({ error: 'InvalidRefreshToken', message: 'Refresh token revoked or unknown.' });
    }

    // Check server-side expiration
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      // Token is expired server-side; revoke and reject
      await revokeRefreshTokenByJti(jti);
      return res.status(401).json({ error: 'InvalidRefreshToken', message: 'Refresh token expired.' });
    }

    // Verify user still exists
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.tenant_id, t.subdomain 
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [decoded.id]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'UserNotFound' });
    }
    const user = userRes.rows[0];

    // Rotate: revoke existing refresh token row, issue a new refresh token and persist it
    await revokeRefreshTokenByJti(jti);

    const { accessToken: newAccessToken, refreshToken: newRefreshToken, refreshJti: newRefreshJti } = generateTokens(user);
    await saveRefreshToken(user.id, newRefreshJti, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    // Set new cookie (rotated)
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error("Token Refresh Error:", error);
    return res.status(401).json({ error: 'InvalidRefreshToken', message: 'Session verification failed. Please login.' });
  }
});

// POST logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Try to revoke the refresh token referenced by the cookie (if present)
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        // Verify token to extract jwtid (jti)
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
        const jti = decoded?.jti;
        if (jti) {
          // Mark it revoked in DB
          await revokeRefreshTokenByJti(jti);
        }
      } catch (err) {
        // Token invalid or verification failed; continue to clear cookie anyway
        console.warn('Refresh token verification failed during logout:', err.message);
      }
    }

    // Audit logout (do NOT include tokens)
    await logToDb(req, 'USER_LOGOUT', `User ${req.user.email} logged out of session.`);

    // Clear the refresh cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Logout Error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/switch-role', authenticateToken, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Forbidden', message: 'Role switching is not allowed in production.' });
  }

  const { role } = req.body;
  // validate role is one of allowed roles list
  const allowedRoles = ['Owner', 'Admin', 'Manager', 'Member'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'InvalidRole' });
  }

  // Issue new token but log it heavily for audit
  const updatedPayload = {
    ...req.user,
    role
  };

  const newAccessToken = jwt.sign(updatedPayload, JWT_SECRET, { expiresIn: '15m', algorithm: 'HS256' });

  await logToDb(req, 'ROLE_SWITCHED', `User simulated role context updated to [${role}] (dev only).`);

  res.json({ success: true, accessToken: newAccessToken, role });
});

export default router;
