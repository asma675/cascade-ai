import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, Loader2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function Globe() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.list(),
  });

  const handleCityClick = (city) => {
    navigate(`/City/${encodeURIComponent(city.name)}`);
  };

  const filteredCities = searchQuery 
    ? cities.filter(city =>
        city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        city.country?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : cities;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-3xl font-bold text-cyan-400 mb-4">Global City Explorer</h1>
        <Card className="bg-slate-900/95 backdrop-blur border-slate-800 p-4 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cities..."
              className="pl-10 bg-slate-800 border-slate-700 text-slate-200"
            />
          </div>
        </Card>
      </div>

      <div className="flex-1 relative">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredCities.map(city => (
            <Marker
              key={city.id}
              position={[city.latitude, city.longitude]}
            >
              <Popup>
                <div className="text-center p-2">
                  <h3 className="font-bold text-lg mb-1">{city.name}</h3>
                  <p className="text-sm text-slate-600 mb-2">{city.country}</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Pop: {(city.population / 1000000).toFixed(1)}M • {city.climate_zone}
                  </p>
                  <button
                    onClick={() => handleCityClick(city)}
                    className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded text-sm font-medium"
                  >
                    Analyze Risks
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}