import React, { useState } from 'react';
import { Search, ShieldAlert, Filter, ClipboardList, Calendar } from 'lucide-react';

export default function AuditLogs({ logs }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const actionCategories = [
    'All',
    'USER_LOGIN',
    'USER_LOGOUT',
    'TENANT_SWITCH',
    'SKU_ONBOARDED',
    'SKU_ARCHIVED',
    'LOCATION_DEFINED',
    'STOCK_TRANSFER',
    'VENDOR_ONBOARDED',
    'PO_GENERATED',
    'PO_DISPATCHED',
    'PO_RECEIVED',
    'SO_PLACED',
    'SO_STATE_CHANGED'
  ];

  const getBadgeClass = (action) => {
    if (action.includes('LOGIN') || action.includes('SWITCH')) return 'badge-info';
    if (action.includes('ONBOARDED') || action.includes('DEFINED') || action.includes('PLACED') || action.includes('GENERATED')) return 'badge-success';
    if (action.includes('TRANSFER') || action.includes('STATE_CHANGED') || action.includes('DISPATCH')) return 'badge-warning';
    if (action.includes('ARCHIVED') || action.includes('LOGOUT')) return 'badge-danger';
    return 'badge-secondary';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.actorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'All' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardList size={28} style={{ color: 'var(--accent-color)' }} />
            <span>Compliance Audit Ledger</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            SOC2 / ISO27001 compliant immutable system logs. No update or delete operations are permitted.
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by details, user, or action type..." 
            className="input-control" 
            style={{ paddingLeft: '44px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Filter Action:</span>
          <select 
            className="input-control" 
            style={{ width: '220px' }}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            {actionCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="table-title">System Change History Ledger</span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} style={{ color: 'var(--success)' }} />
            <span>Cryptographically Verified &bull; Showing {filteredLogs.length} events</span>
          </span>
        </div>
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Timestamp</th>
                <th>Tenant Context</th>
                <th>Performed By</th>
                <th>Role</th>
                <th>Action Type</th>
                <th>Operation Details</th>
                <th>Client IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} style={{ color: 'var(--text-muted)' }} />
                      <span>{log.time}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 600 }}>
                      {log.tenantSubdomain}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{log.actorName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.actorEmail}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{log.actorRole}</span>
                  </td>
                  <td>
                    <span className={`badge ${getBadgeClass(log.action)}`} style={{ fontSize: '11px' }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px', lineHeight: '140%', color: 'var(--text-primary)', maxWidth: '400px' }}>
                    {log.details}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {log.ipAddress}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <ClipboardList size={24} />
                      <span>No matching audit trail logs found.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
