import React, { useState } from 'react';
import { Plus, Users, ShoppingBag, Star, Lock } from 'lucide-react';

export default function SupplierProcurement({ suppliers, setSuppliers, orders, setOrders, addActivity, currentUser }) {
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Form states
  const [supName, setSupName] = useState('');
  const [supLead, setSupLead] = useState('5 Days');
  const [supTerms, setSupTerms] = useState('Net 30');
  const [supRating, setSupRating] = useState(5.0);

  const [orderSupplier, setOrderSupplier] = useState('');
  const [orderTotal, setOrderTotal] = useState(1000);

  // RBAC Permission checks
  const canOnboardSupplier = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';
  const canManagePOs = currentUser?.role === 'Owner' || currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const handleAddSupplier = (e) => {
    e.preventDefault();
    if (!canOnboardSupplier) {
      alert("Security Violation: Your role has insufficient privileges to perform this action.");
      return;
    }
    if (!supName) return;
    const newSup = {
      id: Date.now().toString(),
      name: supName,
      leadTime: supLead,
      terms: supTerms,
      rating: parseFloat(supRating)
    };
    setSuppliers([...suppliers, newSup]);
    setIsSupplierModalOpen(false);
    
    addActivity(
      'Vendor Onboarded',
      `Supplier partner "${supName}" has been successfully onboarded with lead time of ${supLead}.`,
      'success'
    );

    setSupName('');
  };

  const triggerOrderModal = () => {
    if (!canManagePOs) return;
    if (suppliers.length === 0) {
      alert("Please onboard at least one supplier vendor before generating a Purchase Order.");
      return;
    }
    setOrderSupplier(suppliers[0].name);
    setIsOrderModalOpen(true);
  };

  const handleCreatePO = (e) => {
    e.preventDefault();
    if (!canManagePOs) {
      alert("Security Violation: Your role has insufficient privileges to perform this action.");
      return;
    }
    const newPO = {
      id: `PO-${Date.now().toString().slice(-4)}`,
      supplier: orderSupplier,
      status: 'Draft',
      total: parseFloat(orderTotal),
      date: new Date().toISOString().split('T')[0]
    };
    setOrders([newPO, ...orders]);
    setIsOrderModalOpen(false);

    addActivity(
      'PO Generated',
      `Draft Purchase Order ${newPO.id} generated for supplier "${orderSupplier}" with value $${newPO.total.toLocaleString()}.`,
      'info'
    );
  };

  const handleUpdateStatus = (poId, newStatus) => {
    if (!canManagePOs) {
      alert("Security Violation: Your role has insufficient privileges to perform this action.");
      return;
    }
    const updated = orders.map(o => o.id === poId ? { ...o, status: newStatus } : o);
    setOrders(updated);
    const targetPo = orders.find(o => o.id === poId);
    if (!targetPo) return;

    if (newStatus === 'Sent') {
      addActivity(
        'PO Dispatched',
        `Purchase Order ${poId} was sent to vendor "${targetPo.supplier}". Status is Sent.`,
        'warning'
      );
    } else if (newStatus === 'Received') {
      addActivity(
        'PO Received',
        `Goods Receipt Note completed. Materials for PO ${poId} received from "${targetPo.supplier}".`,
        'success'
      );
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700 }}>Supplier & Purchase Orders</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Onboard suppliers, create multi-item PO procurement sheets, and track receipts.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${canOnboardSupplier ? 'btn-secondary' : 'btn-secondary'}`} 
            onClick={() => canOnboardSupplier ? setIsSupplierModalOpen(true) : null}
            style={{ 
              opacity: canOnboardSupplier ? 1 : 0.6, 
              cursor: canOnboardSupplier ? 'pointer' : 'not-allowed',
              borderColor: canOnboardSupplier ? 'var(--border-color)' : 'var(--danger)'
            }}
            title={canOnboardSupplier ? "Onboard a supplier partner" : `Locked: Requires Admin/Owner (Current: ${currentUser?.role})`}
          >
            {canOnboardSupplier ? <Users size={18} /> : <Lock size={18} style={{ color: 'var(--danger)' }} />}
            <span>Onboard Supplier</span>
          </button>
          
          <button 
            className={`btn ${canManagePOs ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={triggerOrderModal}
            style={{ 
              opacity: canManagePOs ? 1 : 0.6, 
              cursor: canManagePOs ? 'pointer' : 'not-allowed',
              borderColor: canManagePOs ? 'none' : 'var(--danger)'
            }}
            title={canManagePOs ? "Issue new Purchase Order" : `Locked: Requires Manager/Admin/Owner (Current: ${currentUser?.role})`}
          >
            {canManagePOs ? <Plus size={18} /> : <Lock size={18} style={{ color: 'var(--danger)' }} />}
            <span>Issue PO</span>
          </button>
        </div>
      </div>

      <div className="layout-split">
        <div className="table-container">
          <div className="table-header">
            <span className="table-title">Purchase Orders Registry</span>
          </div>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>PO Code</th>
                  <th>Supplier</th>
                  <th>Order Value</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{o.id}</td>
                    <td>{o.supplier}</td>
                    <td>${o.total.toLocaleString()}</td>
                    <td>{o.date}</td>
                    <td>
                      <span className={`badge ${
                        o.status === 'Received' ? 'badge-success' :
                        o.status === 'Sent' ? 'badge-info' : 'badge-warning'
                      }`}>{o.status}</span>
                    </td>
                    <td>
                      {o.status === 'Draft' && (
                        <button 
                          className={`btn ${canManagePOs ? 'btn-secondary' : 'btn-secondary'}`} 
                          style={{ 
                            padding: '4px 10px', 
                            fontSize: '12px', 
                            opacity: canManagePOs ? 1 : 0.6,
                            cursor: canManagePOs ? 'pointer' : 'not-allowed'
                          }} 
                          onClick={() => canManagePOs ? handleUpdateStatus(o.id, 'Sent') : null}
                          title={canManagePOs ? "Send Purchase Order" : "Locked: Requires Manager/Admin/Owner"}
                        >
                          {canManagePOs ? 'Send PO' : <Lock size={12} style={{ color: 'var(--danger)' }} />}
                        </button>
                      )}
                      {o.status === 'Sent' && (
                        <button 
                          className={`btn ${canManagePOs ? 'btn-primary' : 'btn-secondary'}`} 
                          style={{ 
                            padding: '4px 10px', 
                            fontSize: '12px',
                            opacity: canManagePOs ? 1 : 0.6,
                            cursor: canManagePOs ? 'pointer' : 'not-allowed'
                          }} 
                          onClick={() => canManagePOs ? handleUpdateStatus(o.id, 'Received') : null}
                          title={canManagePOs ? "Receive incoming stock items" : "Locked: Requires Manager/Admin/Owner"}
                        >
                          {canManagePOs ? 'Receive Items' : <Lock size={12} style={{ color: 'var(--danger)' }} />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <ShoppingBag size={24} />
                        <span>No Purchase Orders issued yet. Click 'Issue PO' to begin.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Active Suppliers</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {suppliers.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</h4>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                    Lead time: {s.leadTime} &bull; Terms: {s.terms}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', fontWeight: 600, fontSize: '14px' }}>
                  <Star size={16} fill="var(--warning)" />
                  <span>{s.rating}</span>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Users size={20} />
                <span>No supplier vendors registered.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isSupplierModalOpen && canOnboardSupplier && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleAddSupplier}>
            <div className="modal-header">
              <span className="modal-title">Onboard New Supplier Vendor</span>
              <button type="button" className="btn-icon-only" onClick={() => setIsSupplierModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Vendor Name</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="e.g. Globex Logistics Inc." 
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                />
              </div>

              <div className="layout-split" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Lead Time</label>
                  <input 
                    type="text" 
                    className="input-control" 
                    placeholder="e.g. 5 Days" 
                    value={supLead}
                    onChange={(e) => setSupLead(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Payment Terms</label>
                  <select 
                    className="input-control"
                    value={supTerms}
                    onChange={(e) => setSupTerms(e.target.value)}
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Initial Vendor Score (1-5)</label>
                <input 
                  type="number" 
                  className="input-control" 
                  min="1"
                  max="5"
                  step="0.1"
                  value={supRating}
                  onChange={(e) => setSupRating(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsSupplierModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Onboard</button>
            </div>
          </form>
        </div>
      )}

      {isOrderModalOpen && canManagePOs && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleCreatePO}>
            <div className="modal-header">
              <span className="modal-title">Create Purchase Order (PO)</span>
              <button type="button" className="btn-icon-only" onClick={() => setIsOrderModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Supplier Partner</label>
                <select 
                  className="input-control"
                  value={orderSupplier}
                  onChange={(e) => setOrderSupplier(e.target.value)}
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Total Procurement Value ($)</label>
                <input 
                  type="number" 
                  className="input-control"
                  min="1"
                  value={orderTotal}
                  onChange={(e) => setOrderTotal(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsOrderModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Draft PO</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
