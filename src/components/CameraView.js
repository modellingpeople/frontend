import React, { useRef, useEffect, useCallback } from 'react';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

function formatDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function CameraView({ viewMode, currentTime, warning, frameIndex, onFrameChange, meta }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animRef = useRef(null);

  // Auto-advance frames when a warning is selected
  useEffect(() => {
    if (!warning || !warning.frames) return;
    const numFrames = warning.frames.length;
    let frame = 0;
    onFrameChange(0);

    animRef.current = setInterval(() => {
      frame = (frame + 1) % numFrames;
      onFrameChange(frame);
    }, 1000 / 15); // 15fps playback

    return () => clearInterval(animRef.current);
  }, [warning, onFrameChange]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = '#12151e';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#1e2230';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Get joints to draw
    let joints = null;
    let severityColor = '#5b8def';
    if (warning && warning.frames && warning.frames[frameIndex]) {
      joints = warning.frames[frameIndex].joints_2d;
      severityColor = SEVERITY_COLORS[warning.severity] || '#5b8def';
    }

    if (joints && meta) {
      // Scale joints from 800x600 reference to actual canvas size
      const scaleX = w / 800;
      const scaleY = h / 600;
      const scaled = joints.map(([jx, jy]) => [jx * scaleX, jy * scaleY]);

      // Draw bones
      ctx.strokeStyle = severityColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.6;
      for (const [a, b] of meta.bones) {
        if (scaled[a] && scaled[b]) {
          ctx.beginPath();
          ctx.moveTo(scaled[a][0], scaled[a][1]);
          ctx.lineTo(scaled[b][0], scaled[b][1]);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1.0;

      // Draw joints
      for (let i = 0; i < scaled.length; i++) {
        const [jx, jy] = scaled[i];
        const radius = [15, 0, 12].includes(i) ? 6 : 4; // head, pelvis, neck bigger
        ctx.fillStyle = severityColor;
        ctx.beginPath();
        ctx.arc(jx, jy, radius * Math.min(scaleX, scaleY), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f1117';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Frame counter
      ctx.fillStyle = '#444';
      ctx.font = `${Math.max(10, 11 * Math.min(scaleX, scaleY))}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`Frame ${frameIndex + 1}/${warning.frames.length}`, w - 16, h - 12);
    } else {
      // No warning selected — draw default skeleton
      const scale = Math.min(w / 400, h / 300);
      const cx = w / 2;
      const cy = h / 2 - 20 * scale;

      ctx.strokeStyle = '#5b8def';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.4;

      ctx.beginPath(); ctx.arc(cx, cy - 50 * scale, 18 * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 32 * scale); ctx.lineTo(cx, cy + 40 * scale); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 45 * scale, cy + 10 * scale); ctx.lineTo(cx, cy - 15 * scale); ctx.lineTo(cx + 45 * scale, cy + 10 * scale); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 30 * scale, cy + 80 * scale); ctx.lineTo(cx, cy + 40 * scale); ctx.lineTo(cx + 30 * scale, cy + 80 * scale); ctx.stroke();
      ctx.globalAlpha = 1.0;

      ctx.fillStyle = '#444';
      ctx.font = `${Math.max(12, 14 * scale)}px Segoe UI, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Select a warning to view pose data', cx, h / 2 + 120 * scale);
    }

    // View mode + date label
    ctx.fillStyle = '#555';
    const fontSize = Math.max(11, 13 * Math.min(w / 800, h / 600));
    ctx.font = `${fontSize}px Segoe UI, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`${viewMode === '1st' ? '1st Person' : '3rd Person'} View`, 12, h - 12);
    ctx.textAlign = 'center';
    ctx.fillText(formatDate(currentTime), w / 2, h - 12);
  }, [viewMode, currentTime, warning, frameIndex, meta]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <div className="camera-view" ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export default CameraView;
