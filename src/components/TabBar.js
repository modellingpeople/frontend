import React from 'react';

const TABS = [
  { id: 'safety', label: 'Safety', icon: '\u26A0\uFE0F' },
  { id: 'elder_care', label: 'Elder Care', icon: '\uD83C\uDFE0' },
  { id: 'rehab_fitness', label: 'Rehab & Fitness', icon: '\uD83C\uDFCB\uFE0F' },
];

export default function TabBar({ activeTab, onTabChange }) {
  return (
    <div className="tab-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`tab-button${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
