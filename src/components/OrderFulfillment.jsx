import React, { useState } from 'react';
import { Package, Truck, CheckCircle, Plus, RefreshCw, Lock } from 'lucide-react';

export default function OrderFulfillment({ orders, setOrders, addActivity, currentUser }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [customer, setCustomer] = useState('');
  const [carrier, setCarrier] = useState('FedEx');
  const [total, setTotal] = useState(100);

  // RBAC Permission checks
  const canCreateSO = currentUser?.role === 'Owner' || currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const handleCreateSO = (e) => {
    e.preventDefault();
    if (!canCreateSO) {
      alert("Security Violation: Your role has insufficient privileges to perform this action.");
      return;
    }
    if (!customer) return;

    const newSO = {
      id: `SO-${Date.now().toString().slice(-4)}`,
      customer,
      status: 'Picking',
      carrier,
      tracking: `T-${carrier.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      total: parseFloat(total)
    };

    setOrders([newSO, ...orders]);
    setIsModalOpen(false);

    addActivity(
      'Sales Order Placed',
      `New sales order ${newSO.id} issued for customer "${customer}" with total $${newSO.total.toLocaleString()}.`,
      'info'
    );

    setCustomer('');
  };

  const handleNextStatus = (id) => {
    const target = orders.find(o => o.id === id);
    if (!target) return;

    let nextStatus = target.status;
    let activityText = '';
    let activityType = 'warning';

    if (target.status === 'Picking') {
      nextStatus = 'Packed';
      activityText = `Sales order ${id} has been fully packed and verified for shipping carrier ${target.carrier}.`;
      activityType = 'info';
    } else if (target.status === 'Packed') {
      nextStatus = 'Shipped';
      activityText = `Sales order ${id} dispatched via ${target.carrier} with tracking ID ${target.tracking}.`;
      activityType = 'success';
    } else if (target.status === 'Shipped') {
      nextStatus = 'Delivered';
      activityText = `Fulfillment complete. Sales order ${id} marked as delivered to customer "${target.customer}".`;
      activityType = 'success';
    }

    const updated = orders.map(o => o.id === id ? { ...o, status: nextStatus } : o);
    setOrders(updated);
    addActivity(
      `Order ${nextStatus}`,
      activityText,
      activityType
    );
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700 }}>Order Fulfillment & Dispatch</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Track sales orders, package check-ins, carrier scheduling, and deliveries.</p>
        </div>
        <button 
          className={`btn ${canCreateSO ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => canCreateSO ? setIsModalOpen(true) : null}
          style={{ 
            opacity: canCreateSO ? 1 : 0.6, 
            cursor: canCreateSO ? 'pointer' : 'not-allowed',
            borderColor: canCreateSO ? 'none' : 'var(--danger)'
          }}
          title={canCreateSO ? "Create new customer Sales Order" : `Locked: Requires Manager/Admin/Owner (Current: ${currentUser?.role})`}
        >
          {canCreateSO ? <Plus size={18} /> : <Lock size={18} style={{ color: 'var(--danger)' }} />}
          <span>New Sales Order</span>
        </button>
      </div>

      <div className="table-container">
        <div className="table-header">
          <span className="table-title">Sales Order Dispatch Dashboard</span>
        </div>
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>SO Code</th>
                <th>Customer</th>
                <th>Carrier Info</th>
                <th>Tracking Code</th>
                <th>Order Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{o.id}</td>
                  <td>{o.customer}</td>
                  <td>{o.carrier}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>{o.tracking}</td>
                  <td>${o.total.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${
                      o.status === 'Delivered' ? 'badge-success' :
                      o.status === 'Shipped' ? 'badge-info' :
                      o.status === 'Packed' ? 'badge-warning' : 'badge-danger'
                    }`} style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      {o.status === 'Picking' && <Package size={12} />}
                      {o.status === 'Packed' && <Package size={12} />}
                      {o.status === 'Shipped' && <Truck size={12} />}
                      {o.status === 'Delivered' && <CheckCircle size={12} />}
                      {o.status}
                    </span>
                  </td>
                  <td>
                    {o.status !== 'Delivered' ? (
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '13px', display: 'inline-flex', gap: '6px' }}
                        onClick={() => handleNextStatus(o.id)}
                      >
                        <RefreshCw size={12} />
                        <span>Move to {
                          o.status === 'Picking' ? 'Packed' :
                          o.status === 'Packed' ? 'Shipped' : 'Delivered'
                        }</span>
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Completed</span>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <Package size={24} />
                      <span>No active Sales Orders generated. Click 'New Sales Order' to begin.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && canCreateSO && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreateSO}>
            <div className="modal-header">
              <span className="modal-title">Create Sales Order (SO)</span>
              <button type="button" className="btn-icon-only" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Customer Company Name</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="e.g. Acme Corp LLC" 
                  required
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </div>

              <div className="layout-split" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Logistics Carrier</label>
                  <select 
                    className="input-control"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  >
                    <option value="FedEx">FedEx</option>
                    <option value="UPS">UPS</option>
                    <option value="DHL Express">DHL Express</option>
                    <option value="USPS">USPS</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Invoice Value ($)</label>
                  <input 
                    type="number" 
                    className="input-control"
                    min="1"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Order</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
