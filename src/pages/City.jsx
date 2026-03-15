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
import Footer from '@/components/Footer';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

  const [selectionRadiusM, setSelectionRadiusM] = useState(500);
  const [selectionCenter, setSelectionCenter] = useState(null);

  useEffect(() => {
    setAssessment(null);
  }, [cityName]);

  const analyzeRiskMutation = useMutation({
    mutationFn: async (cityData) => {
      return await base44.functions.invoke('analyzeRisks', { city: cityData });
    },
    onSuccess: (response) => {
      const data = response?.data?.data ?? response?.data ?? response?.result ?? response;
      if (data && typeof data === 'object') {
        setAssessment(data);
      }
      setIsAnalyzing(false);
      toast.success('Risk analysis complete');
    },
    onError: () => {
      setIsAnalyzing(false);
      toast.error('Analysis failed');
    }
  });

  const exportToPDF = async () => {
    try {
      toast.loading('Generating PDF report...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 20;

      // Title
      pdf.setFontSize(20);
      pdf.setTextColor(128, 0, 128);
      pdf.text(`${city.name} Risk Assessment Report`, 20, yPosition);
      yPosition += 10;

      // Date
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, 20, yPosition);
      yPosition += 10;

      // City Info
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Location: ${city.name}, ${city.country}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Coordinates: ${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}`, 20, yPosition);
      yPosition += 6;
      if (city.population) {
        pdf.text(`Population: ${city.population.toLocaleString()}`, 20, yPosition);
        yPosition += 6;
      }
      yPosition += 5;

      // Hazards Detected
      pdf.setFontSize(14);
      pdf.setTextColor(128, 0, 128);
      pdf.text('Detected Hazards', 20, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      assessment.hazards_detected.forEach((hazard) => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(`• ${hazard.type.replace('_', ' ').toUpperCase()}: ${hazard.severity} (Score: ${hazard.score}/10)`, 25, yPosition);
        yPosition += 6;
      });
      yPosition += 5;

      // Environmental Data
      if (assessment.environmental_data?.current) {
        pdf.setFontSize(14);
        pdf.setTextColor(128, 0, 128);
        pdf.text('Current Conditions', 20, yPosition);
        yPosition += 8;

        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        const current = assessment.environmental_data.current;
        if (current.temp_c) {
          pdf.text(`Temperature: ${current.temp_c}°C`, 25, yPosition);
          yPosition += 6;
        }
        if (current.humidity) {
          pdf.text(`Humidity: ${current.humidity}%`, 25, yPosition);
          yPosition += 6;
        }
        if (current.wind_kph) {
          pdf.text(`Wind: ${current.wind_kph} km/h`, 25, yPosition);
          yPosition += 6;
        }
        yPosition += 5;
      }

      // Predicted Impacts
      if (assessment.predicted_impacts && Object.keys(assessment.predicted_impacts).length > 0) {
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.setFontSize(14);
        pdf.setTextColor(128, 0, 128);
        pdf.text('Predicted Impacts', 20, yPosition);
        yPosition += 8;

        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        Object.entries(assessment.predicted_impacts).forEach(([key, value]) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 20;
          }
          const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          pdf.text(`${formattedKey}: ${value}`, 25, yPosition);
          yPosition += 6;
        });
      }

      toast.dismiss();
      pdf.save(`${city.name}_Risk_Assessment.pdf`);
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate PDF');
      console.error(error);
    }
  };

  const runAnalysisWithSelection = (cityData, radiusM = selectionRadiusM, center = selectionCenter) => {
    const radiusKm = radiusM / 1000;
    const lat = center?.[0] ?? cityData?.latitude;
    const lon = center?.[1] ?? cityData?.longitude;
    analyzeRiskMutation.mutate({
      ...cityData,
      selection_radius_km: radiusKm,
      selection_center_lat: lat,
      selection_center_lon: lon,
    });
  };

  useEffect(() => {
    if (!city || city.latitude == null || city.longitude == null) return;
    if (assessment != null || isAnalyzing) return;
    setIsAnalyzing(true);
    runAnalysisWithSelection(city, selectionRadiusM, selectionCenter);
  }, [city?.latitude, city?.longitude]);

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
                Cascade
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
              <Button
                onClick={exportToPDF}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>
      <CityHeader city={city} assessment={assessment} />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 p-6">
        <div className="xl:col-span-2 space-y-6">
          <CityMap
            city={city}
            assessment={assessment}
            selectionRadiusM={selectionRadiusM}
            onSelectionRadiusChange={setSelectionRadiusM}
            selectionCenter={selectionCenter}
            onSelectionCenterChange={setSelectionCenter}
            onRunWithSelection={() => {
              setIsAnalyzing(true);
              runAnalysisWithSelection(city, selectionRadiusM, selectionCenter);
            }}
            isAnalyzing={isAnalyzing}
          />
          <CascadingFlowchart chains={assessment.cascading_chains} hazards={assessment.hazards_detected} />
        </div>
        
        <div className="space-y-6">
          <CurrentConditions environmentalData={assessment.environmental_data} />
          <EnvironmentalMetrics
            environmentalData={assessment.environmental_data ?? {}}
            city={city}
            selectionRadiusM={selectionRadiusM}
            selectionCenter={selectionCenter}
            onRecalculate={() => {
              setIsAnalyzing(true);
              runAnalysisWithSelection(city, selectionRadiusM, selectionCenter);
            }}
            isAnalyzing={isAnalyzing}
          />
        </div>
      </div>

      <AIChatbot city={city} assessment={assessment} />
      <Footer />
    </div>
  );
}