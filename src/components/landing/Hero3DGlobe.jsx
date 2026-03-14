import React from 'react';

export default function Hero3DGlobe() {
  return (
    <div className="w-full h-full relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 animate-pulse" 
           style={{ animationDuration: '4s' }}>
      </div>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20 animate-spin"
           style={{ animationDuration: '20s' }}>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-64 h-64 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 opacity-80 blur-3xl animate-pulse"
             style={{ animationDuration: '3s' }}>
        </div>
      </div>
    </div>
  );
}