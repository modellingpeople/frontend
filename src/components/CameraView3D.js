import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import BodyMesh from './BodyMesh';

import CameraController from './CameraController';
import SceneModel from './SceneModel';

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
  cameraData,
  overlayMessage,
}) {
  const animRef = useRef(null);
  const meshFrames = useMemo(() => {
    const frames = meshData?.frames;
    if (!Array.isArray(frames) || frames.length === 0) {
      return [];
    }

    // Some payloads can arrive with frame entries out of order.
    // Normalize to ascending frame_num so playback always moves forward.
    const hasFrameNumbers = frames.every((frame) => Number.isFinite(frame?.frame_num));
    if (!hasFrameNumbers) {
      return frames;
    }

    return [...frames].sort((a, b) => a.frame_num - b.frame_num);
  }, [meshData]);

  // Auto-advance frames when a warning is selected
  useEffect(() => {
    if (!warning || meshFrames.length === 0) return;

    const meshStart = warning.mesh_frame_start || 0;
    const totalMeshFrames = meshFrames.length;
    const numFrames = totalMeshFrames - meshStart;

    if (numFrames <= 0) return;

    let frame = 0;
    onFrameChange(0);

    animRef.current = setInterval(() => {
      frame = (frame + 1) % numFrames;
      onFrameChange(frame);
    }, 1000 / 15); // 15fps

    return () => clearInterval(animRef.current);
  }, [warning, meshFrames, onFrameChange]);

  // Get current mesh frame index
  const currentMeshFrameIdx = useMemo(() => {
    if (meshFrames.length === 0) return 0;
    if (!warning) {
      return Math.min(frameIndex, meshFrames.length - 1);
    }
    const meshStart = warning.mesh_frame_start || 0;
    return Math.min(meshStart + frameIndex, meshFrames.length - 1);
  }, [warning, frameIndex, meshFrames]);

  // Current frame verts (as nested array for BodyMesh)
  const currentVerts = useMemo(() => {
    if (!meshFrames[currentMeshFrameIdx]) return null;
    return meshFrames[currentMeshFrameIdx].verts;
  }, [meshFrames, currentMeshFrameIdx]);

  // Mesh centroid — compute from first frame once, then update from current
  const initialCentroid = useMemo(() => {
    if (!meshFrames[0]) return null;
    const verts = meshFrames[0].verts;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < verts.length; i++) {
      cx += verts[i][0];
      cy += verts[i][1];
      cz += verts[i][2];
    }
    return [cx / verts.length, cy / verts.length, cz / verts.length];
  }, [meshFrames]);

  const meshCentroid = useMemo(() => {
    if (!currentVerts || currentVerts.length === 0) return initialCentroid || [0, 1, 0];
    let cx = 0, cy = 0, cz = 0;
    const step = Math.max(1, Math.floor(currentVerts.length / 69));
    let count = 0;
    for (let i = 0; i < currentVerts.length; i += step) {
      cx += currentVerts[i][0];
      cy += currentVerts[i][1];
      cz += currentVerts[i][2];
      count++;
    }
    return [cx / count, cy / count, cz / count];
  }, [currentVerts, initialCentroid]);

  // Severity color
  const severityColor = warning
    ? (SEVERITY_COLORS[warning.severity] || '#5b8def')
    : '#5b8def';

  return (
    <div className="camera-view">
      <Canvas
        camera={{ fov: 60, near: 0.01, far: 1000, position: [0, 5, 20] }}
        gl={{ antialias: true }}
        style={{ background: '#12151e' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <directionalLight position={[-3, 5, -5]} intensity={0.3} />

        {currentVerts && meshData && (
          <BodyMesh
            faces={meshData.faces}
            verts={currentVerts}
            color={severityColor}
          />
        )}


        <CameraController
          meshCentroid={meshCentroid}
        />

        <SceneModel />

      </Canvas>

      {/* Overlay: frame counter */}
      {meshFrames.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 16,
          color: '#444',
          fontFamily: 'monospace',
          fontSize: 11,
          pointerEvents: 'none',
        }}>
          Frame {currentMeshFrameIdx + 1}/{meshFrames.length}
        </div>
      )}

      {!warning && overlayMessage && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#444',
          fontSize: 14,
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          pointerEvents: 'none',
          textAlign: 'center',
        }}>
          {overlayMessage}
        </div>
      )}
    </div>
  );
}

export default CameraView3D;
