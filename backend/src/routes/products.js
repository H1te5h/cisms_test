import express from 'express';
import pool from '../db.js';
import { logToDb } from '../utils/logger.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET all products scoped to tenant (secured via JWT claims)
router.get('/', authenticateToken, async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    const result = await pool.query(
      'SELECT id, sku, name, category, stock, min_stock as "minStock", cost, price FROM products WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY sku ASC',
      [tenantId]
    );
    res.json(result.rows.map(row => ({
      ...row,
      cost: parseFloat(row.cost),
      price: parseFloat(row.price)
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST onboard a new product SKU (restricted to Owner/Admin)
router.post('/', authenticateToken, requireRole(['Owner', 'Admin']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { sku, name, category, stock, minStock, cost, price } = req.body;

  if (!sku || !name || !category) {
    return res.status(400).json({ error: 'Missing required product fields.' });
  }

  try {
    // Generate UUID on the database level, ignoring any client-generated ID
    await pool.query(
      'INSERT INTO products (tenant_id, sku, name, category, stock, min_stock, cost, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [tenantId, sku, name, category, stock || 0, minStock || 10, cost || 0, price || 0]
    );

    await logToDb(
      req,
      'SKU_ONBOARDED',
      `Product SKU ${sku} (${name}) has been onboarded into category ${category} with stock of ${stock}.`
    );

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE archive a product SKU - Soft Delete (restricted to Owner/Admin)
router.delete('/:id', authenticateToken, requireRole(['Owner', 'Admin']), async (req, res) => {
  const tenantId = req.user.tenantId;
  const { id } = req.params;

  try {
    // Find product first for logging (validate it is a valid UUID pattern)
    const prodResult = await pool.query(
      'SELECT sku, name FROM products WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', 
      [id, tenantId]
    );
    
    if (prodResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const prod = prodResult.rows[0];

    // Set deleted_at timestamp for soft delete
    await pool.query(
      'UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2', 
      [id, tenantId]
    );

    await logToDb(
      req,
      'SKU_ARCHIVED',
      `Product SKU ${prod.sku} (${prod.name}) has been archived and soft-deleted.`
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
