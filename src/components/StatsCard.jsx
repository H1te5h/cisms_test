import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function StatsCard({ title, value, change, isPositive, icon: Icon, iconColor }) {
  return (
    <div className="card">
      <div className="stat-header">
        <span>{title}</span>
        <div className="stat-icon-wrapper" style={{ backgroundColor: iconColor + '15', color: iconColor }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="stat-val">{value}</div>
      {change && (
        <div className={`stat-change ${isPositive ? 'up' : 'down'}`}>
          {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
