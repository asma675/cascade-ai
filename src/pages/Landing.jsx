import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import ThemeToggle from '@/components/landing/ThemeToggle';
import Interactive3DGlobe from '@/components/landing/Interactive3DGlobe';
import StarryBackground from '@/components/landing/StarryBackground';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 relative">
      <StarryBackground />
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
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
              <Button
                onClick={() => navigate('/Globe')}
                className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-full px-6 shadow-lg shadow-purple-500/30"
              >
                Explore
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with 3D Globe */}
      <div className="relative pt-20 pb-20 overflow-hidden">
        <div className="relative max-w-[1760px] mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[600px]">
            {/* Text Content */}
            <div className="text-left max-w-2xl">
              <h1 className="text-6xl lg:text-7xl font-serif-display font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                Discover environmental risks
                <span className="block mt-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
                  in cities worldwide
                </span>
              </h1>
              <p className="text-lg text-slate-700 dark:text-slate-300 font-medium mb-8">
                AI-powered climate intelligence with real-time NASA satellite data
              </p>
              <Button
                onClick={() => navigate('/Globe')}
                className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white rounded-full px-8 py-6 text-lg shadow-lg shadow-purple-500/30"
              >
                Explore Globe
              </Button>
            </div>

            {/* Globe */}
            <div className="relative h-[600px]">
              <Interactive3DGlobe />
            </div>
          </div>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto mb-16 mt-12">
            <div className="bg-white dark:bg-slate-900 rounded-full shadow-xl shadow-purple-500/10 border border-slate-200 dark:border-slate-800 p-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/Globe')}
                  className="flex-1 text-left px-6 py-4 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">Where</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Search cities</div>
                </button>
                <div className="w-px h-12 bg-slate-200 dark:bg-slate-700"></div>
                <button className="flex-1 text-left px-6 py-4 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="text-xs font-bold text-slate-900 dark:text-white mb-1">Analysis Type</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Risk assessment</div>
                </button>
                <button 
                  onClick={() => navigate('/Globe')}
                  className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white p-4 rounded-full shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-12 text-center">
            <div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">30+</div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">Climate Indices</div>
            </div>
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-700"></div>
            <div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">Live</div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">NASA Data</div>
            </div>
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-700"></div>
            <div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">Global</div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">Coverage</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-[1760px] mx-auto px-6 lg:px-10">
          <div className="mb-12">
            <h2 className="text-5xl font-serif-display font-bold text-slate-900 dark:text-white mb-2 leading-tight">
              Climate intelligence platform
            </h2>
            <p className="text-lg text-slate-700 dark:text-slate-300 font-medium">
              Advanced risk analysis powered by AI and satellite data
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="group cursor-pointer">
              <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                <div className="aspect-[4/3] relative overflow-hidden bg-slate-200 dark:bg-slate-800">
                  <img src="https://images.unsplash.com/photo-1601134467661-3d775b999c8b?w=800&q=80" alt="Heatwave" className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Multi-Hazard Detection</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    Heatwave, drought, air quality, and wind risk analysis
                  </p>
                </div>
              </div>
            </div>
            
            <div className="group cursor-pointer">
              <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                <div className="aspect-[4/3] relative overflow-hidden bg-slate-200 dark:bg-slate-800">
                  <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80" alt="Cascading risks" className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Cascading Impact Chains</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    AI-generated probabilistic risk propagation analysis
                  </p>
                </div>
              </div>
            </div>
            
            <div className="group cursor-pointer">
              <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                <div className="aspect-[4/3] relative overflow-hidden bg-slate-200 dark:bg-slate-800">
                  <img src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&q=80" alt="GeoJSON export" className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">GeoJSON Export</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                    Export to QGIS, ArcGIS, and geospatial platforms
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-[1760px] mx-auto px-6 lg:px-10">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b531ed0b1c34a9ca40d4a5/5b414314b_image.png" 
                alt="Cascade Logo" 
                className="h-10 w-10"
              />
              <span className="text-xl font-serif-display font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                cascade
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              AI-powered climate risk intelligence platform
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
              © Asma Ahmed, Haris Kamel, Ishav Sohal, Hayagrive Srikanth 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}