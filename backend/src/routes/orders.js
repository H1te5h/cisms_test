import express from 'express';
import pool from '../db.js';
import { logToDb } from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
 
// GET all Sales Orders for tenant (secured via JWT claims)
router.get('/', authenticateToken, async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    // Map so_code as "id" for frontend backward-compatibility
    const result = await pool.query(
      'SELECT id, so_code as "id", customer, status, carrier, tracking, total FROM sales_orders WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    res.json(result.rows.map(row => ({ ...row, total: parseFloat(row.total) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST place a new customer Sales Order (restricted to Owner/Admin/Manager)
router.post('/', authenticateToken, requireRole(['Owner', 'Admin', 'Manager']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id, customer, carrier, tracking, total } = req.body; // id is the display code e.g. "SO-9001"

  if (!id || !customer || !carrier || !tracking || total === undefined) {
    return res.status(400).json({ error: 'Missing required Sales Order fields.' });
  }

  try {
    // Insert client display code as so_code, DB generates UUID primary key
    await pool.query(
      'INSERT INTO sales_orders (tenant_id, so_code, customer, status, carrier, tracking, total) VALUES ($1, $2, $3, \'Picking\', $4, $5, $6)',
      [tenantId, id, customer, carrier, tracking, total]
    );

    await logToDb(
      req,
      'SO_PLACED',
      `New sales order ${id} issued for customer "${customer}" with total $${total.toLocaleString()}.`
    );

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT transition Sales Order status (restricted to Owner/Admin/Manager/Member)
router.put('/:id/status', authenticateToken, requireRole(['Owner', 'Admin', 'Manager', 'Member']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params; // id matches display so_code e.g. "SO-9001"
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    // Query matching so_code and tenant_id
    const soResult = await pool.query(
      'SELECT customer, carrier, tracking FROM sales_orders WHERE so_code = $1 AND tenant_id = $2', 
      [id, tenantId]
    );

    if (soResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sales Order not found' });
    }

    const so = soResult.rows[0];

    // Update matching so_code
    await pool.query(
      'UPDATE sales_orders SET status = $1 WHERE so_code = $2 AND tenant_id = $3',
      [status, id, tenantId]
    );

    let details = '';
    if (status === 'Packed') {
      details = `Sales order ${id} has been fully packed and verified for shipping carrier ${so.carrier}.`;
    } else if (status === 'Shipped') {
      details = `Sales order ${id} dispatched via ${so.carrier} with tracking ID ${so.tracking}.`;
    } else if (status === 'Delivered') {
      details = `Fulfillment complete. Sales order ${id} marked as delivered to customer "${so.customer}".`;
    } else {
      details = `Sales order ${id} status set to ${status}.`;
    }

    await logToDb(req, `ORDER_${status.toUpperCase()}`, details);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
