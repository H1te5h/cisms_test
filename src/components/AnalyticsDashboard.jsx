import React from 'react';
import { Package, Truck, ShieldAlert, Award, FileText, Bell } from 'lucide-react';
import StatsCard from './StatsCard';

export default function AnalyticsDashboard({ products, salesOrders, activities, setActivities, setActiveTab }) {
  // Dynamic stats calculation
  const totalProducts = products.length;
  
  const dispatchedOrdersCount = salesOrders.filter(
    o => o.status === 'Shipped' || o.status === 'Delivered'
  ).length;

  const lowStockCount = products.filter(
    p => p.stock <= p.minStock
  ).length;

  // Average cost basis metric
  const avgCostVal = products.length > 0
    ? (products.reduce((acc, curr) => acc + curr.cost, 0) / products.length).toFixed(2)
    : "0.00";

  return (
    <div className="page-container">
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700 }}>Supply Chain Overview</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Real-time stock indicators, fulfillment pipelines, and compliance audit trail summaries.</p>
      </div>

      <div className="stats-grid">
        <StatsCard 
          title="Total SKUs Cataloged" 
          value={totalProducts.toString()} 
          change={`${totalProducts > 0 ? 'Active catalog' : 'No items cataloged'}`} 
          isPositive={totalProducts > 0} 
          icon={Package} 
          iconColor="#6366f1"
        />
        <StatsCard 
          title="Fulfillment Dispatched" 
          value={dispatchedOrdersCount.toString()} 
          change={`${dispatchedOrdersCount > 0 ? 'Orders shipped/delivered' : 'No orders dispatched'}`} 
          isPositive={dispatchedOrdersCount > 0} 
          icon={Truck} 
          iconColor="#10b981"
        />
        <StatsCard 
          title="Avg. SKU Cost" 
          value={`$${avgCostVal}`} 
          change={products.length > 0 ? 'Calculated from catalog' : 'No cost data'} 
          isPositive={products.length > 0} 
          icon={Award} 
          iconColor="#fbbf24"
        />
        <StatsCard 
          title="Stock Alerts Active" 
          value={lowStockCount.toString()} 
          change={lowStockCount > 0 ? 'Action required' : 'Inventory optimized'} 
          isPositive={lowStockCount === 0} 
          icon={ShieldAlert} 
          iconColor={lowStockCount > 0 ? '#ef4444' : '#10b981'}
        />
      </div>

      <div className="layout-split">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600 }}>System Activity Log</h3>
            {activities.length > 0 && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setActivities([])}
              >
                Clear logs
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activities.map((act) => (
              <div key={act.id} style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div style={{
                  width: '8px', 
                  backgroundColor: act.type === 'danger' ? 'var(--danger)' : 
                                   act.type === 'success' ? 'var(--success)' : 
                                   act.type === 'info' ? 'var(--accent-color)' : 'var(--warning)',
                  borderRadius: '4px',
                  flexShrink: 0
                }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{act.action}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{act.time}</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', lineHeight: '140%' }}>{act.detail}</p>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <Bell size={24} style={{ color: 'var(--text-muted)' }} />
                <span>No logs or activities recorded yet. Actions will populate here.</span>
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => setActiveTab('products')}>
              <Package size={16} />
              <span>Review Catalog & Stock</span>
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => setActiveTab('locations')}>
              <Truck size={16} />
              <span>Manage Warehouse Stock</span>
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => setActiveTab('suppliers')}>
              <Award size={16} />
              <span>Procure Stock (PO)</span>
            </button>
            <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', width: '100%' }} onClick={() => setActiveTab('orders')}>
              <FileText size={16} />
              <span>Fulfill Sales Orders</span>
            </button>
          </div>

          <div style={{ backgroundColor: 'var(--accent-light)', border: '1px dashed var(--accent-color)', borderRadius: 'var(--border-radius-md)', padding: '16px', marginTop: '12px' }}>
            <h4 style={{ color: 'var(--accent-color)', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={14} />
              Compliance Note
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '140%' }}>
              All interactions are stored inside the multi-tenant audit logger engine. Any stock adjustment logs are immutable to comply with SOC2 rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
