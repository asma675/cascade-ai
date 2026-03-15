import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ComparisonChart({ assessment1, assessment2 }) {
  if (!assessment1?.hazards_detected || !assessment2?.hazards_detected) {
    return null;
  }

  const hazardComparison = assessment1.hazards_detected.map((h1, idx) => {
    const h2 = assessment2.hazards_detected[idx];
    return {
      hazard: h1.type,
      [assessment1.city_name]: h1.score || 0,
      [assessment2.city_name]: h2?.score || 0
    };
  });

  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <h2 className="text-2xl font-bold text-cyan-400 mb-6">Hazard Comparison</h2>
      
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={hazardComparison}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="hazard" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
          />
          <Legend />
          <Bar dataKey={assessment1.city_name} fill="#00d4ff" />
          <Bar dataKey={assessment2.city_name} fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-6 mt-8">
        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4">{assessment1.city_name}</h3>
          <div className="space-y-2">
            {assessment1.predicted_impacts && Object.entries(assessment1.predicted_impacts).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-slate-400">{key.replace(/_/g, ' ')}</span>
                <span className="text-slate-200 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-slate-200 mb-4">{assessment2.city_name}</h3>
          <div className="space-y-2">
            {assessment2.predicted_impacts && Object.entries(assessment2.predicted_impacts).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-slate-400">{key.replace(/_/g, ' ')}</span>
                <span className="text-slate-200 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}