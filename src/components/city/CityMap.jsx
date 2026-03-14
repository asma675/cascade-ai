import React from 'react';
import { Card } from '@/components/ui/card';
import { MapPin, Thermometer, Droplets, Wind, Flame } from 'lucide-react';

export default function CityMap({ city, assessment }) {
  const hazardColors = {
    heatwave: 'bg-red-500',
    drought: 'bg-amber-500',
    flood: 'bg-blue-500',
    wildfire: 'bg-orange-500',
    air_quality: 'bg-purple-500'
  };

  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
        <MapPin className="w-6 h-6" />
        Hazard Map
      </h2>

      <div className="relative bg-slate-800 rounded-lg h-96 overflow-hidden">
        {/* Map placeholder - in production would use Mapbox GL JS */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-16 h-16 text-cyan-400 mx-auto mb-2" />
            <p className="text-slate-400">Map centered on {city.name}</p>
            <p className="text-xs text-slate-500 mt-1">{city.latitude.toFixed(4)}°, {city.longitude.toFixed(4)}°</p>
          </div>
        </div>

        {/* Hazard overlay indicators */}
        <div className="absolute bottom-4 left-4 space-y-2">
          {assessment.hazards_detected.map((hazard, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-700">
              <div className={`w-3 h-3 rounded-full ${hazardColors[hazard.type] || 'bg-slate-500'}`}></div>
              <span className="text-slate-200 text-sm font-medium">{hazard.type}</span>
              <span className="text-xs text-slate-400">({hazard.severity})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hazard Legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="flex items-center gap-2">
          <Thermometer className="w-5 h-5 text-red-400" />
          <span className="text-sm text-slate-300">Heat</span>
        </div>
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-400" />
          <span className="text-sm text-slate-300">Precip</span>
        </div>
        <div className="flex items-center gap-2">
          <Wind className="w-5 h-5 text-cyan-400" />
          <span className="text-sm text-slate-300">Wind</span>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <span className="text-sm text-slate-300">Fire</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-purple-400" />
          <span className="text-sm text-slate-300">AQI</span>
        </div>
      </div>
    </Card>
  );
}