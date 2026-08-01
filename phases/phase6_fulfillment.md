# Phase 6: Customer Sales Orders & Shipping Fulfillment

This phase orchestrates customer orders, picking grids, carrier routing, and the returns pipeline.

---

## 🛍️ 1. Sales Order Lifecycle & Inventory Allocation
When a Sales Order (SO) is placed, inventory stock is handled in two stages:

1. **Soft Allocation**: Quantity is reserved but not deducted. `Soft Reserved` quantity increases, reducing the `Available to Sell` calculation.
2. **Hard Deduction**: When the picker scans the item barcode, the quantity is deducted from the bin database records.

$$\text{Available to Sell} = \text{Total In-Stock Qty} - \text{Soft Reserved Qty}$$

---

## 🏃 2. Optimized Picking & Packing Grids
- **Picking Lists**: System aggregates order line items and orders them by Warehouse Aisle coordinates. This forms an optimized path to reduce foot-traffic overlap.
- **Verification Scanning**: When packing boxes, operators scan each item barcode. If an unlisted barcode is scanned, the UI flags an error warning to prevent shipping mistakes.

---

## 🚚 3. Carrier Shipping Webhooks
CISMS integrates with logistics carriers (UPS, FedEx, DHL) to fetch tracking status details:

```
  +---------------+         +---------------+         +-------------+
  | Label Printed | ------> |  In Transit   | ------> |  Delivered  |
  +---------------+         +---------------+         +-------------+
```

During staging, external tracking APIs are polled (or simulated webhooks are parsed) to automatically trigger internal order state updates:
```javascript
app.post('/api/webhooks/carrier-tracking', async (req, res) => {
  const { trackingNumber, carrierStatus, timestamp } = req.body;
  
  // Find order associated with tracking number
  const order = await db.salesOrders.find({ trackingNumber });
  if (order) {
    await db.salesOrders.updateStatus(order.id, carrierStatus);
    logActivity('Order Dispatched', `SO-${order.id} status changed to ${carrierStatus}`, 'info');
  }
  res.sendStatus(200);
});
```

---

## 🔄 4. Returns & RMA Logic
The **Return Merchandise Authorization (RMA)** processes customer returns:

- Returned items are quarantined inside a dedicated **Quarantine Bin**.
- **Inspection Workflow**: Inspectors classify items:
  - **Restock**: Returned to active inventory racks.
  - **Repair**: Sent to technician workbench coordinates.
  - **Scrap**: Purged from system catalog (cost accounted as a loss).
