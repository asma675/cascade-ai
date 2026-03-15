import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function HistoricalTrendsChart({ environmentalData }) {
  if (!environmentalData?.historical) {
    return null;
  }

  // Process historical data for the last 10 years
  const processHistoricalData = () => {
    const historical = environmentalData.historical;
    const currentYear = new Date().getFullYear();
    const data = [];

    for (let i = 9; i >= 0; i--) {
      const year = currentYear - i;
      const yearIndex = historical.year?.indexOf(year);
      
      if (yearIndex !== -1 && yearIndex !== undefined) {
        // Calculate annual averages
        const tempData = historical.T2M?.slice(yearIndex * 12, (yearIndex + 1) * 12) || [];
        const precipData = historical.PRECTOTCORR?.slice(yearIndex * 12, (yearIndex + 1) * 12) || [];
        
        const avgTemp = tempData.length > 0 
          ? tempData.reduce((a, b) => a + b, 0) / tempData.length 
          : null;
        const totalPrecip = precipData.length > 0 
          ? precipData.reduce((a, b) => a + b, 0) 
          : null;

        data.push({
          year: year.toString(),
          temperature: avgTemp ? parseFloat(avgTemp.toFixed(1)) : null,
          precipitation: totalPrecip ? parseFloat(totalPrecip.toFixed(1)) : null,
        });
      }
    }

    return data;
  };

  const chartData = processHistoricalData();

  // Calculate anomalies (deviation from mean)
  const calculateAnomalies = (data, key) => {
    const values = data.map(d => d[key]).filter(v => v !== null);
    if (values.length === 0) return data;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return data.map(d => ({
      ...d,
      [`${key}Anomaly`]: d[key] !== null ? parseFloat((d[key] - mean).toFixed(2)) : null
    }));
  };

  const dataWithAnomalies = calculateAnomalies(
    calculateAnomalies(chartData, 'temperature'),
    'precipitation'
  );

  return (
    <div className="space-y-6">
      {/* Temperature Trends */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            10-Year Temperature Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dataWithAnomalies}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="year" 
                className="text-xs fill-slate-600 dark:fill-slate-400"
              />
              <YAxis 
                className="text-xs fill-slate-600 dark:fill-slate-400"
                label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="temperature" 
                stroke="#f97316" 
                strokeWidth={2}
                name="Avg Temperature"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Precipitation Trends */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            10-Year Precipitation Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dataWithAnomalies}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="year" 
                className="text-xs fill-slate-600 dark:fill-slate-400"
              />
              <YAxis 
                className="text-xs fill-slate-600 dark:fill-slate-400"
                label={{ value: 'Total Precipitation (mm)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="precipitation" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Annual Precipitation"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Anomalies Chart */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Climate Anomalies (Deviation from Mean)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dataWithAnomalies}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis 
                dataKey="year" 
                className="text-xs fill-slate-600 dark:fill-slate-400"
              />
              <YAxis 
                className="text-xs fill-slate-600 dark:fill-slate-400"
                label={{ value: 'Anomaly', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="temperatureAnomaly" 
                stroke="#f97316" 
                strokeWidth={2}
                name="Temp Anomaly (°C)"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="precipitationAnomaly" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Precip Anomaly (mm)"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}