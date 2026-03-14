import React from 'react';
import { Card } from '@/components/ui/card';
import { Thermometer, Droplets, Wind, Flame, CloudRain } from 'lucide-react';

export default function CurrentConditions({ environmentalData }) {
  const current = environmentalData?.current || {};
  
  const metrics = [
    {
      icon: Thermometer,
      label: 'Temperature',
      value: current.temperature ? `${current.temperature.toFixed(1)}°C` : 'N/A',
      sublabel: current.feels_like ? `Feels like ${current.feels_like.toFixed(1)}°C` : '',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10'
    },
    {
      icon: Droplets,
      label: 'Humidity',
      value: current.humidity ? `${current.humidity}%` : 'N/A',
      sublabel: current.precipitation ? `${current.precipitation} mm precip` : '',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    {
      icon: Wind,
      label: 'Wind Speed',
      value: current.wind_speed ? `${current.wind_speed.toFixed(1)} m/s` : 'N/A',
      sublabel: current.wind_direction || '',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10'
    },
    {
      icon: CloudRain,
      label: 'Pressure',
      value: current.pressure ? `${current.pressure} mb` : 'N/A',
      sublabel: current.cloud_cover ? `${current.cloud_cover}% clouds` : '',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    },
    {
      icon: Flame,
      label: 'UV Index',
      value: current.uv_index ? current.uv_index : 'N/A',
      sublabel: current.visibility ? `${current.visibility} km vis` : '',
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10'
    }
  ];

  // Air Quality Card
  const aqi = current.air_quality;
  const aqiLevels = ['Good', 'Moderate', 'Unhealthy for Sensitive', 'Unhealthy', 'Very Unhealthy', 'Hazardous'];
  const aqiColors = ['text-green-400', 'text-yellow-400', 'text-orange-400', 'text-red-400', 'text-purple-400', 'text-rose-600'];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-cyan-400">Current Conditions</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1 gap-3">
        {metrics.map((metric, idx) => (
          <Card key={idx} className="bg-slate-900 border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className={`${metric.bgColor} p-3 rounded-lg`}>
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              <div className="flex-1">
                <div className="text-xs text-slate-500">{metric.label}</div>
                <div className={`text-lg font-bold ${metric.color}`}>{metric.value}</div>
                {metric.sublabel && (
                  <div className="text-xs text-slate-600">{metric.sublabel}</div>
                )}
              </div>
            </div>
          </Card>
        ))}

        {/* Air Quality Card */}
        {aqi && (
          <Card className="bg-slate-900 border-slate-800 p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 p-3 rounded-lg">
                <div className="w-5 h-5 rounded bg-purple-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-slate-500">Air Quality</div>
                <div className={`text-lg font-bold ${aqiColors[aqi.us_epa_index - 1] || 'text-slate-400'}`}>
                  {aqiLevels[aqi.us_epa_index - 1] || 'Unknown'}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  PM2.5: {aqi.pm2_5?.toFixed(1)} • PM10: {aqi.pm10?.toFixed(1)}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}