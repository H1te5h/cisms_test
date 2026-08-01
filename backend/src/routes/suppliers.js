import express from 'express';
import pool from '../db.js';
import { logToDb } from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all suppliers for tenant (secured via JWT claims)
router.get('/', authenticateToken, async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    const result = await pool.query(
      'SELECT id, name, lead_time as "leadTime", terms, rating FROM suppliers WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId]
    );
    res.json(result.rows.map(row => ({ ...row, rating: parseFloat(row.rating) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST onboard a new supplier (restricted to Owner/Admin)
router.post('/', authenticateToken, requireRole(['Owner', 'Admin']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { name, leadTime, terms, rating } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required.' });
  }

  try {
    // Generate UUID at the database level, ignoring any client-generated ID
    await pool.query(
      'INSERT INTO suppliers (tenant_id, name, lead_time, terms, rating) VALUES ($1, $2, $3, $4, $5)',
      [tenantId, name, leadTime || '5 Days', terms || 'Net 30', rating || 5.0]
    );

    await logToDb(
      req,
      'VENDOR_ONBOARDED',
      `Supplier partner "${name}" has been successfully onboarded with lead time of ${leadTime}.`
    );

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all Purchase Orders for tenant (secured via JWT claims)
router.get('/pos', authenticateToken, async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    // Map po_code as "id" for frontend backward-compatibility
    const result = await pool.query(
      'SELECT id, po_code as "id", supplier, status, total, date FROM purchase_orders WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    res.json(result.rows.map(row => ({ ...row, total: parseFloat(row.total) })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create/issue a new Purchase Order (restricted to Owner/Admin/Manager)
router.post('/pos', authenticateToken, requireRole(['Owner', 'Admin', 'Manager']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id, supplier, total, date } = req.body; // id is the display code e.g. "PO-1001"

  if (!id || !supplier || !total || !date) {
    return res.status(400).json({ error: 'Missing required Purchase Order fields.' });
  }

  try {
    // Insert client display code as po_code, DB generates UUID primary key
    await pool.query(
      'INSERT INTO purchase_orders (tenant_id, po_code, supplier, status, total, date) VALUES ($1, $2, $3, \'Draft\', $4, $5)',
      [tenantId, id, supplier, total, date]
    );

    await logToDb(
      req,
      'PO_GENERATED',
      `Draft Purchase Order ${id} generated for supplier "${supplier}" with value $${total.toLocaleString()}.`
    );

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update status of PO (restricted to Owner/Admin/Manager)
router.put('/pos/:id/status', authenticateToken, requireRole(['Owner', 'Admin', 'Manager']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params; // id matches display po_code e.g. "PO-1001"
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    // Query matching po_code and tenant_id
    const poResult = await pool.query(
      'SELECT supplier, total FROM purchase_orders WHERE po_code = $1 AND tenant_id = $2', 
      [id, tenantId]
    );
    
    if (poResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase Order not found' });
    }

    const po = poResult.rows[0];

    // Update matching po_code
    await pool.query(
      'UPDATE purchase_orders SET status = $1 WHERE po_code = $2 AND tenant_id = $3',
      [status, id, tenantId]
    );

    if (status === 'Sent') {
      await logToDb(
        req,
        'PO_DISPATCHED',
        `Purchase Order ${id} was sent to vendor "${po.supplier}". Status is Sent.`
      );
    } else if (status === 'Received') {
      await logToDb(
        req,
        'PO_RECEIVED',
        `Goods Receipt Note completed. Materials for PO ${id} received from "${po.supplier}".`
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
