import React from 'react';

function PersonSelector({ persons, selected, onChange }) {
  return (
    <div className="person-selector">
      <select value={selected} onChange={e => onChange(e.target.value)}>
        <option value="All">All Persons</option>
        {persons.map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}

export default PersonSelector;
