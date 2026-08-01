# Phase 7: Analytics, Dashboards & Developer Platform

This phase calculates operational metrics, streams real-time dashboard events, and exposes external developer APIs.

---

## 📈 1. Supply Chain KPI Analytics
CISMS calculates inventory flow metrics using SQL aggregates:

### Inventory Turnover Ratio (ITR)
Measures how many times inventory is sold and replaced over a time period:

$$\text{ITR} = \frac{\text{Cost of Goods Sold (COGS)}}{\text{Average Inventory Value}}$$

```sql
SELECT 
    SUM(cogs_amount) / NULLIF(AVG(inventory_value), 0) AS inventory_turnover_ratio
FROM financial_ledgers
WHERE tenant_id = :tenantId AND record_date >= :startDate;
```

---

## ⚡ 2. Real-time Dashboard Synchronization
To avoid constant polling from the dashboard client, WebSockets (using `socket.io` or native WebSocket server instances) broadcast immediate inventory changes:

- **Stock Alert Broadcast**: Sent immediately to the dashboard when quantities drop below threshold limits.
- **Order Dispatch Ticker**: Updates map coordinates and carriers list dynamically in the dispatch room UI.

```javascript
// Server stock update handler
export function handleStockChange(io, tenantId, productId, newQty) {
  io.to(`tenant_${tenantId}`).emit('stock:updated', {
    productId,
    quantity: newQty,
    timestamp: new Date().toISOString()
  });
}
```

---

## 🔑 3. Developer API Keys & Documentation
CISMS exposes key resources to developers for third-party integrations (e.g. connecting external WooCommerce or Shopify storefronts).

- **Authorization Model**: Custom API Keys hashed in database using SHA-256. Delivered via `X-API-Key` headers.
- **Scoped Permissions**: Keys are configured with read/write parameters (`read:inventory`, `write:orders`).
- **Rate Limiting**: Enforced via Redis Token Bucket algorithm (e.g. maximum 100 API requests per minute per key).
