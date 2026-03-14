import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Activity, ChevronRight } from 'lucide-react';

export default function CascadingGraph({ chains, hazards }) {
  const [selectedChain, setSelectedChain] = useState(0);

  if (!chains || chains.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-2xl font-bold text-cyan-400 mb-4">Cascading Risk Chains</h2>
        <p className="text-slate-400">No cascading risks detected</p>
      </Card>
    );
  }

  const chain = chains[selectedChain];
  
  // Find associated hazard for this chain
  const associatedHazard = hazards?.find(h => 
    chain.nodes?.[0]?.description?.toLowerCase().includes(h.type.toLowerCase())
  );

  const layerColors = {
    hazard: 'bg-red-500',
    environmental: 'bg-amber-500',
    infrastructure: 'bg-orange-500',
    human: 'bg-purple-500',
    economic: 'bg-blue-500'
  };

  return (
    <Card className="bg-slate-900 border-slate-800 p-6">
      <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
        <Activity className="w-6 h-6" />
        Cascading Risk Chains
      </h2>

      {/* Chain selector */}
      <div className="flex gap-2 mb-6">
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

      {/* Hazard Index Display */}
      {associatedHazard && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Primary Hazard Index</div>
              <div className="text-lg font-semibold text-cyan-400 capitalize">
                {associatedHazard.type.replace('_', ' ')} - {associatedHazard.index}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-1">Index Value</div>
              <div className="text-2xl font-bold text-orange-400">{associatedHazard.value}</div>
            </div>
          </div>
          {associatedHazard.details && (
            <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-3 text-xs">
              {Object.entries(associatedHazard.details).map(([key, value]) => (
                <div key={key}>
                  <span className="text-slate-500">{key}: </span>
                  <span className="text-slate-300 font-medium">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chain metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Probability</div>
          <div className="text-2xl font-bold text-cyan-400">{(chain.probability * 100).toFixed(0)}%</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Severity</div>
          <div className="text-2xl font-bold text-red-400">{(chain.severity * 10).toFixed(1)}/10</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="text-xs text-slate-500 mb-1">Confidence</div>
          <div className="text-2xl font-bold text-green-400">{(chain.confidence * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Cascading flow */}
      <div className="space-y-3">
        {chain.nodes.map((node, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className={`w-1 h-full ${layerColors[node.layer] || 'bg-slate-500'} rounded`}></div>
            <div className="flex-1 bg-slate-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">{node.layer} Layer</div>
                  <div className="text-slate-200 font-medium">{node.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Impact</div>
                  <div className="text-sm font-semibold text-red-400">{(node.impact * 100).toFixed(0)}%</div>
                </div>
              </div>
              {node.data && (
                <div className="text-xs text-slate-400 mt-2">
                  {node.data}
                </div>
              )}
            </div>
            {idx < chain.nodes.length - 1 && (
              <ChevronRight className="w-5 h-5 text-slate-600 mt-4" />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}