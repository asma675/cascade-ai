import React from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, MapPin } from 'lucide-react';

export default function GlobeControls({ searchQuery, setSearchQuery, cities, onCitySelect }) {
  const displayedCities = searchQuery ? cities.slice(0, 10) : [];

  return (
    <div className="absolute top-6 left-6 z-10 w-96">
      <Card className="bg-slate-900/95 backdrop-blur border-slate-800 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cities..."
            className="pl-10 bg-slate-800 border-slate-700 text-slate-200"
          />
        </div>

        {displayedCities.length > 0 && (
          <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
            {displayedCities.map(city => (
              <button
                key={city.id}
                onClick={() => onCitySelect(city)}
                className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <MapPin className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-slate-200 font-medium">{city.name}</div>
                  <div className="text-xs text-slate-500">{city.country} • Pop: {(city.population / 1000000).toFixed(1)}M</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}