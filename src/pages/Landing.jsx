import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import ThemeToggle from '@/components/landing/ThemeToggle';
import Interactive3DGlobe from '@/components/landing/Interactive3DGlobe';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1760px] mx-auto px-6 lg:px-10 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xl font-serif-display font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                planetary
              </span>
            </div>
            <div className="flex items-center gap-6">
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
        <div className="absolute inset-0 h-96">
          <Interactive3DGlobe />
        </div>
        <div className="relative max-w-[1760px] mx-auto px-6 lg:px-10">
          <div className="text-center max-w-3xl mx-auto mb-12 pt-96">
            <h1 className="text-6xl lg:text-7xl font-serif-display font-bold text-slate-900 dark:text-white mb-6">
              Discover environmental risks
              <span className="block mt-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
                in cities worldwide
              </span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-light">
              AI-powered climate intelligence with real-time NASA satellite data
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="bg-white dark:bg-slate-900 rounded-full shadow-xl shadow-purple-500/10 border border-slate-200 dark:border-slate-800 p-2">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/Globe')}
                  className="flex-1 text-left px-6 py-4 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1">Where</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Search cities</div>
                </button>
                <div className="w-px h-12 bg-slate-200 dark:bg-slate-800"></div>
                <button className="flex-1 text-left px-6 py-4 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white mb-1">Analysis Type</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Risk assessment</div>
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
              <div className="text-sm text-slate-600 dark:text-slate-500 mt-1">Climate Indices</div>
            </div>
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-800"></div>
            <div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">Live</div>
              <div className="text-sm text-slate-600 dark:text-slate-500 mt-1">NASA Data</div>
            </div>
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-800"></div>
            <div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">Global</div>
              <div className="text-sm text-slate-600 dark:text-slate-500 mt-1">Coverage</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-slate-50 dark:bg-slate-900/50">
        <div className="max-w-[1760px] mx-auto px-6 lg:px-10">
          <div className="mb-12">
            <h2 className="text-5xl font-serif-display font-bold text-slate-900 dark:text-white mb-2">
              Climate intelligence platform
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
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
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Multi-Hazard Detection</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
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
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Cascading Impact Chains</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
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
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">GeoJSON Export</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
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
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xl font-serif-display font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                planetary
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              AI-powered climate risk intelligence platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}