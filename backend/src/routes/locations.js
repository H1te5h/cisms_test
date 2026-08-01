import express from 'express';
import pool from '../db.js';
import { logToDb } from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all storage locations scoped to tenant (secured via JWT claims)
router.get('/', authenticateToken, async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    const result = await pool.query(
      'SELECT id, name, code, capacity, max_capacity as "maxCapacity", item_stored as "itemStored" FROM locations WHERE tenant_id = $1 ORDER BY code ASC',
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST define a new storage location bin (restricted to Owner/Admin)
router.post('/', authenticateToken, requireRole(['Owner', 'Admin']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { name, code, maxCapacity, itemStored } = req.body;

  if (!name || !code || !maxCapacity) {
    return res.status(400).json({ error: 'Missing required location fields.' });
  }

  try {
    // Generate UUID at the database level, ignoring any client-generated ID
    await pool.query(
      'INSERT INTO locations (tenant_id, name, code, capacity, max_capacity, item_stored) VALUES ($1, $2, $3, 0, $4, $5)',
      [tenantId, name, code.toUpperCase(), maxCapacity, itemStored || 'Unassigned']
    );

    await logToDb(
      req,
      'LOCATION_DEFINED',
      `New storage location bin ${code.toUpperCase()} (${name}) registered with capacity ${maxCapacity}.`
    );

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT execute a stock transfer between bins (restricted to Owner/Admin/Manager)
router.put('/transfer', authenticateToken, requireRole(['Owner', 'Admin', 'Manager']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { sourceCode, destCode, transferQty } = req.body;

  if (!sourceCode || !destCode || !transferQty) {
    return res.status(400).json({ error: 'Missing required transfer details.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Retrieve source location details
    const sourceRes = await client.query(
      'SELECT capacity, item_stored FROM locations WHERE code = $1 AND tenant_id = $2 FOR UPDATE',
      [sourceCode, tenantId]
    );

    // Retrieve destination location details
    const destRes = await client.query(
      'SELECT capacity, max_capacity FROM locations WHERE code = $1 AND tenant_id = $2 FOR UPDATE',
      [destCode, tenantId]
    );

    if (sourceRes.rows.length === 0 || destRes.rows.length === 0) {
      throw new Error('One or both warehouse bins could not be found.');
    }

    const sourceBin = sourceRes.rows[0];
    const destBin = destRes.rows[0];
    const qty = parseInt(transferQty, 10);

    if (sourceBin.capacity < qty) {
      throw new Error('Insufficient stock in the source location.');
    }

    // Deduct stock from source bin
    await client.query(
      'UPDATE locations SET capacity = capacity - $1 WHERE code = $2 AND tenant_id = $3',
      [qty, sourceCode, tenantId]
    );

    // Add stock to destination bin (capping it at max_capacity)
    const newDestCapacity = Math.min(destBin.max_capacity, destBin.capacity + qty);
    await client.query(
      'UPDATE locations SET capacity = $1 WHERE code = $2 AND tenant_id = $3',
      [newDestCapacity, destCode, tenantId]
    );

    await client.query('COMMIT');

    // Log the transaction movement in compliance audit log
    await logToDb(
      req,
      'STOCK_MOVEMENT',
      `Transferred ${qty} units of "${sourceBin.item_stored}" from bin ${sourceCode} to bin ${destCode}.`
    );

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
