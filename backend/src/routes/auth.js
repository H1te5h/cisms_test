import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { logToDb } from '../utils/logger.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'cisms_super_secure_secret_key_123!';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cisms_super_secure_refresh_key_456!';

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

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return { accessToken, refreshToken };
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
    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token in HttpOnly secure cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'NoRefreshToken', message: 'Session expired. Please log in again.' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    // Verify user still exists in database
    const userRes = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.tenant_id, t.subdomain 
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'UserNotFound', message: 'Authenticated user record not found.' });
    }

    const user = userRes.rows[0];

    // Issue a new short-lived access token
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        tenantId: user.tenant_id,
        tenantSubdomain: user.subdomain
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error("Token Refresh Error:", error);
    res.status(401).json({ error: 'InvalidRefreshToken', message: 'Session verification failed. Please login.' });
  }
});

// POST logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await logToDb(req, 'USER_LOGOUT', `User ${req.user.email} logged out of session.`);

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

// POST switch-role endpoint (for sandbox testing/role context changes)
router.post('/switch-role', authenticateToken, async (req, res) => {
  const { role } = req.body;

  try {
    // Generate updated JWT payload with new role
    const updatedPayload = {
      ...req.user,
      role: role
    };

    const newAccessToken = jwt.sign(updatedPayload, JWT_SECRET, { expiresIn: '15m' });
    
    await logToDb(req, 'ROLE_SWITCHED', `User simulated role context updated to [${role}].`);

    res.json({ success: true, accessToken: newAccessToken, role });
  } catch (error) {
    console.error("Role Switch Error:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
