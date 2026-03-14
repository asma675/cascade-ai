import React from 'react';
import { Html } from '@react-three/drei';

function latLonToVector3(lat, lon, radius = 1.01) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return [x, y, z];
}

function CityMarker({ city, onClick }) {
  const position = latLonToVector3(city.latitude, city.longitude);
  
  return (
    <group position={position} onClick={() => onClick(city)}>
      <mesh>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshBasicMaterial color="#00d4ff" />
      </mesh>
      <Html distanceFactor={10}>
        <div className="bg-slate-900/90 border border-cyan-500/50 rounded px-2 py-1 text-xs text-cyan-300 whitespace-nowrap pointer-events-none">
          {city.name}
        </div>
      </Html>
    </group>
  );
}

export default function CityMarkers({ cities, onCityClick }) {
  return (
    <>
      {cities.map((city) => (
        <CityMarker key={city.id} city={city} onClick={onCityClick} />
      ))}
    </>
  );
}