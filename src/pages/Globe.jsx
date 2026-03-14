import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, MapPin, Globe as GlobeIcon, Loader2 } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <GlobeIcon className="w-16 h-16 text-cyan-400" />
          </div>
          <h1 className="text-4xl font-bold text-cyan-400 mb-2">Global City Explorer</h1>
          <p className="text-slate-400">Select a city to analyze environmental risks</p>
        </div>

        <Card className="bg-slate-900/95 backdrop-blur border-slate-800 p-6 mb-6 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cities..."
              className="pl-10 bg-slate-800 border-slate-700 text-slate-200 text-lg"
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCities.map(city => (
            <Card
              key={city.id}
              onClick={() => handleCityClick(city)}
              className="bg-slate-900 border-slate-800 p-6 cursor-pointer hover:border-cyan-500 transition-all hover:shadow-lg hover:shadow-cyan-500/20"
            >
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-200 mb-1">{city.name}</h3>
                  <p className="text-sm text-slate-400 mb-2">{city.country}</p>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Pop: {(city.population / 1000000).toFixed(1)}M</div>
                    <div>Climate: {city.climate_zone}</div>
                    <div>{city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°</div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredCities.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">No cities found</p>
          </div>
        )}
      </div>
    </div>
  );
}