# Phase 4: Warehouse Locations & Stock Transfers

This phase designs the **Logistics Coordinates Grid** and models stock transfers with relational integrity checks.

---

## 📍 1. Warehouse Hierarchy Grid
To map inventory coordinates inside a warehouse physical structure, CISMS models location trees:

$$\text{Warehouse} \longrightarrow \text{Zone} \longrightarrow \text{Aisle} \longrightarrow \text{Rack} \longrightarrow \text{Bin}$$

```sql
CREATE TABLE warehouse_bins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    bin_code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'WH-A-Z1-A5-R2-B12'
    zone VARCHAR(100) NOT NULL,
    aisle VARCHAR(50) NOT NULL,
    rack VARCHAR(50) NOT NULL,
    bin VARCHAR(50) NOT NULL,
    max_volume_m3 NUMERIC(6, 2) NOT NULL,
    max_weight_kg NUMERIC(8, 2) NOT NULL,
    current_volume_m3 NUMERIC(6, 2) DEFAULT 0,
    current_weight_kg NUMERIC(8, 2) DEFAULT 0
);
```

---

## 🔄 2. Bin Movement Transactions
Relocating inventory from bin $A$ to bin $B$ must execute inside a database transaction to prevent lost updates or double allocation.

```sql
BEGIN;

-- 1. Deduct quantity from Source Bin
UPDATE stock_allocations 
SET quantity = quantity - :transferQty
WHERE bin_id = :sourceBinId AND product_id = :productId;

-- 2. Validate Source Bin doesn't drop below zero
-- (Checked by CHECK constraints on quantity >= 0)

-- 3. Add quantity to Destination Bin
INSERT INTO stock_allocations (bin_id, product_id, quantity)
VALUES (:destBinId, :productId, :transferQty)
ON CONFLICT (bin_id, product_id)
DO UPDATE SET quantity = stock_allocations.quantity + :transferQty;

-- 4. Update Bin physical occupancy weight/volume
UPDATE warehouse_bins 
SET current_weight_kg = current_weight_kg + :itemWeight
WHERE id = :destBinId;

-- 5. Record movement in transfer ledger
INSERT INTO stock_movements (source_bin_id, dest_bin_id, product_id, quantity, user_id)
VALUES (:sourceBinId, :destBinId, :productId, :transferQty, :userId);

COMMIT;
```

---

## 🗺️ 3. Warehouse Stock Heatmaps
The dashboard calculates bin utilization percentages to render stock density heatmaps:

$$\text{Utilization \%} = \left( \frac{\text{Current Weight}}{\text{Max Weight}} \right) \times 100$$

### Utilization Thresholds:
- **Red Alert ($>85\%$ occupancy)**: Bins are near capacity. Triggers suggestions to relocate incoming shipments.
- **Amber Warning ($60\% - 85\%$ occupancy)**: Staging items at threshold levels.
- **Green ($<60\%$ occupancy)**: Safe to store materials.
