import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

function PointCloudView({ positions, colors }) {
  const pointsRef = useRef();

  const { posArray, colorArray } = useMemo(() => {
    if (!positions || positions.length === 0) {
      return { posArray: null, colorArray: null };
    }

    const n = positions.length;
    const posArr = new Float32Array(n * 3);
    const colArr = new Float32Array(n * 3);

    for (let i = 0; i < n; i++) {
      posArr[i * 3] = positions[i][0];
      posArr[i * 3 + 1] = positions[i][1];
      posArr[i * 3 + 2] = positions[i][2];

      // colors are 0-255, normalize to 0-1
      if (colors && colors[i]) {
        colArr[i * 3] = colors[i][0] / 255;
        colArr[i * 3 + 1] = colors[i][1] / 255;
        colArr[i * 3 + 2] = colors[i][2] / 255;
      } else {
        colArr[i * 3] = 0.7;
        colArr[i * 3 + 1] = 0.7;
        colArr[i * 3 + 2] = 0.7;
      }
    }

    return { posArray: posArr, colorArray: colArr };
  }, [positions, colors]);

  useEffect(() => {
    if (!pointsRef.current || !posArray) return;
    const geom = pointsRef.current.geometry;
    geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    geom.computeBoundingSphere();
  }, [posArray, colorArray]);

  if (!posArray) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry />
      <pointsMaterial
        vertexColors
        size={0.02}
        sizeAttenuation
      />
    </points>
  );
}

export default PointCloudView;
