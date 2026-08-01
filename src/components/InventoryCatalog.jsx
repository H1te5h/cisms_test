import React, { useState } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, AlertTriangle, Check, Info, Lock } from 'lucide-react';

export default function InventoryCatalog({ products, setProducts, addActivity, currentUser }) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // New Product Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Infrastructure');
  const [stock, setStock] = useState(0);
  const [minStock, setMinStock] = useState(10);
  const [cost, setCost] = useState(0);
  const [price, setPrice] = useState(0);

  const categories = ['All', 'Infrastructure', 'Hardware', 'Furniture', 'Cables', 'Safety'];

  // RBAC Permission check
  const isAuthorized = currentUser?.role === 'Owner' || currentUser?.role === 'Admin';

  const handleAddProduct = (e) => {
    e.preventDefault();
    if (!isAuthorized) {
      alert("Security Violation: Your role has insufficient privileges to perform this action.");
      return;
    }
    if (!sku || !name) return;

    const newProd = {
      id: Date.now().toString(),
      sku,
      name,
      category,
      stock: parseInt(stock, 10),
      minStock: parseInt(minStock, 10),
      cost: parseFloat(cost),
      price: parseFloat(price)
    };

    setProducts([newProd, ...products]);
    setIsModalOpen(false);
    
    // Add activity log
    addActivity(
      'SKU Onboarded',
      `Product SKU ${sku} (${name}) has been onboarded into category ${category} with stock of ${stock}.`,
      'success'
    );

    // Reset Form
    setSku('');
    setName('');
    setCategory('Infrastructure');
    setStock(0);
    setMinStock(10);
    setCost(0);
    setPrice(0);
  };

  const handleDeleteProduct = (id) => {
    if (!isAuthorized) {
      alert("Security Violation: Your role has insufficient privileges to perform this action.");
      return;
    }
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    setProducts(products.filter(p => p.id !== id));
    addActivity(
      'SKU Archived',
      `Product SKU ${prod.sku} (${prod.name}) has been archived and soft-deleted.`,
      'danger'
    );
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700 }}>Product & SKU Catalog</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Manage stock levels, reorder thresholds, and variants catalog.</p>
        </div>
        <button 
          className={`btn ${isAuthorized ? 'btn-primary' : 'btn-secondary'}`} 
          onClick={() => isAuthorized ? setIsModalOpen(true) : null}
          style={{ opacity: isAuthorized ? 1 : 0.6, cursor: isAuthorized ? 'pointer' : 'not-allowed' }}
          title={isAuthorized ? "Onboard new SKU" : `Locked: Requires Admin/Owner role (Current: ${currentUser?.role})`}
        >
          {isAuthorized ? <Plus size={18} /> : <Lock size={18} style={{ color: 'var(--danger)' }} />}
          <span>Add SKU Item</span>
        </button>
      </div>

      <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by SKU or Product name..." 
            className="input-control" 
            style={{ paddingLeft: '44px' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Category:</span>
          <select 
            className="input-control" 
            style={{ width: '180px' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header">
          <span className="table-title">Inventory Master Directory</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Showing {filteredProducts.length} items</span>
        </div>
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Stock / Min</th>
                <th>Cost Basis</th>
                <th>Sell Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((prod) => (
                <tr key={prod.id}>
                  <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: '13px' }}>{prod.sku}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{prod.name}</div>
                  </td>
                  <td>{prod.category}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: prod.stock <= prod.minStock ? 'var(--danger)' : 'inherit' }}>
                        {prod.stock}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>/ {prod.minStock}</span>
                    </div>
                  </td>
                  <td>${prod.cost}</td>
                  <td>${prod.price}</td>
                  <td>
                    {prod.stock <= prod.minStock ? (
                      <span className="badge badge-danger" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        <AlertTriangle size={12} />
                        Low Stock
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        <Check size={12} />
                        In Stock
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-icon-only" 
                        style={{ 
                          borderRadius: 'var(--border-radius-sm)', 
                          opacity: isAuthorized ? 1 : 0.5, 
                          cursor: isAuthorized ? 'pointer' : 'not-allowed' 
                        }}
                        disabled={!isAuthorized}
                        title={isAuthorized ? "Edit SKU details" : `Locked: Requires Admin/Owner`}
                      >
                        {isAuthorized ? <Edit2 size={14} /> : <Lock size={14} />}
                      </button>
                      <button 
                        className="btn-icon-only" 
                        style={{ 
                          borderRadius: 'var(--border-radius-sm)', 
                          color: isAuthorized ? 'var(--danger)' : 'var(--text-muted)',
                          opacity: isAuthorized ? 1 : 0.5, 
                          cursor: isAuthorized ? 'pointer' : 'not-allowed' 
                        }}
                        disabled={!isAuthorized}
                        onClick={() => handleDeleteProduct(prod.id)}
                        title={isAuthorized ? "Archive product" : `Locked: Requires Admin/Owner`}
                      >
                        {isAuthorized ? <Trash2 size={14} /> : <Lock size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <Info size={24} />
                      <span>No products onboarded. Click 'Add SKU Item' to begin.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && isAuthorized && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleAddProduct}>
            <div className="modal-header">
              <span className="modal-title">Onboard New Product SKU</span>
              <button type="button" className="btn-icon-only" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">SKU Code</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="e.g. SKU-EL-102" 
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Product Title</label>
                <input 
                  type="text" 
                  className="input-control" 
                  placeholder="e.g. Heavy Duty Warehouse Pallets" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="layout-split" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select 
                    className="input-control"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.slice(1).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Reorder Limit</label>
                  <input 
                    type="number" 
                    className="input-control" 
                    min="1"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                </div>
              </div>
              <div className="layout-split" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label className="input-label">Current Stock</label>
                  <input 
                    type="number" 
                    className="input-control" 
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Cost Basis ($)</label>
                  <input 
                    type="number" 
                    className="input-control" 
                    min="0"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Selling Price ($)</label>
                <input 
                  type="number" 
                  className="input-control" 
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save SKU</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
