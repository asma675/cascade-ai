import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import CityMap from '@/components/city/CityMap';
import CascadingGraph from '@/components/city/CascadingGraph';
import EnvironmentalMetrics from '@/components/city/EnvironmentalMetrics';
import CityHeader from '@/components/city/CityHeader';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function City() {
  const { cityName } = useParams();
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
    <div className="min-h-screen bg-slate-950">
      <CityHeader city={city} assessment={assessment} />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-6">
        <div className="xl:col-span-2 space-y-6">
          <CityMap city={city} assessment={assessment} />
          <CascadingGraph chains={assessment.cascading_chains} hazards={assessment.hazards_detected} />
        </div>
        
<<<<<<< Updated upstream
        <div>
=======
        <div className="space-y-6">
          <CurrentConditions environmentalData={assessment.environmental_data} />
>>>>>>> Stashed changes
          <EnvironmentalMetrics environmentalData={assessment.environmental_data} city={city} />
        </div>
      </div>
    </div>
  );
}