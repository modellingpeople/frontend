import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';

function BodyMesh({ faces, verts, color }) {
  const meshRef = useRef();
  const geomRef = useRef();

  // Build index buffer once from faces
  const indexArray = useMemo(() => {
    if (!faces) return null;
    return new Uint32Array(faces.flat());
  }, [faces]);

  // Pre-flatten verts into Float32Array
  const flatVerts = useMemo(() => {
    if (!verts) return null;
    const arr = new Float32Array(verts.length * 3);
    for (let i = 0; i < verts.length; i++) {
      arr[i * 3] = verts[i][0];
      arr[i * 3 + 1] = verts[i][1];
      arr[i * 3 + 2] = verts[i][2];
    }
    return arr;
  }, [verts]);

  // Set up geometry on mount
  useEffect(() => {
    if (!geomRef.current || !indexArray || !flatVerts) return;
    const geom = geomRef.current;
    geom.setIndex(new THREE.BufferAttribute(indexArray, 1));
    geom.setAttribute('position', new THREE.BufferAttribute(flatVerts, 3));
    geom.computeVertexNormals();
  }, [indexArray, flatVerts]);

  // Update position attribute when verts change (subsequent frames)
  useEffect(() => {
    if (!geomRef.current || !flatVerts) return;
    const geom = geomRef.current;
    const posAttr = geom.getAttribute('position');
    if (posAttr && posAttr.array !== flatVerts) {
      posAttr.copyArray(flatVerts);
      posAttr.needsUpdate = true;
      geom.computeVertexNormals();
    }
  }, [flatVerts]);

  return (
    <mesh ref={meshRef}>
      <bufferGeometry ref={geomRef} />
      <meshStandardMaterial
        color={color || '#5b8def'}
        roughness={0.6}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default BodyMesh;
