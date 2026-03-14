import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function CameraController({ viewMode, cameraPose, meshCentroid }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const isFirstPerson = viewMode === '1st';
  const initializedRef = useRef(false);

  // Set initial camera position once when we first get a valid centroid
  useEffect(() => {
    if (initializedRef.current || !meshCentroid) return;
    initializedRef.current = true;

    const [cx, cy, cz] = meshCentroid;
    camera.position.set(cx + 2, cy + 1.5, cz + 2);
    camera.lookAt(cx, cy, cz);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.set(cx, cy, cz);
      controlsRef.current.update();
    }
  }, [meshCentroid, camera]);

  // Update orbit target to follow centroid (smoothly, without resetting camera position)
  useEffect(() => {
    if (!controlsRef.current || !meshCentroid || isFirstPerson) return;
    controlsRef.current.target.set(
      meshCentroid[0], meshCentroid[1], meshCentroid[2]
    );
    controlsRef.current.update();
  }, [meshCentroid, isFirstPerson]);

  // 1st person: update camera from pose data each frame
  useFrame(() => {
    if (!isFirstPerson || !cameraPose) return;
    camera.position.set(cameraPose.x, cameraPose.y, cameraPose.z);
    camera.quaternion.set(cameraPose.qx, cameraPose.qy, cameraPose.qz, cameraPose.qw);
  });

  if (isFirstPerson) return null;

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      minDistance={0.5}
      maxDistance={20}
    />
  );
}

export default CameraController;
