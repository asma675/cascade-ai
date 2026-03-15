import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center gap-4">
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
          <p className="text-sm text-slate-600 dark:text-slate-400">
            AI-powered climate risk intelligence platform
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            © Asma Ahmed, Haris Kamel, Ishav Sohal, Hayagrive Srikanth 2026
          </p>
        </div>
      </div>
    </footer>
  );
}