import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

function SceneModel({ basePath = '/data/', objFile = 'model.obj' }) {
  const groupRef = useRef();

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    const loader = new OBJLoader();
    loader.load(basePath + objFile, (object) => {
      // Center X/Z at origin, align bottom to y=0
      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      object.position.set(-center.x, -center.y + 0.5, -center.z);

      // Load texture and apply
      const texLoader = new THREE.TextureLoader();
      texLoader.load(basePath + 'model.jpg', (texture) => {
        texture.flipY = true;
        const mat = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });
        object.traverse((child) => {
          if (child.isMesh) {
            child.material = mat;
          }
        });
      }, undefined, () => {
        // Fallback if texture fails
        const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
        object.traverse((child) => {
          if (child.isMesh) {
            child.material = mat;
          }
        });
      });

      console.log('[SceneModel] Added to scene. Size:', size);
      group.add(object);
    },
    (progress) => {
      if (progress.total) {
        console.log('[SceneModel] Loading:', Math.round((progress.loaded / progress.total) * 100) + '%');
      }
    },
    (error) => {
      console.error('[SceneModel] Load error:', error);
    });

    return () => {
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }
    };
  }, [basePath, objFile]);

  return <group ref={groupRef} />;
}

export default SceneModel;
