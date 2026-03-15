import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import CityMap from '@/components/city/CityMap';
import CascadingFlowchart from '@/components/city/CascadingFlowchart';
import EnvironmentalMetrics from '@/components/city/EnvironmentalMetrics';
import CurrentConditions from '@/components/city/CurrentConditions';
import CityHeader from '@/components/city/CityHeader';
import AIChatbot from '@/components/city/AIChatbot';
import ThemeToggle from '@/components/landing/ThemeToggle';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function City() {
  const { cityName } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.list(),
  });

  const city = cities.find(c => c.name === decodeURIComponent(cityName));

  const analyzeRiskMutation = useMutation({
    mutationFn: async (cityData) => {
      return await base44.functions.invoke('analyzeRisks', { city: cityData });
    },
    onSuccess: (response) => {
      const data = response?.data?.data ?? response?.data;
      setAssessment(data);
      setIsAnalyzing(false);
      toast.success('Risk analysis complete');
    },
    onError: () => {
      setIsAnalyzing(false);
      toast.error('Analysis failed');
    }
  });

  useEffect(() => {
    if (city && !assessment && !isAnalyzing) {
      setIsAnalyzing(true);
      analyzeRiskMutation.mutate(city);
    }
  }, [city]);

  if (!city) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-400">City not found</p>
        </div>
      </div>
    );
  }

  if (isAnalyzing || !assessment) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-xl text-slate-300">Analyzing environmental risks for {city.name}...</p>
          <p className="text-sm text-slate-500 mt-2">Collecting NASA POWER data and running AI analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1760px] mx-auto px-6 lg:px-10 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b531ed0b1c34a9ca40d4a5/5b414314b_image.png" 
                alt="Cascade Logo" 
                className="h-10 w-10"
              />
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
              <button onClick={() => navigate('/Compare')} className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Compare
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      <CityHeader city={city} assessment={assessment} />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-6">
        <div className="xl:col-span-2 space-y-6">
          <CityMap city={city} assessment={assessment} />
          <CascadingFlowchart chains={assessment.cascading_chains} hazards={assessment.hazards_detected} />
        </div>
        
        <div className="space-y-6">
          <CurrentConditions environmentalData={assessment.environmental_data} />
          <EnvironmentalMetrics environmentalData={assessment.environmental_data} city={city} />
        </div>
      </div>

      <AIChatbot city={city} assessment={assessment} />
    </div>
  );
}