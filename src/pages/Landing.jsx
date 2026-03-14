import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Globe, Zap, Layers, Download, ArrowRight, Sparkles } from 'lucide-react';
import Hero3DGlobe from '@/components/landing/Hero3DGlobe';
import ThemeToggle from '@/components/landing/ThemeToggle';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 overflow-hidden relative">
      {/* Animated background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-purple-500/20 via-fuchsia-500/20 to-pink-500/20 dark:from-purple-600/10 dark:via-fuchsia-600/10 dark:to-pink-600/10 rounded-full blur-3xl animate-pulse" style={{animationDuration: '8s'}}></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-violet-500/20 via-purple-500/20 to-indigo-500/20 dark:from-violet-600/10 dark:via-purple-600/10 dark:to-indigo-600/10 rounded-full blur-3xl animate-pulse" style={{animationDuration: '10s', animationDelay: '2s'}}></div>
      </div>
      {/* Theme Toggle */}
      <div className="fixed top-8 right-8 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-6 pt-20 pb-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
          {/* Left Content */}
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/30 px-5 py-2.5 rounded-full backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
              <span className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
                AI-Powered Climate Intelligence
              </span>
            </div>
            
            <h1 className="text-6xl lg:text-7xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tight">
              Planetary
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 dark:from-purple-400 dark:via-fuchsia-400 dark:to-pink-400 animate-gradient">
                Risk Pulse
              </span>
            </h1>
            
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              Advanced AI-driven platform detecting and analyzing cascading environmental hazards across global cities with real-time NASA satellite data.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <Button
                size="lg"
                onClick={() => navigate('/Globe')}
                className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white px-8 py-7 text-base rounded-2xl shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300 group font-semibold"
              >
                <Globe className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                Explore Globe
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/Globe')}
                className="border-2 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur text-slate-900 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 dark:hover:border-purple-700 px-8 py-7 text-base rounded-2xl transition-all duration-300 font-semibold"
              >
                View Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-12">
              <div className="group">
                <div className="text-4xl font-black bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent group-hover:scale-110 transition-transform">30+</div>
                <div className="text-sm text-slate-600 dark:text-slate-500 font-medium mt-1">Climate Indices</div>
              </div>
              <div className="group">
                <div className="text-4xl font-black bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent group-hover:scale-110 transition-transform">Live</div>
                <div className="text-sm text-slate-600 dark:text-slate-500 font-medium mt-1">NASA Data</div>
              </div>
              <div className="group">
                <div className="text-4xl font-black bg-gradient-to-r from-purple-600 to-fuchsia-600 dark:from-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent group-hover:scale-110 transition-transform">Global</div>
                <div className="text-sm text-slate-600 dark:text-slate-500 font-medium mt-1">Coverage</div>
              </div>
            </div>
          </div>

          {/* Right Visual */}
          <div className="h-[550px] lg:h-[650px] relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/30 via-fuchsia-500/30 to-pink-500/30 dark:from-purple-600/20 dark:via-fuchsia-600/20 dark:to-pink-600/20 rounded-[3rem] blur-3xl group-hover:blur-2xl transition-all duration-700"></div>
            <div className="relative h-full rounded-[3rem] overflow-hidden border-2 border-purple-200/50 dark:border-purple-900/50 bg-gradient-to-br from-white/80 to-purple-50/50 dark:from-slate-900/80 dark:to-purple-950/50 backdrop-blur-xl shadow-2xl shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-all duration-500 group-hover:scale-[1.02]">
              <Hero3DGlobe />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative z-10 py-24 bg-gradient-to-b from-transparent via-purple-50/50 to-transparent dark:via-purple-950/20">
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-slate-900 dark:text-white mb-5 tracking-tight">
                Next-Gen Risk Platform
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Scientific precision meets AI innovation for unparalleled climate intelligence
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 dark:from-purple-600/10 dark:to-fuchsia-600/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-2 border-purple-200/50 dark:border-purple-900/50 rounded-3xl p-8 hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-purple-500/20">
                  <div className="bg-gradient-to-br from-purple-500 to-fuchsia-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform duration-500 shadow-lg shadow-purple-500/50">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Multi-Hazard Detection</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    EHF heatwave analysis, SPI drought metrics, air quality indices, and wind patterns using validated climate science.
                  </p>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 dark:from-fuchsia-600/10 dark:to-pink-600/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-2 border-purple-200/50 dark:border-purple-900/50 rounded-3xl p-8 hover:border-fuchsia-400 dark:hover:border-fuchsia-600 transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-fuchsia-500/20">
                  <div className="bg-gradient-to-br from-fuchsia-500 to-pink-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform duration-500 shadow-lg shadow-fuchsia-500/50">
                    <Layers className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Cascading Impact Chains</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    AI-generated probabilistic chains revealing how hazards propagate through environmental and societal systems.
                  </p>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-purple-500/20 dark:from-pink-600/10 dark:to-purple-600/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
                <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-2 border-purple-200/50 dark:border-purple-900/50 rounded-3xl p-8 hover:border-pink-400 dark:hover:border-pink-600 transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-pink-500/20">
                  <div className="bg-gradient-to-br from-pink-500 to-purple-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform duration-500 shadow-lg shadow-pink-500/50">
                    <Download className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">GeoJSON Export</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Instant export to industry-standard formats for QGIS, ArcGIS, and enterprise geospatial workflows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 rounded-[3rem] blur-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>
            <div className="relative bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 rounded-[3rem] p-16 text-center shadow-2xl shadow-purple-500/30 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
              <div className="relative z-10">
                <h2 className="text-5xl font-black text-white mb-6 tracking-tight">
                  Transform Climate Intelligence
                </h2>
                <p className="text-xl text-purple-50 mb-10 max-w-2xl mx-auto leading-relaxed">
                  Join the forefront of AI-powered environmental analysis. Protect communities with real-time insights.
                </p>
                <Button
                  size="lg"
                  onClick={() => navigate('/Globe')}
                  className="bg-white text-purple-700 hover:bg-purple-50 px-10 py-7 text-lg rounded-2xl shadow-2xl shadow-black/20 font-bold hover:scale-105 transition-all duration-300 group"
                >
                  Launch Platform
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}