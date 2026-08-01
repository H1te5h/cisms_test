# CISMS — Problems, Gaps & Technical Debt Register

> **Last Audited**: July 27, 2026  
> **Scope**: Full-stack audit of Frontend (Vite + React), Backend (Express + PostgreSQL), Infrastructure, and Security posture.  
> **Reference Spec**: [project_phases.md](./project_phases.md) & [phases/](./phases/)

---

## Table of Contents

- [1. Critical Security Vulnerabilities](#1-critical-security-vulnerabilities)
- [2. Authentication & Authorization Gaps](#2-authentication--authorization-gaps)
- [3. Database Schema Deficiencies](#3-database-schema-deficiencies)
- [4. Missing Backend API Endpoints](#4-missing-backend-api-endpoints)
- [5. Business Logic Gaps](#5-business-logic-gaps)
- [6. Frontend Gaps](#6-frontend-gaps)
- [7. Infrastructure & DevOps Gaps](#7-infrastructure--devops-gaps)
- [8. Testing & Quality Assurance Gaps](#8-testing--quality-assurance-gaps)
- [9. Performance & Scalability Issues](#9-performance--scalability-issues)
- [10. Phase-by-Phase Gap Summary](#10-phase-by-phase-gap-summary)

---

## 1. Critical Security Vulnerabilities

These issues represent **immediate security risks** that must be resolved before any production deployment.

### 1.1 No Real Authentication System

**File**: [`backend/src/routes/auth.js`](./backend/src/routes/auth.js)

The authentication system is entirely mocked. Login accepts any email address without password verification. There are no JWT tokens, no session management, and no credential storage.

```javascript
// CURRENT: Mock login — accepts any email, no password check
const user = accounts.find(u => u.email === email) || {
  email,
  name: email.split('@')[0],
  role: 'Member'
};
```

**What's Needed:**

- Password hashing with `bcrypt` (or `argon2`)
- JWT Access Tokens (15-minute expiry) + Refresh Tokens (7-day, HttpOnly cookie)
- Token revocation via database or Redis blacklist
- Login rate limiting to prevent brute-force attacks

---

### 1.2 No RBAC Enforcement on API Routes

**Files**: All route files in [`backend/src/routes/`](./backend/src/routes/)

Despite the spec defining 4 permission tiers (Owner, Admin, Manager, Member), **no API endpoint checks the user's role**. Any authenticated (or unauthenticated) request can create, modify, or delete any resource.

``` comment

❌ DELETE /api/products/:id      → No role check (should require Admin+)
❌ PUT /api/suppliers/pos/:id    → No role check (should require Manager+)
❌ POST /api/orders              → No role check (should require Member+)
```

**What's Needed:**

- A `requireRole(allowedRoles)` middleware, as specified in [`phases/phase2_identity.md`](./phases/phase2_identity.md)
- Applied to every mutating endpoint with appropriate role restrictions
- Custom error messages for `403 Forbidden` responses

---

### 1.3 Unrestricted CORS Policy

**File**: [`backend/src/index.js`](./backend/src/index.js) — Line 19

```javascript
app.use(cors());  // ← Allows ALL origins
```

This permits cross-origin requests from any domain, enabling CSRF and data exfiltration attacks.

**What's Needed:**

- Whitelist specific frontend origins:

  ```javascript
  app.use(cors({ origin: ['https://example-app.cisms.com'], credentials: true }));
  ```

---

### 1.4 No Security Headers

The server does not set any HTTP security headers. Missing protections include:

| Header | Purpose | Status |
| :------- | :-------- | :------: |
| `Content-Security-Policy` | Prevents XSS, inline script injection | ❌ Missing |
| `Strict-Transport-Security` | Forces HTTPS connections | ❌ Missing |
| `X-Content-Type-Options` | Prevents MIME sniffing | ❌ Missing |
| `X-Frame-Options` | Prevents clickjacking | ❌ Missing |
| `Referrer-Policy` | Controls referrer leakage | ❌ Missing |

**What's Needed:**

- Install and configure the `helmet` middleware package

---

### 1.5 No Input Validation / Sanitization

API endpoints directly destructure `req.body` fields and pass them into SQL queries without any validation layer.

```javascript
// Example from products.js — no validation on any field
const { id, sku, name, category, stock, minStock, cost, price } = req.body;
```

While parameterized queries prevent SQL injection, there is no protection against:

- Invalid data types (string where number expected)
- Missing required fields (partial inserts)
- Oversized payloads (no body size limits)
- XSS payloads stored in text fields

**What's Needed:**

- Input validation library (`joi`, `zod`, or `express-validator`)
- Request body schemas for every POST/PUT endpoint
- Express body size limits (`express.json({ limit: '10kb' })`)

---

### 1.6 No Rate Limiting

There is no rate limiting on any endpoint. The system is vulnerable to:

- Brute-force login attacks
- API abuse and DDoS
- Audit log flooding

**What's Needed:**

- `express-rate-limit` middleware (or Redis-backed token bucket)
- Stricter limits on auth endpoints (e.g., 5 attempts per minute)
- General API limits (e.g., 100 requests per minute per IP)

---

## 2. Authentication & Authorization Gaps

### 2.1 Tenant Isolation Is Header-Based (Spoofable)

**All route files**
Tenant context is determined solely by the `x-tenant-id` header sent from the frontend. Any client can set this header to access another tenant's data.

```javascript
const tenantId = req.headers['x-tenant-id'];  // ← User-controlled, not server-validated
```

**What's Needed:**

- Tenant ID must be derived from the authenticated user's JWT claims, not from a client header
- A proper tenant resolver middleware that maps authenticated sessions to tenant scopes

---

### 2.2 No Two-Factor Authentication (2FA)

The spec requires TOTP-based MFA with Google Authenticator / Authy integration. This is entirely unimplemented.

**What's Needed:**

- TOTP secret generation and encrypted storage (AES-256-GCM)
- QR code generation for authenticator app enrollment
- 2FA verification step during login flow
- Recovery codes for account lockout scenarios

---

### 2.3 Audit Logs Are Not Immutable

**File**: [`backend/src/config/setupDb.js`](./backend/src/config/setupDb.js) — Lines 80–91

The spec states audit logs must be append-only (no UPDATE/DELETE). The current schema has no such constraints.

**What's Needed:**

- Database-level trigger or rule to prevent `UPDATE` and `DELETE` on `audit_logs`
- Consider a separate read-only database connection for audit queries

---

## 3. Database Schema Deficiencies

### 3.1 VARCHAR Primary Keys Instead of UUIDs

**File**: [`backend/src/config/setupDb.js`](./backend/src/config/setupDb.js)

All tables use `VARCHAR(50)` primary keys with client-generated IDs. The spec calls for `UUID` columns with `uuid_generate_v4()`.

**Current:**

``` sql
id VARCHAR(50) PRIMARY KEY
```

**Expected:**

``` sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

**Impact:**

- Non-standard ID formats across the system
- Client can inject arbitrary ID values (security risk)
- No guaranteed uniqueness without UUID extension

---

### 3.2 No Timestamp Audit Columns

Tables lack `created_at`, `updated_at`, and `deleted_at` columns as required by the spec.

| Table | `created_at` | `updated_at` | `deleted_at` |
| :------------------ | :------------: | :------------: | :------------: |
| `tenants` | ❌ | ❌ | ❌ |
| `products` | ❌ | ❌ | ❌ |
| `locations` | ❌ | ❌ | ❌ |
| `suppliers` | ❌ | ❌ | ❌ |
| `purchase_orders` | ❌ | ❌ | ❌ |
| `sales_orders` | ❌ | ❌ | ❌ |

**Impact:** No record of when data was created or last modified; no soft-delete capability.

---

### 3.3 Missing Tables

The following tables specified in the phase documents do not exist:

| Missing Table | Spec Source | Purpose |
| :-------------- | :----------- | :-------- |
| `warehouse_bins` | Phase 4 | Hierarchical bin structure (Zone → Aisle → Rack → Bin) |
| `stock_allocations` | Phase 4 | Product-to-bin quantity mapping |
| `stock_movements` | Phase 4 | Transfer history ledger |
| `order_items` / `sales_order_lines` | Phase 6 | Product line items within a sales order |
| `goods_receipt_notes` | Phase 5 | Incoming shipment verification records |
| `returns` / `rma_requests` | Phase 6 | Return merchandise authorization tracking |
| `financial_ledgers` | Phase 7 | COGS and financial analytics data |
| `api_keys` | Phase 7 | Developer API key storage |
| `users` | Phase 2 | No users table — authentication is mocked |

---

### 3.4 Flat Warehouse Location Model

**File**: [`backend/src/config/setupDb.js`](./backend/src/config/setupDb.js) — Lines 38–47

The spec requires a hierarchical model: `Warehouse → Zone → Aisle → Rack → Bin` with volume/weight capacity tracking. The current schema is a flat table with only `name`, `code`, `capacity`, `max_capacity`.

**Current Schema:**

``` sql
CREATE TABLE locations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  capacity INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 100,
  item_stored VARCHAR(255) DEFAULT 'Unassigned'
);
```

**Expected Schema (from Phase 4):**

``` SQL
CREATE TABLE warehouse_bins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id UUID REFERENCES warehouses(id),
  bin_code VARCHAR(50) UNIQUE NOT NULL,
  zone VARCHAR(100) NOT NULL,
  aisle VARCHAR(50) NOT NULL,
  rack VARCHAR(50) NOT NULL,
  bin VARCHAR(50) NOT NULL,
  max_volume_m3 NUMERIC(6, 2),
  max_weight_kg NUMERIC(8, 2),
  current_volume_m3 NUMERIC(6, 2) DEFAULT 0,
  current_weight_kg NUMERIC(8, 2) DEFAULT 0
);
```

---

### 3.5 No Database Indexes

Beyond primary keys, no indexes exist. The spec calls for:

- `idx_warehouses_tenant` on `warehouses(tenant_id)`
- B-Tree indexes on `sku`, `category`, `tenant_id`
- GIN indexes on `name` and `description` for full-text search

---

### 3.6 No Migration System

**File**: [`backend/src/config/setupDb.js`](./backend/src/config/setupDb.js)

The schema setup script uses `DROP TABLE IF EXISTS ... CASCADE` followed by full recreates. This destroys all data on every run. There is no incremental migration system.

**What's Needed:**

- Migration tool (e.g., `node-pg-migrate`, `knex`, or `prisma migrate`)
- Versioned, incremental migration files
- Rollback capability

---

## 4. Missing Backend API Endpoints

### 4.1 Product Management

| Endpoint | Method | Status | Notes |
| :--------- | :------: | :------: | :------ |
| `GET /api/products` | GET | ✅ Built | Tenant-scoped |
| `POST /api/products` | POST | ✅ Built | No validation |
| `PUT /api/products/:id` | PUT | ❌ Missing | Cannot edit existing products |
| `DELETE /api/products/:id` | DELETE | ⚠️ Partial | Hard delete, not soft delete |
| `GET /api/products/search` | GET | ❌ Missing | No server-side search/filter |

### 4.2 Warehouse Management

| Endpoint | Method | Status | Notes |
| :--------- | :------: | :------: | :------ |
| `GET /api/locations` | GET | ✅ Built | Flat model only |
| `POST /api/locations` | POST | ✅ Built | |
| `PUT /api/locations/transfer` | PUT | ✅ Built | Transactional |
| `PUT /api/locations/:id` | PUT | ❌ Missing | Cannot edit bin details |
| `DELETE /api/locations/:id` | DELETE | ❌ Missing | Cannot decommission bins |
| `GET /api/locations/heatmap` | GET | ❌ Missing | No utilization calculations |

### 4.3 Supplier & Procurement

| Endpoint | Method | Status | Notes |
| :--------- | :------: | :------: | :------ |
| `GET /api/suppliers` | GET | ✅ Built | |
| `POST /api/suppliers` | POST | ✅ Built | |
| `PUT /api/suppliers/:id` | PUT | ❌ Missing | Cannot edit supplier profiles |
| `DELETE /api/suppliers/:id` | DELETE | ❌ Missing | |
| `POST /api/suppliers/pos` | POST | ✅ Built | |
| `PUT /api/suppliers/pos/:id/status` | PUT | ✅ Built | No state machine validation |
| `POST /api/grn` | POST | ❌ Missing | Goods Receipt Note |
| `GET /api/grn/:poId` | GET | ❌ Missing | |

### 4.4 Order Fulfillment

| Endpoint | Method | Status | Notes |
| :--------- | :------: | :------: | :------ |
| `GET /api/orders` | GET | ✅ Built | |
| `POST /api/orders` | POST | ✅ Built | No inventory allocation |
| `PUT /api/orders/:id/status` | PUT | ✅ Built | |
| `GET /api/orders/:id/picking-list` | GET | ❌ Missing | Optimized pick paths |
| `POST /api/webhooks/carrier-tracking` | POST | ❌ Missing | Carrier status webhooks |
| `POST /api/orders/:id/return` | POST | ❌ Missing | RMA initiation |
| `GET /api/returns` | GET | ❌ Missing | |

### 4.5 Analytics & Developer APIs

| Endpoint | Method | Status | Notes |
| :--------- | :------: | :------: | :------ |
| `GET /api/analytics/kpis` | GET | ❌ Missing | ITR, stockout rates |
| `GET /api/analytics/vendor-performance` | GET | ❌ Missing | |
| `POST /api/developer/keys` | POST | ❌ Missing | API key issuance |
| `GET /api/developer/keys` | GET | ❌ Missing | |
| `DELETE /api/developer/keys/:id` | DELETE | ❌ Missing | |
| WebSocket `/ws/dashboard` | WS | ❌ Missing | Real-time event stream |

---

## 5. Business Logic Gaps

### 5.1 No Inventory Allocation on Sales Orders

When a sales order is placed, stock quantities are **not deducted or reserved** from any product or warehouse bin. Multiple orders can be placed exceeding available stock.

**What's Needed:**

- Soft reservation on order creation (`Available to Sell = Total Stock - Reserved`)
- Hard deduction when order status moves to `Packed`
- Rollback allocation if order is cancelled

---

### 5.2 No Purchase Order State Machine Validation

**File**: [`backend/src/routes/suppliers.js`](./backend/src/routes/suppliers.js) — Line 98

The PO status can be changed to any value without validation. The spec requires ordered transitions:

``` note
Draft → Pending Approval → Sent → Partial Delivery → Completed → Cancelled
```

Currently, a PO can jump from `Draft` directly to `Received` or any arbitrary status string.

---

### 5.3 No Order-Product Linkage

Sales orders contain only a `customer`, `carrier`, `tracking`, and `total`. There are **no line items** linking orders to specific products with quantities and prices.

**Impact:** It's impossible to:

- Know which products are in an order
- Generate picking lists
- Calculate accurate financials
- Process partial shipments or returns

---

### 5.4 No Goods Receipt Verification

When a Purchase Order is marked as `Received`, there is no workflow to verify incoming quantities against the PO, handle under-shipments, or update product cost basis (WAC).

---

### 5.5 No Returns / RMA Pipeline

The system has no mechanism for handling customer returns. Missing components:

- RMA request creation
- Quarantine bin assignment
- Inspection workflow (Restock / Repair / Scrap classification)
- Inventory quantity adjustment on restock

---

## 6. Frontend Gaps

### 6.1 No Client-Side Route Protection

The frontend relies on a simple `if (!currentUser)` check in `App.jsx`. There is no:

- Token expiry detection
- Automatic redirect on session timeout
- Protected route wrapper component

### 6.2 Dashboard Shows Static Calculations

The `AnalyticsDashboard.jsx` derives stats purely from the client-side arrays. There are no backend analytics endpoints providing computed KPIs.

### 6.3 No Real-Time Updates

The frontend loads data once on mount and when tenant/user changes. There is no WebSocket connection for live updates (e.g., stock changes, new orders, alerts).

### 6.4 No Notification System

The bell icon in the header is decorative. There is no notification infrastructure for:

- Low-stock alerts
- Order status changes
- PO approval requests

---

## 7. Infrastructure & DevOps Gaps

### 7.1 No Docker Development Environment

The spec calls for a `docker-compose.yml` with PostgreSQL and Redis services. None exists. Developers must manually configure a database connection.

### 7.2 No Redis

Redis is not installed or configured anywhere. It's needed for:

- Session/token storage
- Caching (category lists, supplier directories)
- Job queues (BullMQ for background alerts)
- Rate limiting (token bucket algorithm)

### 7.3 No CI/CD Pipeline

No GitHub Actions workflow exists. The spec requires:

- Static code analysis on every PR
- Lint checks
- Unit test execution
- Dependency security audits (`npm audit`)

### 7.4 No Environment Configuration Management

**File**: [`backend/.env.example`](./backend/.env.example)

Only `DATABASE_URL` is documented. Missing environment variables for:

- JWT secrets
- Redis connection URL
- CORS allowed origins
- SMTP / notification service credentials
- API rate limit configuration

---

## 8. Testing & Quality Assurance Gaps

### 8.1 Zero Test Coverage

There are **no test files** anywhere in the project. No unit tests, integration tests, or end-to-end tests exist.

**What's Needed:**

- Unit tests for business logic (state machine transitions, WAC calculations, inventory allocation)
- Integration tests for API endpoints (using `supertest`)
- Frontend component tests (using `vitest` + `@testing-library/react`)
- End-to-end tests (using Playwright or Cypress)

### 8.2 No Load Testing

No benchmarks or stress test scripts exist. The spec requires load testing and `EXPLAIN ANALYZE` on frequent queries before production.

---

## 9. Performance & Scalability Issues

### 9.1 N+1 Query Patterns

The frontend makes **6 sequential API calls** on every page load in `App.jsx` (`fetchData`). These could be batched into a single aggregated endpoint or loaded in parallel.

### 9.2 No Pagination

All `GET` endpoints return the entire dataset with no `LIMIT` / `OFFSET` support. This will not scale beyond hundreds of records.

### 9.3 No Caching

Every request hits the database directly. Frequently read, rarely changed data (categories, supplier lists) should be cached with TTLs.

### 9.4 Client-Side Search & Filtering

Product search and category filtering happen entirely in the React frontend. The database has no full-text search indexes to support server-side filtering.

---

## 10. Phase-by-Phase Gap Summary

| Phase | Spec Requirement | Implemented | Gap Description |
| :-----: | :---------------- | :-----------: | :---------------- |
| **1** | Docker + Redis sandbox | ❌ | No containerized dev environment |
| **1** | Incremental DB migrations | ❌ | Destructive drop-and-recreate script only |
| **1** | UUID primary keys | ❌ | Using VARCHAR(50) |
| **1** | CI/CD pipeline | ❌ | No GitHub Actions |
| **1** | Structured logging (Winston) | ❌ | DB-only logger |
| **2** | JWT + Refresh tokens | ❌ | Mock auth, no tokens |
| **2** | Password hashing | ❌ | No passwords at all |
| **2** | Tenant resolver middleware | ⚠️ | Header-based, spoofable |
| **2** | RBAC route guards | ❌ | No permission checks |
| **2** | 2FA (TOTP) | ❌ | Not started |
| **2** | Immutable audit logs | ⚠️ | Logs written but not protected from DELETE |
| **3** | Product UPDATE API | ❌ | Only create/delete |
| **3** | Full-text search (GIN) | ❌ | No search indexes |
| **3** | Product image uploads | ❌ | No cloud storage pipeline |
| **3** | Barcode/QR generation | ❌ | Columns exist, no logic |
| **3** | Low-stock alert worker | ❌ | No background jobs |
| **4** | Hierarchical bin model | ❌ | Flat location table |
| **4** | Volume/weight tracking | ❌ | Integer capacity only |
| **4** | Stock movements ledger | ❌ | No dedicated table |
| **4** | Heatmap endpoints | ❌ | No utilization API |
| **5** | Supplier UPDATE/DELETE | ❌ | Create only |
| **5** | PO state machine rules | ❌ | Any status accepted |
| **5** | GRN processor | ❌ | Not implemented |
| **5** | WAC cost calculation | ❌ | Not implemented |
| **6** | Inventory allocation | ❌ | Orders don't affect stock |
| **6** | Order line items | ❌ | No product linkage in orders |
| **6** | Picking list generation | ❌ | Not implemented |
| **6** | Carrier webhooks | ❌ | Not implemented |
| **6** | Returns / RMA | ❌ | Not implemented |
| **7** | KPI analytics endpoints | ❌ | Frontend-only stats |
| **7** | WebSocket streaming | ❌ | No real-time updates |
| **7** | Developer API keys | ❌ | Not implemented |
| **7** | Swagger/OpenAPI docs | ❌ | Not created |
| **8** | Helmet security headers | ❌ | Not installed |
| **8** | Rate limiting | ❌ | Not implemented |
| **8** | Redis caching | ❌ | Redis not set up |
| **8** | Database indexes | ❌ | Only PKs exist |
| **8** | Test suite | ❌ | Zero tests |
| **8** | Cloud deployment IaC | ⚠️ | Only basic Render config |

---

> **Total identified gaps: 40+**  
> **Critical security issues: 6**  
> **Missing database tables: 9**  
> **Missing API endpoints: 15+**
