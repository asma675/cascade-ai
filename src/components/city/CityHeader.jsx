import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function CityHeader({ city, assessment }) {
  const handleExportGeoJSON = () => {
    const geojson = {
      type: "FeatureCollection",
      features: assessment.hazards_detected.map((hazard, idx) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [city.longitude, city.latitude]
        },
        properties: {
          hazard_type: hazard.type,
          severity: hazard.severity,
          score: hazard.score
        }
      }))
    };
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${city.name}_risk_assessment.geojson`;
    a.click();
    toast.success('GeoJSON exported');
  };

  const criticalHazards = assessment.hazards_detected.filter(h => 
    h.severity === 'severe' || h.severity === 'extreme'
  );

  return (
    <div className="bg-slate-900 border-b border-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link to="/Globe">
            <Button variant="ghost" className="text-slate-400 hover:text-cyan-400">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Globe
            </Button>
          </Link>
          
          <Button onClick={handleExportGeoJSON} className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white shadow-lg shadow-purple-500/30">
            <Download className="w-4 h-4 mr-2" />
            Export GeoJSON
          </Button>
        </div>

        <h1 className="text-4xl font-bold text-cyan-400 mb-2">{city.name}, {city.country}</h1>
        <p className="text-slate-400 mb-4">
          {city.latitude.toFixed(4)}°, {city.longitude.toFixed(4)}° • Population: {(city.population / 1000000).toFixed(2)}M • Elevation: {city.elevation}m
        </p>

        {criticalHazards.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-300 font-semibold mb-1">Critical Hazards Detected</h3>
              <p className="text-red-200 text-sm">
                {criticalHazards.map(h => h.type).join(', ')} — Immediate attention required
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}