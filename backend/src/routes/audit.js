import express from 'express';
import pool from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET compliance audit logs (secured via JWT claims)
router.get('/', authenticateToken, async (req, res) => {
  const role = req.user.role;
  const subdomain = req.user.tenantSubdomain;

  try {
    let queryText = '';
    let params = [];

    // Owner has global compliance visibility; managers/members are isolated to their subdomain
    if (role === 'Owner') {
      queryText = `
        SELECT id, time, tenant_subdomain as "tenantSubdomain", 
               actor_name as "actorName", actor_email as "actorEmail", 
               actor_role as "actorRole", action, details, ip_address as "ipAddress" 
        FROM audit_logs 
        ORDER BY created_at DESC, time DESC, id DESC`;
    } else {
      queryText = `
        SELECT id, time, tenant_subdomain as "tenantSubdomain", 
               actor_name as "actorName", actor_email as "actorEmail", 
               actor_role as "actorRole", action, details, ip_address as "ipAddress" 
        FROM audit_logs 
        WHERE tenant_subdomain = $1 
        ORDER BY created_at DESC, time DESC, id DESC`;
      params = [subdomain];
    }

    const result = await pool.query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
