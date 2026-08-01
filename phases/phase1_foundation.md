# Phase 1: Foundation, DB Schema & Environment Setup

This phase establishes the structural, database, and operational foundations of the **Cloud Inventory & Supply Chain Management System (CISMS)**.

---

## 🏗️ 1. Architecture & Repository Layout

CISMS uses a **Clean Architecture** pattern to separate concerns into decoupled layers. This ensures the database, framework, and API layer can be updated without modifying core business rules.

```Map

📁 project-root/
├── 📁 backend/                # REST API Service
│   ├── 📁 src/
│   │   ├── 📁 config/        # DB, Redis, Logger configs
│   │   ├── 📁 core/          # Domain Entities, Use Cases
│   │   ├── 📁 controllers/   # Express/NestJS handlers
│   │   └── 📁 repositories/  # PostgreSQL database adapters
│   └── docker-compose.yml
└── 📁 frontend/               # Vite + React Client
    ├── 📁 public/
    └── 📁 src/
        ├── 📁 components/     # Reusable UI widgets
        └── 📁 assets/         # CSS styles and imagery
```

---

## 🗄️ 2. Relational Database Schema Blueprints

PostgreSQL is chosen as the primary transactional database due to its robust support for constraints, subqueries, and ACID compliance. 

### Core Relational Schema

```sql
-- Enable UUID generator extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants (Multi-tenancy isolation table)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Warehouses
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft-delete support
);

-- Indexes for Query Speed
CREATE INDEX idx_warehouses_tenant ON warehouses(tenant_id);
```

---

## 🐳 3. Containerized Sandbox & Docker Setup

To standardise dev sandboxes across developer platforms, we configure Docker Compose:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: cisms_postgres
    restart: always
    environment:
      POSTGRES_DB: cisms_db
      POSTGRES_USER: cisms_admin
      POSTGRES_PASSWORD: cisms_secure_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: cisms_redis
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

---

## 🚦 4. Verification & Linting Rules

- **Linter**: ESLint (Oxlint configuration for high-performance frontend compilation).
- **Code Standards**: Configured pre-commit hooks using `husky` and `lint-staged` to enforce style guidelines before files enter Git repository tracking.
