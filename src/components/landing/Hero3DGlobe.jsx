import React from 'react';

export default function Hero3DGlobe() {
  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 dark:from-purple-700 dark:via-fuchsia-700 dark:to-pink-700">
      </div>
      
      {/* Rotating overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 dark:via-white/10 to-transparent animate-spin"
           style={{ animationDuration: '25s' }}>
      </div>
      
      {/* Pulsing glow layers */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute w-96 h-96 rounded-full bg-gradient-to-br from-purple-400/60 to-fuchsia-400/60 dark:from-purple-500/40 dark:to-fuchsia-500/40 blur-[100px] animate-pulse"
             style={{ animationDuration: '4s' }}>
        </div>
        <div className="absolute w-72 h-72 rounded-full bg-gradient-to-br from-fuchsia-400/70 to-pink-400/70 dark:from-fuchsia-500/50 dark:to-pink-500/50 blur-[80px] animate-pulse"
             style={{ animationDuration: '5s', animationDelay: '1s' }}>
        </div>
        <div className="absolute w-48 h-48 rounded-full bg-white/30 dark:bg-white/20 blur-[60px] animate-pulse"
             style={{ animationDuration: '3s', animationDelay: '0.5s' }}>
        </div>
      </div>
      
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-20 dark:opacity-10" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
             backgroundSize: '50px 50px'
           }}>
      </div>
    </div>
  );
}