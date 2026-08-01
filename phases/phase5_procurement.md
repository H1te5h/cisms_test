# Phase 5: Supplier Procurement & Purchase Orders

This phase builds the **Procurement Supply Chain Pipeline**, managing vendors, purchase orders, and goods receipt tracking.

---

## 🤝 1. Supplier Profiles Directory
CISMS indexes external supplier profiles to track supply chain variables:

- Contact metadata, Tax IDs, and billing setups (Net 15, Net 30, Net 60).
- Historical Lead Time accuracy logs.
- Performance scoring (1 to 5 scale), dynamically recalculated when goods receipts notes are resolved.

---

## 📋 2. Purchase Order (PO) State Machine
A Purchase Order guides the procurement cycle. Its status changes are regulated by the backend state machine:

```
  +---------+         +------------------+         +--------+
  |  Draft  | ------> | Pending Approval | ------> |  Sent  |
  +---------+         +------------------+         +--------+
                                                       |
                                                       v
  +-----------+         +------------------+         +--------+
  |  Billed   | <------ | Goods Received   | <------ | Partial|
  +-----------+         +------------------+         +--------+
```

### Transition Handlers
Only users with `Manager` roles or higher can trigger the transition from `Pending Approval` to `Sent`. Once marked as `Sent`, the PO locked against edits.

---

## 📥 3. Goods Receipt Note (GRN) Processor
When delivery trucks arrive, warehouse operators create a **Goods Receipt Note (GRN)** to verify incoming inventory quantities.

- **Under-shipment Handling**: If receipt count is less than PO order count, the system remains in `Partial Delivery` status and issues a warning report.
- **Landed Cost Calculator**: Calculates product **Weighted Average Cost (WAC)** to adjust inventory cost basis dynamically:

$$\text{New WAC} = \frac{(\text{Current Qty} \times \text{Current WAC}) + (\text{Received Qty} \times \text{Purchase Price})}{\text{Current Qty} + \text{Received Qty}}$$
