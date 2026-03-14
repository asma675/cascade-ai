import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Thermometer, Droplets, Wind, Gauge } from 'lucide-react';

export default function EnvironmentalMetrics({ environmentalData }) {
  const [timeWindow, setTimeWindow] = useState('30d');

  if (!environmentalData) return null;

  const metrics = [
    {
      id: 'temperature',
      label: 'Temperature',
      icon: Thermometer,
      color: '#ef4444',
      data: environmentalData.temperature_30d,
      unit: '°C'
    },
    {
      id: 'precipitation',
      label: 'Precipitation',
      icon: Droplets,
      color: '#3b82f6',
      data: environmentalData.precipitation_30d,
      unit: 'mm'
    },
    {
      id: 'wind',
      label: 'Wind Speed',
      icon: Wind,
      color: '#06b6d4',
      data: environmentalData.wind_30d,
      unit: 'm/s'
    },
    {
      id: 'pressure',
      label: 'Air Pressure',
      icon: Gauge,
      color: '#8b5cf6',
      data: environmentalData.pressure_30d,
      unit: 'hPa'
    }
  ];

  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4">Environmental Metrics</h2>

      <Tabs value={timeWindow} onValueChange={setTimeWindow} className="mb-4">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
          <TabsTrigger value="95d">95 Days</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.id} className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5" style={{ color: metric.color }} />
                <span className="text-slate-200 font-medium">{metric.label}</span>
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={metric.data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    labelStyle={{ color: '#cbd5e1' }}
                  />
                  <Line type="monotone" dataKey="value" stroke={metric.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </Card>
  );
}