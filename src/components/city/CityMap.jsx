import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Rectangle, useMapEvents } from 'react-leaflet';
import { Card } from '@/components/ui/card';
import { MapPin, Square, Circle as CircleIcon } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

export default function CityMap({ city, assessment }) {
  const [radius, setRadius] = useState(500); // Default 500m
  const [shape, setShape] = useState('circle'); // 'circle' or 'square'
  const [selectedPoint, setSelectedPoint] = useState(null);

  const handleMapClick = (latlng) => {
    setSelectedPoint([latlng.lat, latlng.lng]);
  };

  // Calculate square bounds for Rectangle
  const getSquareBounds = () => {
    const latOffset = radius / 111320; // meters to degrees latitude
    const lngOffset = radius / (111320 * Math.cos(selectedPoint[0] * Math.PI / 180)); // meters to degrees longitude
    
    return [
      [selectedPoint[0] - latOffset, selectedPoint[1] - lngOffset],
      [selectedPoint[0] + latOffset, selectedPoint[1] + lngOffset]
    ];
  };

  return (
    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6">
      <h2 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-4 flex items-center gap-2">
        <MapPin className="w-6 h-6" />
        Area Selection
      </h2>

      {/* Controls */}
      <div className="mb-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
            Radius: {radius} m
          </label>
          <Slider
            value={[radius]}
            onValueChange={(val) => setRadius(val[0])}
            min={50}
            max={1000}
            step={50}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
            <span>50 m</span>
            <span>500 m</span>
            <span>1000 m</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShape('circle')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-colors ${
              shape === 'circle'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-purple-600'
            }`}
          >
            <CircleIcon className="w-4 h-4" />
            Circle
          </button>
          <button
            onClick={() => setShape('square')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-colors ${
              shape === 'square'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-purple-600'
            }`}
          >
            <Square className="w-4 h-4" />
            Square
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Click anywhere on the map to select a specific area within {city.name}
        </p>
      </div>

      <div className="relative rounded-lg h-96 overflow-hidden border border-slate-200 dark:border-slate-700">
        <MapContainer
          center={[city.latitude, city.longitude]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapClickHandler onMapClick={handleMapClick} />
          
          {selectedPoint && (
            <>
              <Marker position={selectedPoint}>
                <Popup>
                  <div className="text-center p-2">
                    <h3 className="font-bold text-sm">Selected Area</h3>
                    <p className="text-xs text-slate-600">
                      {selectedPoint[0].toFixed(4)}, {selectedPoint[1].toFixed(4)}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Radius: {radius} m
                    </p>
                  </div>
                </Popup>
              </Marker>

              {shape === 'circle' ? (
                <Circle
                  center={selectedPoint}
                  radius={radius}
                  pathOptions={{
                    color: '#a855f7',
                    fillColor: '#a855f7',
                    fillOpacity: 0.15,
                    weight: 2
                  }}
                />
              ) : (
                <Rectangle
                  bounds={getSquareBounds()}
                  pathOptions={{
                    color: '#a855f7',
                    fillColor: '#a855f7',
                    fillOpacity: 0.15,
                    weight: 2
                  }}
                />
              )}
            </>
          )}
        </MapContainer>

        {selectedPoint && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Selected: {radius} m {shape}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Lat: {selectedPoint[0].toFixed(4)}, Lng: {selectedPoint[1].toFixed(4)}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}