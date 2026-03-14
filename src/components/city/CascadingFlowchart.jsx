import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Activity, ArrowDown } from 'lucide-react';

export default function CascadingFlowchart({ chains, hazards }) {
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
      <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
        <Activity className="w-6 h-6" />
        Cascading Impact Flowchart
      </h2>

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
                  <h3 className="text-lg font-bold mb-2">{node.description}</h3>
                  <p className="text-sm opacity-90 mb-3">{node.data || 'Environmental impact propagation'}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-white/20">
                    <span className="text-xs opacity-75">Impact Level</span>
                    <span className="text-lg font-bold">{(node.impact * 100).toFixed(0)}%</span>
                  </div>
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
    </Card>
  );
}