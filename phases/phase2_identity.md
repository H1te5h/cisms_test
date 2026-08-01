# Phase 2: Identity, Multi-Tenancy & RBAC Authorization

This phase secures the system, isolates client workspace records (Multi-Tenancy), and defines granular permission gates (RBAC).

---

## 🏢 1. Tenant Workspace Isolation
CISMS enforces isolation to prevent data leaks between tenants. We use a **Shared Database / Shared Schema** pattern with scoping:

- Every query executing select/insert/update must filter by `tenant_id`.
- Handled at query runtime using database views or backend query builders (e.g. Prisma Middleware, Sequelize Hooks, or Hibernate Filters).

### Express Middleware Example (Tenant Resolver)
```javascript
export function tenantResolver(req, res, next) {
  const host = req.headers['x-tenant-id'] || req.subdomains[0];
  if (!host) {
    return res.status(400).json({ error: 'Tenant context identifier missing' });
  }
  req.tenantId = host;
  next();
}
```

---

## 🔐 2. JWT Authentication & MFA Pipeline
CISMS uses a stateless JWT authentication strategy paired with cookies for web clients:

1. **Access Token**: Short lifespan (15 mins), payload carries role definitions. Passed in memory or Bearer Header.
2. **Refresh Token**: Long lifespan (7 days), stored in an `HttpOnly`, `Secure`, `SameSite=Strict` Cookie. Saved in database for token revocation logic.
3. **MFA (TOTP)**: Users configure Google Authenticator/Authy. Cryptographic secrets are stored encrypted in the database using AES-256-GCM.

---

## 👥 3. Role-Based Access Control (RBAC)
CISMS maps all operational capabilities to a 4-tier hierarchy:

| Role | Domain Capabilities |
| :--- | :--- |
| **Owner** | All operations, billing setup, tenant settings, and custom role assignments. |
| **Admin** | Read/write access on catalog, warehouses, and suppliers. User onboarding. |
| **Manager** | Read catalog, execute stock movements, create purchase orders and approve sales orders. |
| **Member** | Read catalog, check inventory levels, pack boxes, and modify shipping status. |

### API Route Protection Hook (RBAC Guard)
```javascript
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Unauthorized access: insufficient privileges' });
    }
    next();
  };
}
```

---

## 📝 4. Immutable Compliance Audit Logs
To support SOC2/ISO27001 regulatory frameworks, all mutations create an audit trail.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'STOCK_ADJUSTMENT', 'PO_APPROVED'
    description TEXT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
Once written, the audit logs table does not support `UPDATE` or `DELETE` requests.
