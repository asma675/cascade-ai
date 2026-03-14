import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Card } from '@/components/ui/card';
import { MapPin, Thermometer, Droplets, Wind, Flame } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function CityMap({ city, assessment }) {
  const hazardColors = {
    heatwave: '#ef4444',
    drought: '#f59e0b',
    flood: '#3b82f6',
    wildfire: '#f97316',
    air_quality: '#a855f7',
    high_wind: '#06b6d4'
  };

  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
        <MapPin className="w-6 h-6" />
        Hazard Map
      </h2>

      <div className="relative rounded-lg h-96 overflow-hidden">
        <MapContainer
          center={[city.latitude, city.longitude]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <Marker position={[city.latitude, city.longitude]}>
            <Popup>
              <div className="text-center p-2">
                <h3 className="font-bold text-lg">{city.name}</h3>
                <p className="text-sm text-slate-600">{city.country}</p>
              </div>
            </Popup>
          </Marker>

          {assessment.hazards_detected.map((hazard, idx) => (
            <Circle
              key={idx}
              center={[city.latitude, city.longitude]}
              radius={5000 + (idx * 2000)}
              pathOptions={{
                color: hazardColors[hazard.type] || '#64748b',
                fillColor: hazardColors[hazard.type] || '#64748b',
                fillOpacity: 0.2,
                weight: 2
              }}
            >
              <Popup>
                <div className="p-2">
                  <h4 className="font-bold capitalize">{hazard.type.replace('_', ' ')}</h4>
                  <p className="text-sm">Severity: {hazard.severity}</p>
                  <p className="text-sm">Score: {hazard.score}/10</p>
                  <p className="text-xs text-slate-600 mt-1">{hazard.index}: {hazard.value}</p>
                </div>
              </Popup>
            </Circle>
          ))}
        </MapContainer>

        {/* Hazard overlay indicators */}
        <div className="absolute bottom-4 left-4 space-y-2 z-[1000]">
          {assessment.hazards_detected.map((hazard, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-700">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hazardColors[hazard.type] || '#64748b' }}></div>
              <span className="text-slate-200 text-sm font-medium capitalize">{hazard.type.replace('_', ' ')}</span>
              <span className="text-xs text-slate-400">({hazard.severity})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hazard Data Grid */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: <Thermometer className="w-5 h-5" />, label: 'Heat', type: 'heatwave', color: 'text-red-400' },
          { icon: <Droplets className="w-5 h-5" />, label: 'Precip', type: 'drought', color: 'text-blue-400' },
          { icon: <Wind className="w-5 h-5" />, label: 'Wind', type: 'high_wind', color: 'text-cyan-400' },
          { icon: <Flame className="w-5 h-5" />, label: 'Fire', type: 'wildfire', color: 'text-orange-400' },
          { icon: <div className="w-5 h-5 rounded bg-purple-400" />, label: 'AQI', type: 'air_quality', color: 'text-purple-400' }
        ].map((item, idx) => {
          const hazard = assessment.hazards_detected.find(h => h.type === item.type);
          return (
            <div key={idx} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <span className={item.color}>{item.icon}</span>
                <span className="text-xs font-semibold uppercase text-slate-400">{item.label}</span>
              </div>
              {hazard ? (
                <div>
                  <div className="text-lg font-bold text-slate-100">{hazard.value}</div>
                  <div className="text-xs text-slate-400 mt-1">{hazard.index}</div>
                  <div className="text-xs text-slate-500 mt-2">Severity: <span className="text-slate-300 font-medium">{hazard.severity}</span></div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">No data</div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}