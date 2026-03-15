import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Header from '@/components/shared/Header';
import { Star, TrendingUp, AlertTriangle, MapPin, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: favorites = [], isLoading: loadingFavorites } = useQuery({
    queryKey: ['favorites', user?.email],
    queryFn: () => base44.entities.FavoriteCity.filter({ user_email: user.email }, '-last_viewed'),
    enabled: !!user?.email,
  });

  const { data: assessments = [], isLoading: loadingAssessments } = useQuery({
    queryKey: ['user-assessments', user?.email],
    queryFn: () => base44.entities.RiskAssessment.filter({}, '-assessment_date', 10),
    enabled: !!user?.email,
  });

  const deleteFavoriteMutation = useMutation({
    mutationFn: (favoriteId) => base44.entities.FavoriteCity.delete(favoriteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast.success('Removed from favorites');
    },
  });

  const getSeverityColor = (severity) => {
    if (severity >= 8) return 'text-red-600 dark:text-red-400';
    if (severity >= 5) return 'text-orange-600 dark:text-orange-400';
    return 'text-yellow-600 dark:text-yellow-400';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header />

      <div className="max-w-[1760px] mx-auto px-6 lg:px-10 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-serif-display font-bold text-slate-900 dark:text-white mb-2">
            Your Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Track your favorite cities and recent climate assessments
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Favorite Cities */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Star className="w-5 h-5 text-yellow-500" />
                Favorite Cities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFavorites ? (
                <div className="text-center py-8 text-slate-500">Loading...</div>
              ) : favorites.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No favorites yet. Visit a city page to add it!
                </div>
              ) : (
                <div className="space-y-3">
                  {favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {fav.city_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            Last viewed: {new Date(fav.last_viewed).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/City/${fav.city_name}`)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteFavoriteMutation.mutate(fav.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Assessments */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <TrendingUp className="w-5 h-5 text-cyan-500" />
                Recent Assessments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAssessments ? (
                <div className="text-center py-8 text-slate-500">Loading...</div>
              ) : assessments.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No assessments yet. Explore cities to generate reports!
                </div>
              ) : (
                <div className="space-y-3">
                  {assessments.map((assessment) => (
                    <div
                      key={assessment.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                      onClick={() => navigate(`/City/${assessment.city_name}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {assessment.city_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(assessment.assessment_date).toLocaleDateString()}
                        </div>
                      </div>
                      {assessment.hazards_detected && assessment.hazards_detected.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {assessment.hazards_detected.slice(0, 3).map((hazard, idx) => (
                            <span
                              key={idx}
                              className={`text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-700 ${getSeverityColor(hazard.severity)}`}
                            >
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              {hazard.type}
                            </span>
                          ))}
                          {assessment.hazards_detected.length > 3 && (
                            <span className="text-xs text-slate-500">
                              +{assessment.hazards_detected.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}