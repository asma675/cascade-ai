import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ComparisonChart from '@/components/compare/ComparisonChart';
import ThemeToggle from '@/components/landing/ThemeToggle';
import { ArrowLeftRight } from 'lucide-react';

export default function Compare() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1760px] mx-auto px-6 lg:px-10 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xl font-serif-display font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                cascade
              </span>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => navigate('/Landing')} className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Home
              </button>
              <button onClick={() => navigate('/Globe')} className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Globe
              </button>
              <button onClick={() => navigate('/Compare')} className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Compare
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-4xl font-serif-display font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent mb-8 flex items-center gap-3">
          <ArrowLeftRight className="w-10 h-10 text-purple-600" />
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