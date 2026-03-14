import React from 'react';

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

function WarningDetail({ warning }) {
  if (!warning) {
    return (
      <div className="warning-detail empty">
        Click a marker on the timeline to view warning details
      </div>
    );
  }

  return (
    <div className="warning-detail">
      <div className="warning-detail-header">
        <span className={`severity-badge ${warning.severity}`}>
          {warning.severity}
        </span>
        <span className="warning-timestamp">{formatTimestamp(warning.timestamp)}</span>
        <span className="warning-person">{warning.person}</span>
      </div>
      <p className="warning-text">{warning.text}</p>
    </div>
  );
}

export default WarningDetail;
