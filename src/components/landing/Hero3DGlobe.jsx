import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';

function RotatingGlobe() {
  const meshRef = useRef();
  const cloudsRef = useRef();

  const earthTexture = useTexture('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const earthBump = useTexture('https://unpkg.com/three-globe/example/img/earth-topology.png');
  const cloudsTexture = useTexture('https://unpkg.com/three-globe/example/img/earth-clouds.png');

  useFrame(() => {
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
          map={earthTexture}
          bumpMap={earthBump}
          bumpScale={0.05}
        />
      </Sphere>
      
      {/* Clouds */}
      <Sphere ref={cloudsRef} args={[2.52, 64, 64]}>
        <meshStandardMaterial
          map={cloudsTexture}
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

function LoadingFallback() {
  return (
    <Sphere args={[2.5, 32, 32]}>
      <meshStandardMaterial color="#0ea5e9" wireframe />
    </Sphere>
  );
}

export default function Hero3DGlobe() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 3, 5]} intensity={1} />
        <Suspense fallback={<LoadingFallback />}>
          <RotatingGlobe />
        </Suspense>
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