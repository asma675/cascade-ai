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

  const city1 = cities.find(c => c.id === city1Id);
  const city2 = cities.find(c => c.id === city2Id);
  
  const assessment1 = city1 ? assessments.find(a => a.city_name === city1.name) : null;
  const assessment2 = city2 ? assessments.find(a => a.city_name === city2.name) : null;

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
              <button onClick={() => navigate('/Landing')} className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Home
              </button>
              <button onClick={() => navigate('/Globe')} className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Globe
              </button>
              <button onClick={() => navigate('/Compare')} className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                Compare
              </button>
              <button onClick={() => navigate('/Dashboard')} className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Dashboard
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

        {city1Id && city2Id && !assessment1 && !assessment2 && (
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-12 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              No risk assessments found for the selected cities.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mb-6">
              Visit each city's page to generate a risk analysis first.
            </p>
            <div className="flex gap-3 justify-center">
              {city1 && !assessment1 && (
                <Button
                  onClick={() => navigate(`/City/${encodeURIComponent(city1.name)}`)}
                  className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white"
                >
                  Analyze {city1.name}
                </Button>
              )}
              {city2 && !assessment2 && (
                <Button
                  onClick={() => navigate(`/City/${encodeURIComponent(city2.name)}`)}
                  className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white"
                >
                  Analyze {city2.name}
                </Button>
              )}
            </div>
          </Card>
        )}

        {assessment1 && !assessment2 && (
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {city2?.name} hasn't been analyzed yet.
            </p>
            <Button
              onClick={() => navigate(`/City/${encodeURIComponent(city2.name)}`)}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white"
            >
              Analyze {city2?.name}
            </Button>
          </Card>
        )}

        {!assessment1 && assessment2 && (
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              {city1?.name} hasn't been analyzed yet.
            </p>
            <Button
              onClick={() => navigate(`/City/${encodeURIComponent(city1.name)}`)}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white"
            >
              Analyze {city1?.name}
            </Button>
          </Card>
        )}

        {assessment1 && assessment2 && (
          <ComparisonChart assessment1={assessment1} assessment2={assessment2} />
        )}
      </div>
    </div>
  );
}