import React from 'react';

function formatDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Timeline({ warnings, minTime, maxTime, currentTime, onTimeChange, onMarkerClick, selectedWarning }) {
  const range = maxTime - minTime;

  return (
    <div className="timeline">
      <div className="timeline-slider-container">
        <div className="timeline-markers">
          {warnings.map((w, i) => {
            const t = new Date(w.timestamp).getTime();
            const pct = range > 0 ? ((t - minTime) / range) * 100 : 0;
            return (
              <div
                key={i}
                className={`timeline-marker severity-${w.severity}${selectedWarning === w ? ' selected' : ''}`}
                style={{ left: `${pct}%` }}
                title={`${w.severity.toUpperCase()} — ${new Date(w.timestamp).toLocaleString()}`}
                onClick={() => onMarkerClick(w)}
              />
            );
          })}
        </div>
        <input
          type="range"
          min={minTime}
          max={maxTime}
          value={currentTime}
          onChange={e => onTimeChange(Number(e.target.value))}
        />
      </div>
      <div className="timeline-times">
        <span>{formatDate(minTime)}</span>
        <span>{formatDate(maxTime)}</span>
      </div>
    </div>
  );
}

export default Timeline;
