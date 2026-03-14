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
          onChange={e => {
            const newTime = Number(e.target.value);
            onTimeChange(newTime);
            if (warnings.length > 0) {
              let closest = warnings[0];
              let closestDist = Math.abs(new Date(closest.timestamp).getTime() - newTime);
              for (let i = 1; i < warnings.length; i++) {
                const dist = Math.abs(new Date(warnings[i].timestamp).getTime() - newTime);
                if (dist < closestDist) {
                  closest = warnings[i];
                  closestDist = dist;
                }
              }
              onMarkerClick(closest);
            }
          }}
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
