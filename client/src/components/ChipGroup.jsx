import React from 'react';

export default function ChipGroup({ items, activeId, onChange, compact }) {
  return (
    <div className={`chips ${compact ? 'chips-compact' : ''}`}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={`chip ${compact ? 'chip-sm' : ''} ${activeId === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
