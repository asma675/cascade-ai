import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Interactive3DGlobe() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const globeRef = useRef(null);
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const targetRotationX = useRef(0);
  const targetRotationY = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 2.5;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create globe
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Create canvas texture for globe
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    // Blue ocean
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Landmasses
    ctx.fillStyle = '#1e293b';
    // Simple landmass patterns
    const landPatterns = [
      { x: 400, y: 300, w: 250, h: 150 }, // North America
      { x: 1200, y: 280, w: 280, h: 200 }, // Europe/Africa
      { x: 1600, y: 350, w: 200, h: 180 }, // Asia
    ];
    landPatterns.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      emissive: 0x2a3f6f,
      shininess: 5
    });

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);
    globeRef.current = globe;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xa78bfa, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Glow effect
    const glowGeometry = new THREE.SphereGeometry(1.05, 64, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.1
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    globe.add(glow);

    // Mouse move listener
    const onMouseMove = (event) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      mouseX.current = (event.clientX - rect.left) / rect.width * 2 - 1;
      mouseY.current = -(event.clientY - rect.top) / rect.height * 2 + 1;
      
      targetRotationY.current = mouseX.current * Math.PI * 0.5;
      targetRotationX.current = mouseY.current * Math.PI * 0.3;
    };

    window.addEventListener('mousemove', onMouseMove);

    // Handle resize
    const onWindowResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', onWindowResize);

    // Animation loop
    let animationId;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      // Smooth rotation
      if (globe) {
        globe.rotation.x += (targetRotationX.current - globe.rotation.x) * 0.05;
        globe.rotation.y += (targetRotationY.current - globe.rotation.y) * 0.05;
        globe.rotation.z += 0.0001; // Slow continuous rotation
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onWindowResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}