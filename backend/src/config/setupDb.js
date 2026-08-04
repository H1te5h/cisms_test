import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Client } = pg;

const setupSql = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable Trigram extension for GIN index search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing tables/rules/triggers
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Tenants Table (UUID keys)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products Table (UUID keys, soft-delete audit columns)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 10,
  cost NUMERIC(12, 2) DEFAULT 0.00,
  price NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Locations Table (UUID keys)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NOT NULL,
  capacity INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 100,
  item_stored VARCHAR(255) DEFAULT 'Unassigned',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers Table (UUID keys)
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  lead_time VARCHAR(100) DEFAULT '5 Days',
  terms VARCHAR(100) DEFAULT 'Net 30',
  rating NUMERIC(3, 2) DEFAULT 5.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Orders Table (UUID keys, po_code display ID)
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  po_code VARCHAR(100) UNIQUE NOT NULL,
  supplier VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  total NUMERIC(12, 2) DEFAULT 0.00,
  date VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sales Orders Table (UUID keys, so_code display ID)
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  so_code VARCHAR(100) UNIQUE NOT NULL,
  customer VARCHAR(255) NOT NULL,
  status VARCHAR(100) NOT NULL,
  carrier VARCHAR(100) NOT NULL,
  tracking VARCHAR(100) NOT NULL,
  total NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table (Immutable Compliance)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  time VARCHAR(100) NOT NULL,
  tenant_subdomain VARCHAR(100) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  actor_email VARCHAR(255) NOT NULL,
  actor_role VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enforce Immutability on Audit Logs at Database level (SOC2 compliance)
CREATE RULE no_update_audit_logs AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit_logs AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- Database Indexes for optimized query execution
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_locations_tenant ON locations(tenant_id);
CREATE INDEX idx_locations_code ON locations(code);
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX idx_sales_orders_tenant ON sales_orders(tenant_id);

-- GIN Trigram index for high-performance partial/search queries on name/sku
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
`;

async function runSetup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL environment variable is missing inside backend/.env.");
    process.exit(1);
  }

  console.log("Connecting to Supabase PostgreSQL Instance...");
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Successfully connected. Building schema blueprints...");
    await client.query(setupSql);
    console.log("Schemas defined successfully. Seeding initial records...");

    // ONLY run demo seeding when SEED_DEMO=true (development/testing)
    if (process.env.SEED_DEMO !== 'true') {
      console.log('SEED_DEMO is not set to "true". Skipping demo data seed.');
      await client.end();
      return;
    }
    
    // Fixed UUIDs for repeatable seed testing
    const tenant1Id = 'd0000000-0000-0000-0000-000000000001';
    const tenant2Id = 'd0000000-0000-0000-0000-000000000002';
    const tenant3Id = 'd0000000-0000-0000-0000-000000000003';

    // Seed Tenants
    await client.query(
      `INSERT INTO tenants (id, name, subdomain) VALUES 
       ($1, 'Alpha Enterprise', 'alpha'),
       ($2, 'Beta Logistics', 'beta'),
       ($3, 'Omega Distribution', 'omega')`,
      [tenant1Id, tenant2Id, tenant3Id]
    );

    // Hash passwords programmatically with bcryptjs
    const hashOwner = await bcrypt.hash('owner123', 10);
    const hashAdmin = await bcrypt.hash('admin123', 10);
    const hashManager = await bcrypt.hash('manager123', 10);
    const hashMember = await bcrypt.hash('member123', 10);

    // Seed Users
    await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role) VALUES 
       ($1, 'owner@cisms.com', $2, 'John Doe', 'Owner'),
       ($1, 'admin@cisms.com', $3, 'Sarah Connor', 'Admin'),
       ($1, 'manager@cisms.com', $4, 'Alex Mercer', 'Manager'),
       ($1, 'member@cisms.com', $5, 'Marcus Fenix', 'Member')`,
      [tenant1Id, hashOwner, hashAdmin, hashManager, hashMember]
    );

    // Seed Products
    await client.query(`
      INSERT INTO products (id, tenant_id, sku, name, category, stock, min_stock, cost, price) VALUES
      ('p0000000-0000-0000-0000-000000000001', '${tenant1Id}', 'SKU-EL-101', 'Intel Xeon Processor W-2295', 'Infrastructure', 12, 5, 850.00, 1200.00),
      ('p0000000-0000-0000-0000-000000000002', '${tenant1Id}', 'SKU-EL-102', 'Cisco Catalyst 9300 Switch', 'Hardware', 4, 5, 2300.00, 3400.00),
      ('p0000000-0000-0000-0000-000000000003', '${tenant1Id}', 'SKU-EL-103', 'Cat6 Shielded Cable Spool 1000ft', 'Cables', 35, 10, 85.00, 150.00),

      ('p0000000-0000-0000-0000-000000000004', '${tenant2Id}', 'SKU-IN-201', 'Toyota 3-Wheel Electric Forklift', 'Infrastructure', 2, 1, 18000.00, 25000.00),
      ('p0000000-0000-0000-0000-000000000005', '${tenant2Id}', 'SKU-IN-202', 'Hydraulic Pallet Jack 5500lbs', 'Hardware', 8, 10, 280.00, 450.00),
      ('p0000000-0000-0000-0000-000000000006', '${tenant2Id}', 'SKU-IN-203', 'Heavy Duty Steel Storage Pallets', 'Furniture', 120, 50, 45.00, 75.00),

      ('p0000000-0000-0000-0000-000000000007', '${tenant3Id}', 'SKU-OF-301', 'Steelcase Gesture Ergonomic Chair', 'Furniture', 45, 15, 650.00, 950.00),
      ('p0000000-0000-0000-0000-000000000008', '${tenant3Id}', 'SKU-OF-302', 'Standing Desk Walnut 60x30', 'Furniture', 8, 10, 320.00, 550.00),
      ('p0000000-0000-0000-0000-000000000009', '${tenant3Id}', 'SKU-OF-303', 'Dual Monitor Desk Mount Arm', 'Hardware', 60, 20, 75.00, 120.00)
    `);

    // Seed Locations
    await client.query(`
      INSERT INTO locations (id, tenant_id, name, code, capacity, max_capacity, item_stored) VALUES
      ('l0000000-0000-0000-0000-000000000001', '${tenant1Id}', 'Warehouse Alpha - Zone A - Rack 1', 'W-A-R1', 12, 100, 'Intel Xeon Processor'),
      ('l0000000-0000-0000-0000-000000000002', '${tenant1Id}', 'Warehouse Alpha - Zone B - Rack 3', 'W-A-R3', 4, 50, 'Cisco Catalyst Switch'),

      ('l0000000-0000-0000-0000-000000000003', '${tenant2Id}', 'Industrial Hub - Zone 1 - Aisle B', 'IND-1-B', 2, 10, 'Toyota Forklifts'),
      ('l0000000-0000-0000-0000-000000000004', '${tenant2Id}', 'Industrial Hub - Zone 3 - Aisle D', 'IND-3-D', 8, 40, 'Hydraulic Jacks'),

      ('l0000000-0000-0000-0000-000000000005', '${tenant3Id}', 'Central Depot - Floor 1 - Bay A', 'DEP-1-A', 45, 150, 'Steelcase Gesture Chairs'),
      ('l0000000-0000-0000-0000-000000000006', '${tenant3Id}', 'Central Depot - Floor 2 - Bay C', 'DEP-2-C', 8, 80, 'Standing Desks')
    `);

    // Seed Suppliers
    await client.query(`
      INSERT INTO suppliers (id, tenant_id, name, lead_time, terms, rating) VALUES
      ('s0000000-0000-0000-0000-000000000001', '${tenant1Id}', 'Silicon Valley Distributors', '3 Days', 'Net 15', 4.80),
      ('s0000000-0000-0000-0000-000000000002', '${tenant1Id}', 'Cisco Wholesale Logistics', '7 Days', 'Net 30', 4.50),

      ('s0000000-0000-0000-0000-000000000003', '${tenant2Id}', 'Caterpillar Industrial Corp', '15 Days', 'Net 60', 4.90),
      ('s0000000-0000-0000-0000-000000000004', '${tenant2Id}', 'Toyota Material Handling Partner', '10 Days', 'Net 30', 4.70),

      ('s0000000-0000-0000-0000-000000000005', '${tenant3Id}', 'Steelcase Corporate Furnishings', '5 Days', 'Net 30', 4.80),
      ('s0000000-0000-0000-0000-000000000006', '${tenant3Id}', 'Office Depot Master Supplier', '2 Days', 'Net 15', 4.20)
    `);

    // Seed Purchase Orders
    await client.query(`
      INSERT INTO purchase_orders (id, tenant_id, po_code, supplier, status, total, date) VALUES
      ('a0000000-0000-0000-0000-000000000001', '${tenant1Id}', 'PO-1001', 'Silicon Valley Distributors', 'Received', 10200.00, '2026-07-15'),
      ('a0000000-0000-0000-0000-000000000002', '${tenant1Id}', 'PO-1002', 'Cisco Wholesale Logistics', 'Sent', 13600.00, '2026-07-22'),

      ('a0000000-0000-0000-0000-000000000003', '${tenant2Id}', 'PO-2001', 'Caterpillar Industrial Corp', 'Received', 36000.00, '2026-07-10'),
      ('a0000000-0000-0000-0000-000000000004', '${tenant2Id}', 'PO-2002', 'Toyota Material Handling Partner', 'Draft', 50000.00, '2026-07-24'),

      ('a0000000-0000-0000-0000-000000000005', '${tenant3Id}', 'PO-3001', 'Steelcase Corporate Furnishings', 'Received', 9750.00, '2026-07-18'),
      ('a0000000-0000-0000-0000-000000000006', '${tenant3Id}', 'PO-3002', 'Office Depot Master Supplier', 'Sent', 2400.00, '2026-07-23')
    `);

    // Seed Sales Orders
    await client.query(`
      INSERT INTO sales_orders (id, tenant_id, so_code, customer, status, carrier, tracking, total) VALUES
      ('b0000000-0000-0000-0000-000000000001', '${tenant1Id}', 'SO-9001', 'Microsoft Corporate HQ', 'Delivered', 'FedEx', 'T-FEDEX-9182', 2400.00),
      ('b0000000-0000-0000-0000-000000000002', '${tenant1Id}', 'SO-9002', 'Meta Platforms Inc', 'Picking', 'UPS', 'T-UPS-4432', 6800.00),

      ('b0000000-0000-0000-0000-000000000003', '${tenant2Id}', 'SO-8001', 'Boring Company Nevada', 'Delivered', 'DHL Express', 'T-DHL-5521', 50000.00),
      ('b0000000-0000-0000-0000-000000000004', '${tenant2Id}', 'SO-8002', 'SpaceX Starbase Port', 'Packed', 'FedEx', 'T-FEDEX-1092', 25000.00),

      ('b0000000-0000-0000-0000-000000000005', '${tenant3Id}', 'SO-7001', 'Google Office Expansion', 'Delivered', 'USPS', 'T-USPS-8871', 19000.00),
      ('b0000000-0000-0000-0000-000000000006', '${tenant3Id}', 'SO-7002', 'Netflix Studios LA', 'Picking', 'DHL Express', 'T-DHL-9011', 5500.00)
    `);

    // Seed Initial System Audit Log
    await client.query(`
      INSERT INTO audit_logs (id, time, tenant_subdomain, actor_name, actor_email, actor_role, action, details, ip_address) VALUES
      ('LOG-00000000-0000-0000-0000-000000000001', '12:00:00 PM 7/24/2026', 'alpha', 'System', 'system@cisms.com', 'System', 'DATABASE_INITIALIZATION', 'Relational database bootstrapped and seeded with core tenant configurations.', '127.0.0.1')
    `);

    console.log("Supabase DB successfully set up, secure users seeded, rules and indexes active!");
  } catch (error) {
    console.error("Database setup failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSetup();
