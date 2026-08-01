# Phase 8: Hardening, Security Audits & Cloud Deployment

This phase optimizes query speed, patches security vulnerabilities, and coordinates cloud deployments.

---

## 🔒 1. Security Auditing & Compliance Controls
Before production release, code and dependencies are audited:

- **Dependency Security Scan**: Automated scans via CI/CD using `npm audit` or `audit-ci` to check for security vulnerabilities.
- **API Defense Configurations**:
  - Enforce CORS (Cross-Origin Resource Sharing) white-lists.
  - Setup `helmet` middlewares to configure CSP (Content Security Policy) and HSTS (HTTP Strict Transport Security) headers.
  - Block SQL Injection (SQLi) attacks by enforcing parameterised query bindings across all repositories.

---

## 🏎️ 2. Query Analysis & Redis Caching
To maintain sub-second response times under load, CISMS analyzes DB queries:

- **Query Planner Profiling**: Run `EXPLAIN ANALYZE` on slowest endpoints to design indices:
  ```sql
  EXPLAIN ANALYZE SELECT * FROM stock_allocations WHERE bin_id = '...' AND quantity > 10;
  ```
- **Caching Layer**: Frequent read queries (like Category Lists or Supplier Directories) are cached in Redis with a TTL of 1 hour. Caches are invalidated immediately upon PUT/POST updates.

---

## ☁️ 3. Cloud Deployment Infrastructure
CISMS is structured as a cloud-native microservice deployment:

```
                  +-----------------------+
                  |  Cloud Load Balancer  |
                  +-----------------------+
                              |
               +--------------+--------------+
               |                             |
               v                             v
    +--------------------+        +--------------------+
    |  Backend App (ECS) |        |  Backend App (ECS) |
    +--------------------+        +--------------------+
               |                             |
               +--------------+--------------+
                              |
               +--------------v--------------+
               |  Primary Aurora PostgreSQL  |
               +-----------------------------+
```

### Infrastructure Specs
1. **Frontend App**: Deployed on Vercel or Netlify, backed by Global Content Delivery Networks (CDNs).
2. **Backend Services**: Hosted inside Docker containers on AWS Elastic Container Service (ECS) or Google Cloud Run.
3. **Database**: Managed relational databases (e.g. AWS Aurora Serverless PostgreSQL) with automated daily snapshot backups.
