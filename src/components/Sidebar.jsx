import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  ShoppingBag, 
  ShieldAlert,
  LogOut,
  Warehouse,
  ShieldCheck
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Product Catalog', icon: Package },
  { id: 'locations', label: 'Warehouse & Stock', icon: Warehouse },
  { id: 'suppliers', label: 'Supplier & POs', icon: Users },
  { id: 'orders', label: 'Order Fulfillment', icon: ShoppingBag },
  { id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
];

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  currentUser, 
  onLogout,
  currentTenant,
  tenants,
  onSwitchTenant,
  onSwitchRole
}) {
  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="brand">
        <div className="brand-icon">
          <Warehouse size={20} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="brand-name">CISMS Enterprise</span>
          <span style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {currentTenant.name}
          </span>
        </div>
      </div>

      <nav className="nav-links" style={{ flex: 1, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
            >
              <Icon className="nav-item-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Developer Context Controls */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          <ShieldAlert size={12} />
          <span>Context Sandbox</span>
        </div>

        <div className="input-group">
          <label className="input-label" style={{ fontSize: '11px' }}>Active Tenant Workspace</label>
          <select 
            className="input-control" 
            style={{ padding: '6px 10px', fontSize: '12px' }}
            value={currentTenant.id}
            onChange={(e) => onSwitchTenant(e.target.value)}
          >
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label" style={{ fontSize: '11px' }}>Simulate Account Role</label>
          <select 
            className="input-control" 
            style={{ padding: '6px 10px', fontSize: '12px' }}
            value={currentUser.role}
            onChange={(e) => onSwitchRole(e.target.value)}
          >
            <option value="Owner">Owner</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Member">Member</option>
          </select>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="user-avatar">{getInitials(currentUser.name)}</div>
            <div className="user-info">
              <span className="user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                {currentUser.name}
              </span>
              <span className="user-role">{currentUser.role}</span>
            </div>
          </div>
          <button 
            className="btn-icon-only" 
            style={{ border: 'none', background: 'none', width: '32px', height: '32px', color: 'var(--danger)' }}
            onClick={onLogout}
            title="Sign out of security session"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
