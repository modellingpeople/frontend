import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { captureElement, analyzeWithGemini } from './screenshotUtils';
import BodyMesh from './BodyMesh';
import PointCloudView from './PointCloudView';
import CameraController from './CameraController';

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

function CameraView3D({
  warning,
  frameIndex,
  onFrameChange,
  meshData,
  pointCloud,
  overlayMessage,
  onAnalysisComplete, // Callback to send text to SidebarMonitor
}) {
  const animRef = useRef(null);
  const viewRef = useRef(null);
  
  const [lastScreenshot, setLastScreenshot] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Handlers ---
  
  const handleCapture = async () => {
    const imageData = await captureElement(viewRef.current);
    if (imageData) {
      setLastScreenshot(imageData);
      // Optional: Auto-download to local machine
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `capture-${Date.now()}.png`;
      link.click();
    }
  };

  const handleAICheck = async () => {
    let imageToAnalyze = lastScreenshot;

    // Auto-capture if no screenshot exists
    if (!imageToAnalyze) {
      imageToAnalyze = await captureElement(viewRef.current);
      setLastScreenshot(imageToAnalyze);
    }

    setIsAnalyzing(true);
    // Call the external utility
    const result = await analyzeWithGemini(imageToAnalyze, "analyze this image");
    setIsAnalyzing(false);
    
    // Pass the AI text back up to the parent/sidebar
    if (onAnalysisComplete) {
      onAnalysisComplete(result);
    }
  };

  // --- Animation Logic ---
  useEffect(() => {
    if (!warning || !meshData?.frames?.length) return;
    const meshStart = warning.mesh_frame_start || 0;
    const numFrames = meshData.frames.length - meshStart;
    let frame = 0;
    onFrameChange(0);
    animRef.current = setInterval(() => {
      frame = (frame + 1) % numFrames;
      onFrameChange(frame);
    }, 1000 / 15);
    return () => clearInterval(animRef.current);
  }, [warning, meshData, onFrameChange]);

  // --- 3D Data Memos ---
  const currentMeshFrameIdx = useMemo(() => {
    if (!meshData?.frames?.length) return 0;
    const meshStart = warning ? (warning.mesh_frame_start || 0) : 0;
    return Math.min(meshStart + frameIndex, meshData.frames.length - 1);
  }, [warning, frameIndex, meshData]);

  const currentVerts = useMemo(() => 
    meshData?.frames[currentMeshFrameIdx]?.verts || null
  , [meshData, currentMeshFrameIdx]);

  const meshCentroid = useMemo(() => {
    if (!currentVerts?.length) return [0, 1, 0];
    let cx = 0, cy = 0, cz = 0;
    const step = Math.max(1, Math.floor(currentVerts.length / 50));
    let count = 0;
    for (let i = 0; i < currentVerts.length; i += step) {
      cx += currentVerts[i][0]; cy += currentVerts[i][1]; cz += currentVerts[i][2];
      count++;
    }
    return [cx / count, cy / count, cz / count];
  }, [currentVerts]);

  // --- UI Styles ---
  const buttonStyle = {
    background: '#2a2d3a',
    color: '#fff',
    border: '1px solid #444',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: '600',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  };

  const aiButtonStyle = {
    ...buttonStyle,
    background: isAnalyzing ? '#333' : '#4f46e5',
    border: '1px solid #6366f1',
    cursor: isAnalyzing ? 'not-allowed' : 'pointer',
  };

  return (
    <div ref={viewRef} className="camera-view" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Canvas
        camera={{ fov: 60, near: 0.01, far: 200, position: [1.5, 1, 2.5] }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ background: '#12151e' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        {currentVerts && meshData && (
          <BodyMesh 
            faces={meshData.faces} 
            verts={currentVerts} 
            color={warning ? (SEVERITY_COLORS[warning.severity] || '#5b8def') : '#5b8def'} 
          />
        )}
        {pointCloud && <PointCloudView positions={pointCloud.positions} colors={pointCloud.colors} />}
        <CameraController meshCentroid={meshCentroid} />
        <gridHelper args={[20, 20, '#2a2d3a', '#1e2230']} />
      </Canvas>

      {/* LOWER LEFT CONTROLS */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, display: 'flex', gap: '10px', alignItems: 'center', zIndex: 100 }}>
        
        {lastScreenshot ? (
          <div style={{ position: 'relative' }} onClick={() => setLastScreenshot(null)}>
            <img 
              src={lastScreenshot} 
              alt="Preview" 
              style={{ width: '70px', height: '40px', borderRadius: '4px', border: '2px solid #4f46e5', objectFit: 'cover', cursor: 'pointer' }} 
            />
            <div style={{ position: 'absolute', top: -6, right: -6, background: '#4f46e5', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              ✕
            </div>
          </div>
        ) : (
          <button style={buttonStyle} onClick={handleCapture}>
            📸 Take Screenshot
          </button>
        )}

        <button style={aiButtonStyle} onClick={handleAICheck} disabled={isAnalyzing}>
          {isAnalyzing ? "⌛ Analyzing..." : "✨ AI Check"}
        </button>
      </div>

      {/* Frame Counter */}
      {meshData?.frames?.length > 0 && (
        <div style={{ position: 'absolute', bottom: 12, right: 16, color: '#888', fontFamily: 'monospace', fontSize: 11, pointerEvents: 'none' }}>
          Frame {currentMeshFrameIdx + 1} / {meshData.frames.length}
        </div>
      )}
    </div>
  );
}

export default CameraView3D;