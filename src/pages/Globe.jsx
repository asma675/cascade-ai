import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import EarthGlobe from '@/components/globe/EarthGlobe';
import CityMarkers from '@/components/globe/CityMarkers';
import GlobeControls from '@/components/globe/GlobeControls';
import { Loader2 } from 'lucide-react';

export default function Globe() {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.list(),
  });

  const handleCityClick = (city) => {
    setSelectedCity(city);
    navigate(`/City/${encodeURIComponent(city.name)}`);
  };

  const filteredCities = cities.filter(city =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    city.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 relative overflow-hidden">
      <GlobeControls 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        cities={filteredCities}
        onCitySelect={handleCityClick}
      />

      <Canvas camera={{ position: [0, 0, 3], fov: 45 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <EarthGlobe />
          <CityMarkers cities={filteredCities} onCityClick={handleCityClick} />
          <OrbitControls 
            enablePan={false}
            minDistance={1.5}
            maxDistance={5}
            rotateSpeed={0.5}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}