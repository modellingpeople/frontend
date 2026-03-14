import React from 'react';

function ViewToggle({ mode, onChange }) {
  return (
    <div className="view-toggle">
      <button
        className={mode === '1st' ? 'active' : ''}
        onClick={() => onChange('1st')}
      >
        1st Person
      </button>
      <button
        className={mode === '3rd' ? 'active' : ''}
        onClick={() => onChange('3rd')}
      >
        3rd Person
      </button>
    </div>
  );
}

export default ViewToggle;
