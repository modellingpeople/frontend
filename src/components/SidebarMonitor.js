import React, { useMemo } from 'react';

const TAB_LABELS = {
  safety: 'Safety Monitor',
  elder_care: 'Elder Care Monitor',
  rehab_fitness: 'Rehab Monitor',
  inference: 'Inference Monitor',
};

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];

function getRiskScore(warning) {
  if (!warning) return 0;
  const ranges = { critical: [9, 10], high: [7, 8], medium: [4, 6], low: [1, 3] };
  const [min, max] = ranges[warning.severity] || [1, 3];
  const seed = (warning.id || warning.timestamp || '').toString();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return min + (Math.abs(hash) % (max - min + 1));
}

function getRiskLevel(score) {
  if (score >= 9) return { label: 'Critical', color: '#ef4444' };
  if (score >= 7) return { label: 'High', color: '#f97316' };
  if (score >= 4) return { label: 'Medium', color: '#eab308' };
  return { label: 'Low', color: '#3b82f6' };
}

function RiskMeter({ score }) {
  const { label, color } = getRiskLevel(score);
  const fraction = score / 10;

  // Arc geometry: 180° semicircle from left to right
  const cx = 60, cy = 55, r = 40, strokeW = 8;
  const startAngle = Math.PI;       // left (180°)
  const endAngle = 0;               // right (0°)
  const totalAngle = Math.PI;       // 180° sweep

  // Full arc path (background)
  const bgX1 = cx + r * Math.cos(startAngle);
  const bgY1 = cy - r * Math.sin(startAngle);
  const bgX2 = cx + r * Math.cos(endAngle);
  const bgY2 = cy - r * Math.sin(endAngle);
  const bgPath = `M ${bgX1} ${bgY1} A ${r} ${r} 0 0 1 ${bgX2} ${bgY2}`;

  // Gradient arc — built from color stops via segments
  const arcSegments = [
    { from: 0, to: 0.3, color: '#3b82f6' },
    { from: 0.3, to: 0.6, color: '#eab308' },
    { from: 0.6, to: 0.8, color: '#f97316' },
    { from: 0.8, to: 1.0, color: '#ef4444' },
  ];

  const filledSegments = arcSegments
    .filter(s => s.from < fraction)
    .map(s => {
      const segStart = s.from;
      const segEnd = Math.min(s.to, fraction);
      const a1 = startAngle - segStart * totalAngle;
      const a2 = startAngle - segEnd * totalAngle;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy - r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy - r * Math.sin(a2);
      const sweep = (segEnd - segStart) * totalAngle;
      const largeArc = sweep > Math.PI ? 1 : 0;
      return { path: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, color: s.color };
    });

  // Needle position
  const needleAngle = startAngle - fraction * totalAngle;
  const needleLen = r - 12;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);

  return (
    <div className="risk-meter">
      <svg viewBox="0 0 120 70" className="risk-meter-arc">
        {/* Background track */}
        <path d={bgPath} fill="none" stroke="#2a2d3a" strokeWidth={strokeW} strokeLinecap="round" />
        {/* Colored fill segments */}
        {filledSegments.map((seg, i) => (
          <path key={i} d={seg.path} fill="none" stroke={seg.color} strokeWidth={strokeW} strokeLinecap="butt" />
        ))}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3" fill="#e0e0e0" />
        {/* Score text */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill="#e0e0e0" fontSize="14" fontWeight="700">
          {score}
        </text>
        {/* Min/Max labels */}
        <text x={cx - r - 2} y={cy + 12} textAnchor="middle" fill="#555" fontSize="8">0</text>
        <text x={cx + r + 2} y={cy + 12} textAnchor="middle" fill="#555" fontSize="8">10</text>
      </svg>
      <div className="risk-meter-label-row">
        <span className="risk-meter-level" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function DonutChart({ counts, total }) {
  const radius = 40;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = SEVERITY_ORDER
    .filter(s => counts[s] > 0)
    .map(s => {
      const fraction = counts[s] / total;
      const dashLength = fraction * circumference;
      const seg = { severity: s, dashLength, offset };
      offset += dashLength;
      return seg;
    });

  return (
    <svg viewBox="0 0 100 100" className="donut-chart">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#2a2d3a" strokeWidth={stroke} />
      {segments.map(seg => (
        <circle
          key={seg.severity}
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={SEVERITY_COLORS[seg.severity]}
          strokeWidth={stroke}
          strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
          strokeDashoffset={-seg.offset}
          strokeLinecap="butt"
          transform="rotate(-90 50 50)"
        />
      ))}
      <text x="50" y="46" textAnchor="middle" fill="#e0e0e0" fontSize="14" fontWeight="700">
        {total}
      </text>
      <text x="50" y="58" textAnchor="middle" fill="#888" fontSize="7">
        total
      </text>
    </svg>
  );
}

function SidebarMonitor({
  warnings,
  allWarnings,
  selectedWarning,
  activeTab,
  titleOverride,
  emptyMessage = 'Select a warning on the timeline',
}) {
  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    (warnings || []).forEach(w => { if (c[w.severity] !== undefined) c[w.severity]++; });
    return c;
  }, [warnings]);

  const total = warnings ? warnings.length : 0;

  const safetyScore = useMemo(() => {
    const raw = 100 - (counts.critical * 15 + counts.high * 8 + counts.medium * 3 + counts.low * 1);
    return Math.max(0, Math.min(100, raw));
  }, [counts]);

  const riskScore = useMemo(() => getRiskScore(selectedWarning), [selectedWarning]);

  return (
    <div className="sidebar-monitor">
      {/* Stats Panel */}
      <div className="sidebar-panel sidebar-stats">
        <h2 className="sidebar-title">{titleOverride || TAB_LABELS[activeTab] || 'Monitor'}</h2>

        <DonutChart counts={counts} total={total} />

        <div className="severity-breakdown">
          {SEVERITY_ORDER.map(s => (
            <div key={s} className="severity-row">
              <span className="severity-dot" style={{ background: SEVERITY_COLORS[s] }} />
              <span className="severity-label">{s}</span>
              <span className="severity-count">{counts[s]}</span>
            </div>
          ))}
        </div>

        <div className="safety-score">
          <span className="safety-score-label">Safety Score</span>
          <span className={`safety-score-value ${safetyScore >= 70 ? 'good' : safetyScore >= 40 ? 'warn' : 'bad'}`}>
            {safetyScore}
          </span>
        </div>
      </div>

      {/* Selected Warning Detail */}
      <div className="sidebar-panel sidebar-detail">
        {selectedWarning ? (
          <>
            <div className="detail-header">
              <span className={`severity-badge ${selectedWarning.severity}`}>
                {selectedWarning.severity}
              </span>
            </div>
            <RiskMeter score={riskScore} />
            <div className="detail-meta">
              <span className="warning-timestamp">{formatTimestamp(selectedWarning.timestamp)}</span>
              <span className="warning-person">{selectedWarning.person}</span>
            </div>
            <p className="warning-text">{selectedWarning.text}</p>
          </>
        ) : (
          <p className="sidebar-empty">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

export default SidebarMonitor;
