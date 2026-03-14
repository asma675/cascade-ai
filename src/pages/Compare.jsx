import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import ComparisonChart from '@/components/compare/ComparisonChart';
import { ArrowLeftRight } from 'lucide-react';

export default function Compare() {
  const [city1Id, setCity1Id] = useState(null);
  const [city2Id, setCity2Id] = useState(null);

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.list(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => base44.entities.RiskAssessment.list(),
  });

  const assessment1 = assessments.find(a => a.city_id === city1Id);
  const assessment2 = assessments.find(a => a.city_id === city2Id);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-cyan-400 mb-8 flex items-center gap-3">
          <ArrowLeftRight className="w-10 h-10" />
          Compare Cities
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-slate-900 border-slate-800 p-6">
            <label className="text-slate-300 mb-2 block">City 1</label>
            <Select value={city1Id} onValueChange={setCity1Id}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                <SelectValue placeholder="Select first city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map(city => (
                  <SelectItem key={city.id} value={city.id}>{city.name}, {city.country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-6">
            <label className="text-slate-300 mb-2 block">City 2</label>
            <Select value={city2Id} onValueChange={setCity2Id}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                <SelectValue placeholder="Select second city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map(city => (
                  <SelectItem key={city.id} value={city.id}>{city.name}, {city.country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        </div>

        {assessment1 && assessment2 && (
          <ComparisonChart assessment1={assessment1} assessment2={assessment2} />
        )}
      </div>
    </div>
  );
}