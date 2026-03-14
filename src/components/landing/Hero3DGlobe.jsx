import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import * as THREE from 'three';

function RotatingGlobe() {
  const meshRef = useRef();
  const cloudsRef = useRef();

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.0015;
    }
  });

  return (
    <group>
      {/* Earth */}
      <Sphere ref={meshRef} args={[2.5, 64, 64]}>
        <meshStandardMaterial
          map={new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')}
          bumpMap={new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-topology.png')}
          bumpScale={0.05}
        />
      </Sphere>
      
      {/* Clouds */}
      <Sphere ref={cloudsRef} args={[2.52, 64, 64]}>
        <meshStandardMaterial
          map={new THREE.TextureLoader().load('https://unpkg.com/three-globe/example/img/earth-clouds.png')}
          transparent
          opacity={0.4}
        />
      </Sphere>

      {/* Atmosphere glow */}
      <Sphere args={[2.6, 64, 64]}>
        <meshBasicMaterial
          color="#4fc3f7"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  );
}

export default function Hero3DGlobe() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 3, 5]} intensity={1} />
        <RotatingGlobe />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}