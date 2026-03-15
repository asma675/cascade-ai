import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  HeartPulse, Skull, Home, Zap, TreePine, Flame, HandHelping,
  ChevronDown, ChevronRight, BookOpen, FlaskConical, AlertTriangle
} from 'lucide-react';

const OUTCOME_ICONS = {
  mortality: Skull,
  hospitalizations: HeartPulse,
  displacement: Home,
  infrastructure_stress: Zap,
  vegetation_stress: TreePine,
  fire_activity: Flame,
  aid_requests: HandHelping,
};

const OUTCOME_LABELS = {
  mortality: 'Excess Mortality',
  hospitalizations: 'Hospitalizations',
  displacement: 'Displacement',
  infrastructure_stress: 'Infrastructure Stress',
  vegetation_stress: 'Vegetation Stress',
  fire_activity: 'Fire Activity',
  aid_requests: 'Aid Requests',
};

const HAZARD_COLORS = {
  heatwave: 'text-orange-400',
  drought: 'text-amber-400',
  flood: 'text-blue-400',
  wildfire: 'text-red-400',
  air_quality: 'text-purple-400',
  high_wind: 'text-cyan-400',
};

function MethodBadge({ method }) {
  if (method === 'evidence_based') {
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5">
        <BookOpen className="w-3 h-3 mr-1" />
        Evidence
      </Badge>
    );
  }
  if (method === 'proxy') {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] px-1.5">
        <FlaskConical className="w-3 h-3 mr-1" />
        Proxy
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-[10px] px-1.5">
      <AlertTriangle className="w-3 h-3 mr-1" />
      Heuristic
    </Badge>
  );
}

function ConfidenceBar({ level }) {
  const pct = Math.round(level * 100);
  const color = pct >= 60 ? 'bg-green-500' : pct >= 35 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-slate-400">{pct}%</span>
    </div>
  );
}

function CIBar({ lower, predicted, upper }) {
  if (!upper || upper === 0) return <span className="font-mono">{predicted?.toLocaleString() || 0}</span>;
  const maxVal = upper * 1.2 || 1;
  const lPct = Math.round((lower / maxVal) * 100);
  const pPct = Math.round((predicted / maxVal) * 100);
  const uPct = Math.round((upper / maxVal) * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-sm text-slate-200">{predicted?.toLocaleString()}</span>
      <div className="relative w-24 h-3">
        {/* CI range bar */}
        <div
          className="absolute h-1 bg-slate-600 rounded-full top-1"
          style={{ left: `${lPct}%`, width: `${uPct - lPct}%` }}
        />
        {/* Point estimate */}
        <div
          className="absolute w-2 h-3 bg-cyan-400 rounded-sm"
          style={{ left: `${pPct}%`, transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  );
}

function PredictionRow({ prediction, onViewEvidence }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = OUTCOME_ICONS[prediction.outcome_type] || AlertTriangle;
  const hazardColor = HAZARD_COLORS[prediction.hazard_type] || 'text-slate-400';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="hover:bg-slate-800/50 border-slate-800">
        <TableCell className="py-2">
          <CollapsibleTrigger className="flex items-center gap-2 text-left">
            {isOpen ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
            <Icon className="w-4 h-4 text-slate-300" />
            <span className="text-sm text-slate-200">{OUTCOME_LABELS[prediction.outcome_type] || prediction.outcome_type}</span>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="py-2">
          <span className={`text-xs font-medium ${hazardColor}`}>
            {prediction.hazard_type?.replace('_', ' ')}
          </span>
        </TableCell>
        <TableCell className="py-2">
          <CIBar
            lower={prediction.lower_bound}
            predicted={prediction.predicted_value}
            upper={prediction.upper_bound}
          />
        </TableCell>
        <TableCell className="py-2">
          <MethodBadge method={prediction.method} />
        </TableCell>
        <TableCell className="py-2">
          <ConfidenceBar level={prediction.confidence_level || 0} />
        </TableCell>
        <TableCell className="py-2">
          {prediction.evidence_count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-cyan-400 hover:text-cyan-300 text-xs px-2 h-6"
              onClick={() => onViewEvidence?.(prediction)}
            >
              <BookOpen className="w-3 h-3 mr-1" />
              {prediction.evidence_count}
            </Button>
          ) : (
            <span className="text-xs text-slate-600">--</span>
          )}
        </TableCell>
      </TableRow>
      <CollapsibleContent>
        <TableRow className="bg-slate-800/30 border-slate-800">
          <TableCell colSpan={6} className="py-3 px-8">
            <div className="text-xs text-slate-400 space-y-1">
              <div><span className="text-slate-500">Method:</span> {prediction.method_detail}</div>
              <div><span className="text-slate-500">Per 100k:</span> <span className="font-mono">{prediction.predicted_per_100k}</span> {prediction.predicted_unit}</div>
              <div><span className="text-slate-500">Range:</span> <span className="font-mono">{prediction.lower_bound?.toLocaleString()}</span> – <span className="font-mono">{prediction.upper_bound?.toLocaleString()}</span></div>
              <div><span className="text-slate-500">Vuln modifier:</span> <span className="font-mono">{prediction.vulnerability_modifier}</span> | <span className="text-slate-500">Exp modifier:</span> <span className="font-mono">{prediction.exposure_modifier}</span></div>
              {prediction.primary_evidence_doi && (
                <div><span className="text-slate-500">Primary DOI:</span>{' '}
                  <a href={`https://doi.org/${prediction.primary_evidence_doi}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                    {prediction.primary_evidence_doi}
                  </a>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function OutcomePredictions({ outcomePredictions, onViewEvidence }) {
  if (!outcomePredictions || !outcomePredictions.predictions) return null;

  const { predictions, overall_confidence, fallback_used, prediction_count } = outcomePredictions;

  return (
    <Card className="bg-white/5 dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Evidence-Based Outcome Predictions</h3>
            <p className="text-xs text-slate-500">{prediction_count} predictions across detected hazards</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono text-slate-300">
            {Math.round(overall_confidence * 100)}% <span className="text-slate-500 text-xs">avg confidence</span>
          </div>
          {fallback_used && (
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 mt-1">
              Some heuristic fallbacks used
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400 text-xs font-medium">Outcome</TableHead>
              <TableHead className="text-slate-400 text-xs font-medium">Hazard</TableHead>
              <TableHead className="text-slate-400 text-xs font-medium">Predicted</TableHead>
              <TableHead className="text-slate-400 text-xs font-medium">Method</TableHead>
              <TableHead className="text-slate-400 text-xs font-medium">Confidence</TableHead>
              <TableHead className="text-slate-400 text-xs font-medium">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {predictions.map((pred, i) => (
              <PredictionRow
                key={`${pred.hazard_type}-${pred.outcome_type}-${i}`}
                prediction={pred}
                onViewEvidence={onViewEvidence}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}