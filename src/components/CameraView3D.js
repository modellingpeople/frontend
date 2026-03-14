import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
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
  viewMode,
  warning,
  frameIndex,
  onFrameChange,
  meshData,
  pointCloud,
  cameraData,
}) {
  const animRef = useRef(null);

  // Auto-advance frames when a warning is selected
  useEffect(() => {
    if (!warning || !meshData || !meshData.frames || meshData.frames.length === 0) return;

    const meshStart = warning.mesh_frame_start || 0;
    const totalMeshFrames = meshData.frames.length;
    const numFrames = totalMeshFrames - meshStart;

    if (numFrames <= 0) return;

    let frame = 0;
    onFrameChange(0);

    animRef.current = setInterval(() => {
      frame = (frame + 1) % numFrames;
      onFrameChange(frame);
    }, 1000 / 15); // 15fps

    return () => clearInterval(animRef.current);
  }, [warning, meshData, onFrameChange]);

  // Pre-flatten all frame vertices into Float32Arrays once on data load
  const flattenedFrames = useMemo(() => {
    if (!meshData || !meshData.frames) return null;
    return meshData.frames.map((frame) => {
      const verts = frame.verts;
      const arr = new Float32Array(verts.length * 3);
      for (let i = 0; i < verts.length; i++) {
        arr[i * 3] = verts[i][0];
        arr[i * 3 + 1] = verts[i][1];
        arr[i * 3 + 2] = verts[i][2];
      }
      return arr;
    });
  }, [meshData]);

  // Get current mesh frame index
  const currentMeshFrameIdx = useMemo(() => {
    if (!meshData || !meshData.frames) return 0;
    if (!warning) return 0;
    const meshStart = warning.mesh_frame_start || 0;
    return Math.min(meshStart + frameIndex, meshData.frames.length - 1);
  }, [warning, frameIndex, meshData]);

  // Current frame verts (as nested array for BodyMesh)
  const currentVerts = useMemo(() => {
    if (!meshData || !meshData.frames[currentMeshFrameIdx]) return null;
    return meshData.frames[currentMeshFrameIdx].verts;
  }, [meshData, currentMeshFrameIdx]);

  // Mesh centroid — compute from first frame once, then update from current
  const initialCentroid = useMemo(() => {
    if (!meshData || !meshData.frames || !meshData.frames[0]) return null;
    const verts = meshData.frames[0].verts;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < verts.length; i++) {
      cx += verts[i][0];
      cy += verts[i][1];
      cz += verts[i][2];
    }
    return [cx / verts.length, cy / verts.length, cz / verts.length];
  }, [meshData]);

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

  // Debug logging
  useEffect(() => {
    console.log('[3D] meshCentroid:', meshCentroid);
    console.log('[3D] currentVerts count:', currentVerts ? currentVerts.length : 0);
    console.log('[3D] faces count:', meshData ? meshData.faces.length : 0);
    console.log('[3D] point cloud count:', pointCloud ? pointCloud.positions.length : 0);
  }, [meshCentroid, currentVerts, meshData, pointCloud]);

  // Severity color
  const severityColor = warning
    ? (SEVERITY_COLORS[warning.severity] || '#5b8def')
    : '#5b8def';

  // Current camera pose
  const currentCameraPose = useMemo(() => {
    if (!cameraData || !cameraData.frames || !cameraData.frames[currentMeshFrameIdx]) {
      return null;
    }
    return cameraData.frames[currentMeshFrameIdx];
  }, [cameraData, currentMeshFrameIdx]);

  return (
    <div className="camera-view">
      <Canvas
        camera={{ fov: 60, near: 0.01, far: 200, position: [1.5, 1, 2.5] }}
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

        {pointCloud && (
          <PointCloudView
            positions={pointCloud.positions}
            colors={pointCloud.colors}
          />
        )}

        <CameraController
          viewMode={viewMode}
          cameraPose={currentCameraPose}
          meshCentroid={meshCentroid}
        />

        <axesHelper args={[5]} />
        <gridHelper args={[20, 20, '#2a2d3a', '#1e2230']} />
      </Canvas>

      {/* Overlay: frame counter */}
      {warning && meshData && meshData.frames && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 16,
          color: '#444',
          fontFamily: 'monospace',
          fontSize: 11,
          pointerEvents: 'none',
        }}>
          Frame {frameIndex + 1}/{meshData.frames.length}
        </div>
      )}

      {!warning && (
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
          Select a warning to view 3D pose
        </div>
      )}
    </div>
  );
}

export default CameraView3D;
