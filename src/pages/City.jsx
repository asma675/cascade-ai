import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CityMap from '@/components/city/CityMap';
import CascadingFlowchart from '@/components/city/CascadingFlowchart';
import EnvironmentalMetrics from '@/components/city/EnvironmentalMetrics';
import CurrentConditions from '@/components/city/CurrentConditions';
import CityHeader from '@/components/city/CityHeader';
import AIChatbot from '@/components/city/AIChatbot';
import HistoricalTrendsChart from '@/components/city/HistoricalTrendsChart';
import Header from '@/components/shared/Header';
import { Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function City() {
  const { cityName } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: cities = [] } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.list(),
  });

  const city = cities.find(c => c.name === decodeURIComponent(cityName));

  const { data: favoriteStatus } = useQuery({
    queryKey: ['favorite-status', user?.email, city?.id],
    queryFn: async () => {
      const favorites = await base44.entities.FavoriteCity.filter({ 
        user_email: user.email, 
        city_id: city.id 
      });
      return favorites.length > 0 ? favorites[0] : null;
    },
    enabled: !!user?.email && !!city?.id,
  });

  const queryClient = useQueryClient();

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (favoriteStatus) {
        await base44.entities.FavoriteCity.delete(favoriteStatus.id);
      } else {
        await base44.entities.FavoriteCity.create({
          user_email: user.email,
          city_id: city.id,
          city_name: city.name,
          last_viewed: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-status'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast.success(favoriteStatus ? 'Removed from favorites' : 'Added to favorites');
    },
  });

  useEffect(() => {
    if (user?.email && city?.id && favoriteStatus) {
      base44.entities.FavoriteCity.update(favoriteStatus.id, {
        last_viewed: new Date().toISOString()
      });
    }
  }, [city?.id]);

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
            <button onClick={() => navigate('/Landing')} className="flex items-center gap-3">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b531ed0b1c34a9ca40d4a5/daa0e7d5a_image.png" 
                alt="Cascade Logo" 
                className="h-12"
              />
            </button>
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
              <button onClick={() => navigate('/Dashboard')} className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Dashboard
              </button>
              {user && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFavoriteMutation.mutate()}
                  className="gap-2"
                >
                  <Star className={`w-4 h-4 ${favoriteStatus ? 'fill-yellow-500 text-yellow-500' : 'text-slate-600 dark:text-slate-400'}`} />
                </Button>
              )}
              <Header />
            </div>
          </div>
        </div>
      </header>
      <CityHeader city={city} assessment={assessment} />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-6">
        <div className="xl:col-span-2 space-y-6">
          <CityMap city={city} assessment={assessment} />
          <CascadingFlowchart chains={assessment.cascading_chains} hazards={assessment.hazards_detected} />
          <HistoricalTrendsChart environmentalData={assessment.environmental_data} />
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