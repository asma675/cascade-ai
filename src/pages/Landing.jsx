import React from 'react';
import { Link } from 'react-router-dom';
import { Globe, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 blur-3xl rounded-full"></div>
              <Globe className="w-24 h-24 text-cyan-400 relative animate-pulse" />
            </div>
          </div>

          <h1 className="text-7xl font-bold mb-6 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Planetary Risk AI
          </h1>
          
          <p className="text-2xl text-slate-300 mb-4 max-w-3xl mx-auto leading-relaxed">
            Predicting cascading environmental, infrastructure, and humanitarian risks for cities worldwide
          </p>

          <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
            AI-powered climate intelligence platform for emergency planners and government decision-makers
          </p>

          <Link to="/Globe">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-lg px-8 py-6 rounded-lg font-semibold shadow-lg shadow-cyan-500/50 transition-all hover:shadow-cyan-500/70">
              <Globe className="w-6 h-6 mr-2" />
              Launch Globe Explorer
            </Button>
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-20">
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6 hover:border-cyan-500/50 transition-all">
            <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Hazard Detection</h3>
            <p className="text-slate-400">
              Scientific indices for heatwaves, droughts, floods, wildfires, and air quality using NASA POWER data
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6 hover:border-cyan-500/50 transition-all">
            <Activity className="w-12 h-12 text-cyan-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">Cascading Analysis</h3>
            <p className="text-slate-400">
              AI-powered prediction of how climate hazards cascade through infrastructure and populations
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6 hover:border-cyan-500/50 transition-all">
            <TrendingUp className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-100 mb-2">GIS-Ready Exports</h3>
            <p className="text-slate-400">
              Export risk assessments as GeoJSON, shapefiles, and CSV for ArcGIS and emergency planning systems
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}