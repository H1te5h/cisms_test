import React, { useState } from 'react';
import { Move, MapPin, Plus, Lock } from 'lucide-react';

export default function WarehouseLocations({ locations, setLocations, addActivity, currentUser }) {
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  
  // Location Form State
  const [locCode, setLocCode] = useState('');
  const [locName, setLocName] = useState('');
  const [locMaxCapacity, setLocMaxCapacity] = useState(100);
  const [locItem, setLocItem] = useState('');

  // Transfer Form State
  const [sourceCode, setSourceCode] = useState('');
  const [destCode, setDestCode] = useState('');
  const [transferQty, setTransferQty] = useState(5);

  // RBAC Permission checks
  const canAddLocation = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';
  const canTransferStock = currentUser?.role === 'Owner' || currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

  const handleAddLocation = (e) => {
    e.preventDefault();
    if (!canAddLocation) {
      alert("Security Violation: Your role has insufficient privileges to perform this action.");
      return;
    }
    if (!locCode || !locName) return;

    const newLoc = {
      id: Date.now().toString(),
      name: locName,
      code: locCode.toUpperCase(),
      capacity: 0,
      maxCapacity: parseInt(locMaxCapacity, 10),
      itemStored: locItem || 'Unassigned'
    };

    setLocations([...locations, newLoc]);
    setIsAddLocationOpen(false);

    addActivity(
      'Location Defined',
      `New storage location bin ${newLoc.code} (${newLoc.name}) registered with capacity ${newLoc.maxCapacity}.`,
      'info'
    );

    // Reset Form
    setLocCode('');
    setLocName('');
    setLocMaxCapacity(100);
    setLocItem('');
  };

  const handleTransfer = (e) => {
    e.preventDefault();
    if (!canTransferStock) {
      alert("Security Violation: Your role has insufficient privileges to perform this action.");
      return;
    }
    if (!sourceCode || !destCode || sourceCode === destCode) return;

    const qty = parseInt(transferQty, 10);
    const sourceLoc = locations.find(l => l.code === sourceCode);
    const destLoc = locations.find(l => l.code === destCode);

    if (!sourceLoc || !destLoc) return;
    if (sourceLoc.capacity < qty) {
      alert("Insufficient stock in source bin!");
      return;
    }

    const updated = locations.map(loc => {
      if (loc.code === sourceCode) {
        return { 
          ...loc, 
          capacity: loc.capacity - qty 
        };
      }
      if (loc.code === destCode) {
        return { 
          ...loc, 
          capacity: Math.min(loc.maxCapacity, loc.capacity + qty) 
        };
      }
      return loc;
    });

    setLocations(updated);
    setIsTransferOpen(false);

    addActivity(
      'Stock Movement',
      `Transferred ${qty} units of "${sourceLoc.itemStored}" from bin ${sourceCode} to bin ${destCode}.`,
      'warning'
    );
  };

  const triggerTransferModal = () => {
    if (!canTransferStock) return;
    if (locations.length < 2) {
      alert("Please configure at least 2 warehouse bins to initiate transfers.");
      return;
    }
    setSourceCode(locations[0].code);
    setDestCode(locations[1].code);
    setIsTransferOpen(true);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700 }}>Warehouse Locations & Transfer</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Monitor location metrics, stock heatmaps, and initiate bin movements.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${canAddLocation ? 'btn-secondary' : 'btn-secondary'}`} 
            onClick={() => canAddLocation ? setIsAddLocationOpen(true) : null}
            style={{ 
              opacity: canAddLocation ? 1 : 0.6, 
              cursor: canAddLocation ? 'pointer' : 'not-allowed',
              borderColor: canAddLocation ? 'var(--border-color)' : 'var(--danger)' 
            }}
            title={canAddLocation ? "Define new storage bin" : `Locked: Requires Admin/Owner (Current: ${currentUser?.role})`}
          >
            {canAddLocation ? <Plus size={18} /> : <Lock size={18} style={{ color: 'var(--danger)' }} />}
            <span>Add Storage Bin</span>
          </button>
          
          <button 
            className={`btn ${canTransferStock ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={triggerTransferModal}
            style={{ 
              opacity: canTransferStock ? 1 : 0.6, 
              cursor: canTransferStock ? 'pointer' : 'not-allowed',
              borderColor: canTransferStock ? 'none' : 'var(--danger)'
            }}
            title={canTransferStock ? "Move stock items" : `Locked: Requires Manager/Admin/Owner (Current: ${currentUser?.role})`}
          >
            {canTransferStock ? <Move size={18} /> : <Lock size={18} style={{ color: 'var(--danger)' }} />}
            <span>Move Inventory</span>
          </button>
        </div>
      </div>

      {locations.length > 0 ? (
        <div className="stats-grid">
          {locations.map(loc => {
            const usagePercent = loc.maxCapacity > 0 ? Math.round((loc.capacity / loc.maxCapacity) * 100) : 0;
            let color = 'var(--success)';
            if (usagePercent > 85) color = 'var(--danger)';
            else if (usagePercent > 60) color = 'var(--warning)';

            return (
              <div className="card" key={loc.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-info" style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{loc.code}</span>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', marginTop: '8px', fontWeight: 600 }}>{loc.name}</h3>
                  </div>
                  <MapPin size={20} style={{ color: 'var(--text-muted)' }} />
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>Capacity Utilization</span>
                    <span style={{ fontWeight: 700, color }}>{usagePercent}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${usagePercent}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }}></div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', fontSize: '13px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Staged: </span>
                  <span style={{ fontWeight: 600 }}>{loc.itemStored}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '6px' }}>({loc.capacity} units)</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <MapPin size={32} />
            <span>No active locations configured. Click 'Add Storage Bin' to design your warehouse layout.</span>
          </div>
        </div>
      )}

      {locations.length > 0 && (
        <div className="table-container">
          <div className="table-header">
            <span className="table-title">Storage Map Directory</span>
          </div>
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Location Code</th>
                  <th>Warehouse / Zone Description</th>
                  <th>Current Staged Weight</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => {
                  const usage = loc.maxCapacity > 0 ? Math.round((loc.capacity / loc.maxCapacity) * 100) : 0;
                  return (
                    <tr key={loc.id}>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{loc.code}</td>
                      <td>{loc.name}</td>
                      <td>{loc.capacity} / {loc.maxCapacity} Metric units</td>
                      <td>
                        {usage > 85 ? (
                          <span className="badge badge-danger">High Utilization</span>
                        ) : usage > 50 ? (
                          <span className="badge badge-warning">Moderate</span>
                        ) : (
                          <span className="badge badge-success">Optimized</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAddLocationOpen && canAddLocation && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleAddLocation}>
            <div className="modal-header">
              <span className="modal-title">Define New Storage Bin</span>
              <button type="button" className="btn-icon-only" onClick={() => setIsAddLocationOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Bin Location Code</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="e.g. W-A-A2 (Warehouse A, Aisle A, Rack 2)" 
                  required
                  value={locCode}
                  onChange={(e) => setLocCode(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Description / Hierarchy Description</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="e.g. Warehouse Alpha - Zone A - Aisle 1" 
                  required
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                />
              </div>

              <div className="layout-split" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Max Bin Capacity</label>
                  <input 
                    type="number" 
                    className="input-control"
                    min="1"
                    value={locMaxCapacity}
                    onChange={(e) => setLocMaxCapacity(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Initial Assigned SKU / Category</label>
                  <input 
                    type="text" 
                    className="input-control"
                    placeholder="e.g. Server Racks"
                    value={locItem}
                    onChange={(e) => setLocItem(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsAddLocationOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Define Location</button>
            </div>
          </form>
        </div>
      )}

      {isTransferOpen && canTransferStock && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleTransfer}>
            <div className="modal-header">
              <span className="modal-title">Initiate Bin Stock Transfer</span>
              <button type="button" className="btn-icon-only" onClick={() => setIsTransferOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Source Location</label>
                <select 
                  className="input-control"
                  value={sourceCode}
                  onChange={(e) => setSourceCode(e.target.value)}
                >
                  {locations.map(loc => (
                    <option key={loc.code} value={loc.code}>{loc.code} - {loc.itemStored} (Available: {loc.capacity})</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Destination Location</label>
                <select 
                  className="input-control"
                  value={destCode}
                  onChange={(e) => setDestCode(e.target.value)}
                >
                  {locations.map(loc => (
                    <option key={loc.code} value={loc.code}>{loc.code} - {loc.itemStored} (Available space: {loc.maxCapacity - loc.capacity})</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Quantity to Move</label>
                <input 
                  type="number" 
                  className="input-control"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsTransferOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Process Transfer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
