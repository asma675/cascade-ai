import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Globe, TrendingUp, Network, Download, ArrowRight } from 'lucide-react';
import Hero3DGlobe from '@/components/landing/Hero3DGlobe';
import ThemeToggle from '@/components/landing/ThemeToggle';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section with 3D Globe */}
      <div className="container mx-auto px-6 pt-12 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="inline-block">
              <span className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                AI-Powered Climate Intelligence
              </span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold text-slate-900 dark:text-white leading-tight">
              Planetary Risk
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
                Intelligence
              </span>
            </h1>
            
            <p className="text-xl text-slate-700 dark:text-slate-300 leading-relaxed">
              Harness cutting-edge AI to detect, analyze, and predict cascading environmental hazards across global cities. Real-time NASA data integration for decision-makers.
            </p>
            
            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                onClick={() => navigate('/Globe')}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-6 text-lg rounded-xl shadow-2xl shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all group"
              >
                <Globe className="w-6 h-6 mr-2" />
                Launch Globe Explorer
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/Globe')}
                className="border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 px-8 py-6 text-lg rounded-xl"
              >
                View Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-300 dark:border-slate-800">
              <div>
                <div className="text-3xl font-bold text-slate-900 dark:text-cyan-400">30+</div>
                <div className="text-sm text-slate-600 dark:text-slate-500">Climate Indices</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 dark:text-cyan-400">Real-time</div>
                <div className="text-sm text-slate-600 dark:text-slate-500">NASA Data</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-900 dark:text-cyan-400">Global</div>
                <div className="text-sm text-slate-600 dark:text-slate-500">Coverage</div>
              </div>
            </div>
          </div>

          {/* Right 3D Globe */}
          <div className="h-[500px] lg:h-[600px] relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 dark:from-cyan-500/10 dark:to-blue-600/10 rounded-3xl blur-3xl"></div>
            <div className="relative h-full rounded-3xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 backdrop-blur shadow-2xl">
              <Hero3DGlobe />
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-6 py-20 bg-white/50 dark:bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Advanced Risk Analysis Platform
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Comprehensive climate intelligence powered by validated scientific indices and AI-driven insights
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-slate-900 backdrop-blur border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-8 hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all group">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-200 mb-4">Multi-Hazard Detection</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                EHF heatwave analysis, SPI drought detection, air quality monitoring, and wind risk assessment using validated climate indices.
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-900 backdrop-blur border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-8 hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all group">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Network className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-200 mb-4">Cascading Impact Chains</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                AI-powered generation of probabilistic risk chains showing how hazards cascade through environmental, infrastructure, and human systems.
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-900 backdrop-blur border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-8 hover:border-cyan-500 dark:hover:border-cyan-500 hover:shadow-2xl hover:shadow-cyan-500/10 transition-all group">
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Download className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-200 mb-4">GeoJSON Export</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Export risk assessments as GeoJSON for seamless integration with QGIS, ArcGIS, and other geospatial platforms.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-cyan-500 to-blue-600 rounded-3xl p-12 shadow-2xl">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Climate Risk Analysis?
          </h2>
          <p className="text-xl text-cyan-50 mb-8">
            Join researchers and decision-makers using AI-powered insights to protect communities worldwide
          </p>
          <Button
            size="lg"
            onClick={() => navigate('/Globe')}
            className="bg-white text-slate-900 hover:bg-slate-100 px-8 py-6 text-lg rounded-xl shadow-xl font-semibold"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}