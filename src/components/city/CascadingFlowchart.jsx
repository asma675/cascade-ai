import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Activity, ArrowDown, Loader2, BookOpen, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function CascadingFlowchart({ chains, hazards, sources, isLoadingChains, chainsSource, ragError }) {
  const [selectedChain, setSelectedChain] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(true);

  if (isLoadingChains) {
    return (
      <Card className="bg-slate-900 border-slate-800 p-8">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Cascading Impact Flowchart
        </h2>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          <p className="text-slate-400">Loading evidence-based chains from RAG server…</p>
        </div>
      </Card>
    );
  }

  if (!chains || chains.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">Cascading Risk Chains</h2>
        {ragError ? (
          <>
            <p className="text-amber-400/90 text-sm mb-2">RAG server unavailable: {ragError}</p>
            <p className="text-slate-500 text-sm">Run the RAG server locally: <code className="bg-slate-800 px-1 rounded">python main.py</code> (port 5050)</p>
          </>
        ) : (
          <p className="text-slate-400">No cascading risks detected</p>
        )}
      </Card>
    );
  }

  const chain = chains[selectedChain];
  
  const associatedHazard = hazards?.find(h => 
    chain.nodes?.[0]?.description?.toLowerCase().includes(h.type.toLowerCase())
  );

  const layerConfig = {
    hazard: { color: 'from-red-600 to-red-500', label: 'HAZARD LAYER', icon: '⚡' },
    environmental: { color: 'from-amber-600 to-amber-500', label: 'ENVIRONMENTAL LAYER', icon: '🌱' },
    infrastructure: { color: 'from-orange-600 to-orange-500', label: 'INFRASTRUCTURE LAYER', icon: '🏗️' },
    economic: { color: 'from-blue-600 to-blue-500', label: 'ECONOMIC LAYER', icon: '💰' },
    human: { color: 'from-purple-600 to-purple-500', label: 'HUMAN LAYER', icon: '👥' }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Cascading Impact Flowchart
        </h2>
        {chainsSource === 'rag' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-medium">
            <BookOpen className="w-3.5 h-3.5" />
            Evidence-based (RAG)
          </span>
        )}
      </div>
      {ragError && chainsSource !== 'rag' && (
        <p className="text-amber-400/90 text-sm mb-4">RAG server unavailable; showing backend chains. Run <code className="bg-slate-800 px-1 rounded">python main.py</code> for evidence-based chains.</p>
      )}

      {/* Chain selector */}
      <div className="flex gap-2 mb-8">
        {chains.slice(0, 3).map((c, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedChain(idx)}
            className={`px-4 py-2 rounded-lg transition-all ${
              selectedChain === idx
                ? 'bg-cyan-500 text-slate-950 font-semibold'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Chain {idx + 1}
          </button>
        ))}
      </div>

      {/* Chain metrics */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Probability</div>
          <div className="text-2xl font-bold text-cyan-400">{((chain.probability ?? 0) * 100).toFixed(0)}%</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Severity</div>
          <div className="text-2xl font-bold text-red-400">{((chain.severity ?? 0) * 10).toFixed(1)}/10</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Confidence</div>
          <div className="text-2xl font-bold text-green-400">{((chain.confidence ?? 0) * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Flowchart */}
      <div className="flex flex-col items-center gap-4">
        {chain.nodes.map((node, idx) => {
          const config = layerConfig[node.layer] || layerConfig.hazard;
          
          return (
            <div key={idx} className="w-full flex flex-col items-center">
              {/* Node */}
              <div className={`w-full max-w-2xl bg-gradient-to-r ${config.color} rounded-xl p-6 shadow-lg`}>
                <div className="text-white">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-90">{config.label}</span>
                    <span className="text-2xl">{config.icon}</span>
                  </div>
                  <p className="text-white text-base leading-relaxed mb-2">
                    {node.description}
                  </p>
                  {node.citation && (
                    <p className="text-xs opacity-85 italic border-l-2 border-white/40 pl-2">
                      {node.citation}
                    </p>
                  )}
                </div>
              </div>

              {/* Arrow to next layer */}
              {idx < chain.nodes.length - 1 && (
                <div className="my-2">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-1 h-6 bg-gradient-to-b from-slate-600 to-slate-700"></div>
                    <ArrowDown className="w-5 h-5 text-slate-500 animate-bounce" />
                    <div className="w-1 h-6 bg-gradient-to-b from-slate-700 to-slate-600"></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sources (when RAG chains and sources are available) */}
      {chainsSource === 'rag' && sources && sources.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-700">
          <button
            type="button"
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="flex items-center gap-2 w-full text-left text-cyan-400 font-semibold mb-3 hover:text-cyan-300"
          >
            <FileText className="w-5 h-5" />
            Sources ({sources.length})
            {sourcesOpen ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
          </button>
          {sourcesOpen && (
            <div className="space-y-3">
              {sources.map((s, idx) => (
                <div
                  key={idx}
                  className="rounded-lg bg-slate-800/80 border border-slate-700 p-4 text-sm"
                >
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="font-medium text-slate-200">
                      [{idx + 1}] {s.source || 'Unknown'}
                    </span>
                    {s.similarity != null && (
                      <span className="text-xs text-slate-500">relevance: {(Number(s.similarity) * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  {s.snippet && (
                    <p className="text-slate-400 text-xs mt-2 leading-relaxed line-clamp-3">
                      &ldquo;{s.snippet}&hellip;&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}