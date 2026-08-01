# Phase 3: Product Catalog & Inventory Management

This phase focuses on the **Product SKU Master Database**, barcode integration, search indexing, and automated threshold alerts.

---

## 📦 1. SKU Database Model & Catalog CRUD
The catalog maps physical items to digital SKUs. It supports multiple variants (color, size, packaging) and stores cost basis versus listing prices.

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    stock_qty INTEGER NOT NULL DEFAULT 0,
    min_stock_threshold INTEGER NOT NULL DEFAULT 10,
    cost_basis NUMERIC(10, 2) NOT NULL,
    selling_price NUMERIC(10, 2) NOT NULL,
    barcode VARCHAR(100),
    qr_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete flag
);
```

---

## 🔍 2. Full-Text Search & Multi-Column Filtering
To manage catalog lookup latency under load, indexing is implemented:

- **B-Tree Indexing**: On `sku`, `category`, and `tenant_id`.
- **GIN Indexing**: On `name` and `description` fields to support partial search queries.
- **Search Query**:
  ```sql
  SELECT * FROM products 
  WHERE tenant_id = :tenantId
    AND deleted_at IS NULL
    AND (name ILIKE :search OR sku ILIKE :search)
    AND (:category = 'All' OR category = :category)
  LIMIT :limit OFFSET :offset;
  ```

---

## 🏷️ 3. Barcode & QR Code Integration
- **SKU Generation Rule**: System constructs SKUs automatically based on category prefixes (e.g., `SKU-EL-109` for electronics).
- **Scanner Support**: Product lookup listens to standard Keyboard Emulation inputs from USB/Bluetooth handheld barcode scanners.

---

## 🚨 4. Automated Reorder Alert System
CISMS tracks current warehouse stocks against configured reorder limit thresholds.

```
                    +-----------------------+
                    | Product Quantity Mode |
                    +-----------------------+
                                |
                   (Quantities change in DB)
                                |
                                v
             +-------------------------------------+
             | Is stock <= min_stock_threshold?    |
             +-------------------------------------+
                  /                           \
               (Yes)                          (No)
                /                               \
               v                                 v
    +----------------------+            +------------------+
    | Fire low-stock alarm |            | Maintain normal  |
    | worker to notify     |            | catalog status   |
    +----------------------+            +------------------+
```

### Notification Channels
1. **In-App Notification**: Added to the user's header alerts widget.
2. **Webhooks / Email**: Dispatched asynchronously via Redis queues (e.g., BullMQ) to notify purchasing managers.
