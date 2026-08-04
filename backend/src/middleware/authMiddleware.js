import jwt from 'jsonwebtoken';

// Middleware to verify JWT Access Token
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'NoAuthenticationToken', message: 'Authentication token is missing. Access denied.' });
  }
const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('FATAL: JWT_SECRET missing in auth middleware');
    return res.status(500).json({error: 'ServerMisconfiguration'});
  }
  try {
    const decoded = jwt.verify(token,secret, { algorithms: ['HS256'] });
    req.user = decoded; // Attach user info (id, email, role, tenantId, tenantSubdomain)
    
    // Inject headers to ensure backwards compatibility with database loggers
    req.headers['x-tenant-id'] = decoded.tenantId;
    req.headers['x-tenant-subdomain'] = decoded.tenantSubdomain;
    req.headers['x-user-role'] = decoded.role;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-name'] = decoded.name;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'TokenExpired', message: 'Authentication token has expired.' });
    }
    return res.status(401).json({ error: 'InvalidToken', message: 'Authentication token is invalid.' });
  }
}

// Middleware to restrict access based on Role-Based Access Control (RBAC)
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Security Violation: Your role [${userRole}] has insufficient privileges. Requires: [${allowedRoles.join(', ')}].` 
      });
    }
    
    next();
  };
}
