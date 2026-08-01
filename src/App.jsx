import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import InventoryCatalog from './components/InventoryCatalog';
import WarehouseLocations from './components/WarehouseLocations';
import SupplierProcurement from './components/SupplierProcurement';
import OrderFulfillment from './components/OrderFulfillment';
import LoginScreen from './components/LoginScreen';
import AuditLogs from './components/AuditLogs';
import { Sun, Moon, Bell } from 'lucide-react';

const tenants = [
  { id: 'd0000000-0000-0000-0000-000000000001', name: 'Alpha Enterprise', subdomain: 'alpha' },
  { id: 'd0000000-0000-0000-0000-000000000002', name: 'Beta Logistics', subdomain: 'beta' },
  { id: 'd0000000-0000-0000-0000-000000000003', name: 'Omega Distribution', subdomain: 'omega' }
];

function App() {
  // Auth and session token states
  const [currentUser, setCurrentUser] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [currentTenant, setCurrentTenant] = useState(tenants[0]);
  const [theme, setTheme] = useState('light');
  
  // App navigation tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Dynamic states loaded from Supabase via Node API
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [salesOrders, setSalesOrders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sync theme with document attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Central authenticated fetch helper with automated silent token refreshes
  const authenticatedFetch = async (url, options = {}) => {
    let token = accessToken;
    
    // Set headers containing Bearer token and tenant parameters
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': currentTenant.id,
      'x-tenant-subdomain': currentTenant.subdomain
    };

    let res = await fetch(url, { ...options, headers });

    // Handle token expiration / unauthorized
    if (res.status === 401) {
      const clone = res.clone();
      try {
        const errorData = await clone.json();
        if (errorData.error === 'TokenExpired') {
          // Attempt silent refresh via secure HttpOnly refresh cookie
          const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newAccessToken = refreshData.accessToken;
            setAccessToken(newAccessToken);

            // Retry original request with the new access token
            const retryHeaders = {
              'Content-Type': 'application/json',
              ...options.headers,
              'Authorization': `Bearer ${newAccessToken}`,
              'x-tenant-id': currentTenant.id,
              'x-tenant-subdomain': currentTenant.subdomain
            };
            res = await fetch(url, { ...options, headers: retryHeaders });
          } else {
            handleLogout();
          }
        } else {
          handleLogout();
        }
      } catch (err) {
        console.error("Authentication refresh parsing failed:", err);
        handleLogout();
      }
    }

    return res;
  };

  // Fetch all tenant data dynamically from backend API
  const fetchData = async () => {
    if (!currentUser || !accessToken) return;
    setLoading(true);
    try {
      // 1. Fetch Products
      const productsRes = await authenticatedFetch('/api/products');
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }

      // 2. Fetch Locations
      const locationsRes = await authenticatedFetch('/api/locations');
      if (locationsRes.ok) {
        const locationsData = await locationsRes.json();
        setLocations(locationsData);
      }

      // 3. Fetch Suppliers
      const suppliersRes = await authenticatedFetch('/api/suppliers');
      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData);
      }

      // 4. Fetch Purchase Orders
      const posRes = await authenticatedFetch('/api/suppliers/pos');
      if (posRes.ok) {
        const posData = await posRes.json();
        setPurchaseOrders(posData);
      }

      // 5. Fetch Sales Orders
      const sosRes = await authenticatedFetch('/api/orders');
      if (sosRes.ok) {
        const sosData = await sosRes.json();
        setSalesOrders(sosData);
      }

      // 6. Fetch Audit Logs
      const auditRes = await authenticatedFetch('/api/audit-logs');
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData);
      }
    } catch (error) {
      console.error("Failed to load backend DB records:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load records whenever session or context changes
  useEffect(() => {
    if (currentUser && accessToken) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, currentTenant, accessToken]);

  // Handle Auth actions via backend endpoints
  const handleLogin = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAccessToken(data.accessToken);
        setCurrentUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Verification failed.' };
      }
    } catch (err) {
      console.error("Login endpoint authentication failed:", err);
      return { success: false, error: 'Connection failed. Please check your backend connection.' };
    }
  };

  const handleLogout = async () => {
    try {
      await authenticatedFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error("Logout api log fail:", err);
    }
    setAccessToken('');
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleSwitchTenant = async (tenantId) => {
    const target = tenants.find(t => t.id === tenantId);
    if (!target) return;
    setCurrentTenant(target);
    try {
      const res = await authenticatedFetch('/api/auth/switch-role', {
        method: 'POST',
        body: JSON.stringify({ role: currentUser?.role })
      });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.accessToken);
      }
    } catch (err) {
      console.error("Tenant switch api log fail:", err);
    }
  };

  const handleSwitchRole = async (newRole) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, role: newRole };
    setCurrentUser(updatedUser);
    try {
      const res = await authenticatedFetch('/api/auth/switch-role', {
        method: 'POST',
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.accessToken);
      }
    } catch (err) {
      console.error("Role switch api log fail:", err);
    }
  };

  // State interceptors to synchronise frontend changes directly to Supabase DB
  const handleProductsUpdate = async (updateArg) => {
    const nextProds = typeof updateArg === 'function' ? updateArg(products) : updateArg;
    
    if (nextProds.length > products.length) {
      // Product Added
      const newProd = nextProds[0];
      await authenticatedFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(newProd)
      });
    } else if (nextProds.length < products.length) {
      // Product Deleted
      const deleted = products.find(p => !nextProds.some(np => np.id === p.id));
      if (deleted) {
        await authenticatedFetch(`/api/products/${deleted.id}`, {
          method: 'DELETE'
        });
      }
    }
    fetchData();
  };

  const handleLocationsUpdate = async (updateArg) => {
    const nextLocs = typeof updateArg === 'function' ? updateArg(locations) : updateArg;
    if (nextLocs.length > locations.length) {
      // New Bin Defined
      const newLoc = nextLocs[nextLocs.length - 1];
      await authenticatedFetch('/api/locations', {
        method: 'POST',
        body: JSON.stringify(newLoc)
      });
    } else if (nextLocs.length === locations.length) {
      // Stock Transferred
      const changed = nextLocs.filter((l, idx) => l.capacity !== locations[idx].capacity);
      if (changed.length === 2) {
        const source = changed.find(l => l.capacity < locations.find(ol => ol.id === l.id).capacity);
        const dest = changed.find(l => l.capacity > locations.find(ol => ol.id === l.id).capacity);
        if (source && dest) {
          const qty = locations.find(ol => ol.id === source.id).capacity - source.capacity;
          await authenticatedFetch('/api/locations/transfer', {
            method: 'PUT',
            body: JSON.stringify({
              sourceCode: source.code,
              destCode: dest.code,
              transferQty: qty
            })
          });
        }
      }
    }
    fetchData();
  };

  const handleSuppliersUpdate = async (updateArg) => {
    const nextSups = typeof updateArg === 'function' ? updateArg(suppliers) : updateArg;
    if (nextSups.length > suppliers.length) {
      const newSup = nextSups[nextSups.length - 1];
      await authenticatedFetch('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify(newSup)
      });
    }
    fetchData();
  };

  const handlePurchaseOrdersUpdate = async (updateArg) => {
    const nextPOs = typeof updateArg === 'function' ? updateArg(purchaseOrders) : updateArg;
    if (nextPOs.length > purchaseOrders.length) {
      // PO Issued
      const newPO = nextPOs[0];
      await authenticatedFetch('/api/suppliers/pos', {
        method: 'POST',
        body: JSON.stringify(newPO)
      });
    } else if (nextPOs.length === purchaseOrders.length) {
      // PO Status Changed
      const changed = nextPOs.find((po, idx) => po.status !== purchaseOrders[idx].status);
      if (changed) {
        await authenticatedFetch(`/api/suppliers/pos/${changed.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: changed.status })
        });
      }
    }
    fetchData();
  };

  const handleSalesOrdersUpdate = async (updateArg) => {
    const nextSOs = typeof updateArg === 'function' ? updateArg(salesOrders) : updateArg;
    if (nextSOs.length > salesOrders.length) {
      // SO Placed
      const newSO = nextSOs[0];
      await authenticatedFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(newSO)
      });
    } else if (nextSOs.length === salesOrders.length) {
      // SO Fulfillment updated
      const changed = nextSOs.find((so, idx) => so.status !== salesOrders[idx].status);
      if (changed) {
        await authenticatedFetch(`/api/orders/${changed.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: changed.status })
        });
      }
    }
    fetchData();
  };

  // Map database audit logs directly into dashboard activities log
  const activities = auditLogs.map(log => ({
    id: log.id,
    action: log.action.replace(/_/g, ' '),
    detail: log.details,
    time: log.time.split(' ')[0],
    type: log.action.includes('LOGIN') ? 'info' : 
          log.action.includes('ONBOARD') || log.action.includes('DEFINED') || log.action.includes('RECEIVED') || log.action.includes('PLACED') ? 'success' : 
          log.action.includes('TRANSFER') || log.action.includes('STATUS') || log.action.includes('STATE') || log.action.includes('SENT') || log.action.includes('MOVEMENT') ? 'warning' : 'danger'
  }));

  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'System Performance Analytics';
      case 'products':
        return 'SKU Master Catalog';
      case 'locations':
        return 'Warehouse & Bins Layout';
      case 'suppliers':
        return 'Procurement & Supplier Directory';
      case 'orders':
        return 'Sales Order Dispatch Control';
      case 'audit':
        return 'Compliance Audit Logs';
      default:
        return 'Control Panel';
    }
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser}
        onLogout={handleLogout}
        currentTenant={currentTenant}
        tenants={tenants}
        onSwitchTenant={handleSwitchTenant}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main Panel Content */}
      <main className="main-content">
        {/* Header Bar */}
        <header className="top-header">
          <div className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>{getHeaderTitle()}</h1>
            <span style={{ 
              fontSize: '11px', 
              backgroundColor: 'var(--accent-light)', 
              color: 'var(--accent-color)', 
              fontWeight: 700, 
              padding: '2px 8px', 
              borderRadius: '12px',
              fontFamily: 'var(--mono)',
              textTransform: 'uppercase'
            }}>
              {currentTenant.subdomain}.cisms.com
            </span>
          </div>
          
          <div className="header-actions">
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Session: <strong style={{ color: 'var(--accent-color)' }}>{currentUser.role}</strong>
            </span>

            {/* Theme Toggle Button */}
            <button className="btn-icon-only" onClick={toggleTheme} title="Toggle Dark/Light Mode">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {/* Notification Bell */}
            <button className="btn-icon-only" style={{ position: 'relative' }}>
              <Bell size={18} />
              {activities.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '8px',
                  height: '8px',
                  backgroundColor: 'var(--danger)',
                  borderRadius: '50%'
                }}></span>
              )}
            </button>
          </div>
        </header>

        {/* Tab Routing content */}
        <div style={{ flex: 1 }}>
          {loading && (
            <div style={{
              padding: '12px 32px',
              backgroundColor: 'var(--accent-light)',
              color: 'var(--accent-color)',
              fontSize: '13px',
              fontWeight: 600,
              textAlign: 'center',
              animation: 'fadeIn 0.3s ease'
            }}>
              Syncing live workspace details with Supabase DB...
            </div>
          )}

          {activeTab === 'dashboard' && (
            <AnalyticsDashboard 
              products={products} 
              salesOrders={salesOrders} 
              activities={activities} 
              setActivities={() => {}} // Clear log disabled in full-stack for compliance
              setActiveTab={setActiveTab} 
            />
          )}
          {activeTab === 'products' && (
            <InventoryCatalog 
              products={products} 
              setProducts={handleProductsUpdate} 
              addActivity={() => {}}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'locations' && (
            <WarehouseLocations 
              locations={locations} 
              setLocations={handleLocationsUpdate} 
              addActivity={() => {}}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'suppliers' && (
            <SupplierProcurement 
              suppliers={suppliers} 
              setSuppliers={handleSuppliersUpdate} 
              orders={purchaseOrders} 
              setOrders={handlePurchaseOrdersUpdate} 
              addActivity={() => {}}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'orders' && (
            <OrderFulfillment 
              orders={salesOrders} 
              setOrders={handleSalesOrdersUpdate} 
              addActivity={() => {}}
              currentUser={currentUser}
            />
          )}
          {activeTab === 'audit' && (
            <AuditLogs 
              logs={auditLogs} 
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
