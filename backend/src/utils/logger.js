import pool from '../db.js';

export async function logToDb(req, action, details) {
  const user = req.user || {};
  const actorName = user.name || req.headers['x-user-name'] || 'System';
  const actorEmail = user.email || req.headers['x-user-email'] || 'system@cisms.com';
  const actorRole = user.role || req.headers['x-user-role'] || 'System';
  const tenantSubdomain = user.tenantSubdomain || req.headers['x-tenant-subdomain'] || 'system';
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  
  // Clean up timestamp formatting
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + new Date().toLocaleDateString();
  const id = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  try {
    await pool.query(
      `INSERT INTO audit_logs (id, time, tenant_subdomain, actor_name, actor_email, actor_role, action, details, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, timestamp, tenantSubdomain, actorName, actorEmail, actorRole, action.toUpperCase().replace(/\s+/g, '_'), details, ipAddress]
    );
  } catch (error) {
    console.error("Failed to write audit log to database:", error);
  }
}
