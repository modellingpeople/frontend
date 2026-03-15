import React, { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function CameraController({ meshCentroid }) {
  const controlsRef = useRef();
  const { camera } = useThree();
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

  // Update orbit target to follow centroid
  useEffect(() => {
    if (!controlsRef.current || !meshCentroid) return;
    controlsRef.current.target.set(
      meshCentroid[0], meshCentroid[1], meshCentroid[2]
    );
    controlsRef.current.update();
  }, [meshCentroid]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      minDistance={0.5}
      maxDistance={500}
    />
  );
}

export default CameraController;
