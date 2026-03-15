import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/landing/ThemeToggle';

export default function Header() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-[1760px] mx-auto px-6 lg:px-10 py-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/Landing')} className="flex items-center gap-3">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b531ed0b1c34a9ca40d4a5/daa0e7d5a_image.png" 
              alt="Cascade Logo" 
              className="h-12"
            />
          </button>
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
            <button onClick={() => navigate('/Dashboard')} className="text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              Dashboard
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
  );
}