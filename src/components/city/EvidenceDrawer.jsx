import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BookOpen, ExternalLink, Star, Calendar, Users, Globe, FlaskConical, Shield
} from 'lucide-react';

function QualityStars({ score }) {
  const stars = Math.round((score || 0.5) * 5);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`w-3 h-3 ${i <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`}
        />
      ))}
      <span className="text-[10px] text-slate-400 ml-1">({(score || 0.5).toFixed(2)})</span>
    </div>
  );
}

function EvidenceCard({ evidence }) {
  if (!evidence) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
      {/* Title & DOI */}
      <div>
        <h4 className="text-sm font-medium text-slate-200 leading-snug">{evidence.title || 'Untitled'}</h4>
        {evidence.doi && (
          <a
            href={`https://doi.org/${evidence.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mt-1"
          >
            <ExternalLink className="w-3 h-3" />
            {evidence.doi}
          </a>
        )}
      </div>

      {/* Authors & Journal */}
      <div className="text-xs text-slate-400 space-y-1">
        {evidence.authors && evidence.authors.length > 0 && (
          <div className="flex items-start gap-1.5">
            <Users className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{evidence.authors.slice(0, 5).join(', ')}{evidence.authors.length > 5 ? ' et al.' : ''}</span>
          </div>
        )}
        {evidence.journal && (
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3 h-3 shrink-0" />
            <span className="italic">{evidence.journal}</span>
            {evidence.year && <span>({evidence.year})</span>}
          </div>
        )}
      </div>

      <Separator className="bg-slate-700" />

      {/* Effect size & metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Effect metric</div>
          <div className="text-sm font-mono text-slate-200">{evidence.effect_metric?.replace('_', ' ') || '--'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Effect value</div>
          <div className="text-sm font-mono text-cyan-400">
            {evidence.effect_value != null ? evidence.effect_value : '--'}
            {evidence.confidence_interval && (
              <span className="text-slate-500 text-xs ml-1">
                [{evidence.confidence_interval[0]}, {evidence.confidence_interval[1]}]
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Effect unit</div>
          <div className="text-xs text-slate-300">{evidence.effect_unit || '--'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Baseline rate</div>
          <div className="text-sm font-mono text-slate-200">
            {evidence.baseline_rate_per_100k != null ? `${evidence.baseline_rate_per_100k}/100k` : '--'}
          </div>
        </div>
      </div>

      <Separator className="bg-slate-700" />

      {/* Metadata */}
      <div className="flex flex-wrap gap-2">
        {evidence.hazard_type && (
          <Badge className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30">
            {evidence.hazard_type}
          </Badge>
        )}
        {evidence.outcome_type && (
          <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30">
            {evidence.outcome_type}
          </Badge>
        )}
        {evidence.climate_zone && (
          <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
            <Globe className="w-3 h-3 mr-1" />{evidence.climate_zone}
          </Badge>
        )}
        {evidence.verified && (
          <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
            <Shield className="w-3 h-3 mr-1" />Verified
          </Badge>
        )}
      </div>

      {/* Quality + Sample */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">Study quality:</span>
          <QualityStars score={evidence.study_quality_score} />
        </div>
        {evidence.sample_size && (
          <span className="text-[10px] text-slate-400">n={evidence.sample_size.toLocaleString()}</span>
        )}
      </div>

      {/* Population & Region */}
      {(evidence.population_studied || evidence.region) && (
        <div className="text-xs text-slate-500">
          {evidence.population_studied && <div>Population: {evidence.population_studied}</div>}
          {evidence.region && <div>Region: {evidence.region}</div>}
        </div>
      )}

      {/* Relevance score */}
      {evidence.relevance_score != null && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-slate-500">Relevance:</span>
          <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${evidence.relevance_score * 100}%` }} />
          </div>
          <span className="text-[10px] font-mono text-slate-400">{(evidence.relevance_score * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

export default function EvidenceDrawer({ open, onClose, prediction, evidenceList }) {
  if (!prediction) return null;

  const evidence = evidenceList || [];

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DrawerContent className="bg-slate-900 border-slate-800 max-h-[85vh]">
        <DrawerHeader className="border-b border-slate-800 pb-4">
          <DrawerTitle className="text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            Supporting Evidence
          </DrawerTitle>
          <DrawerDescription className="text-slate-400">
            {evidence.length} peer-reviewed {evidence.length === 1 ? 'study' : 'studies'} for{' '}
            <span className="text-slate-300">{prediction.hazard_type?.replace('_', ' ')}</span>
            {' '}&rarr;{' '}
            <span className="text-slate-300">{prediction.outcome_type?.replace('_', ' ')}</span>
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4 py-4" style={{ maxHeight: 'calc(85vh - 160px)' }}>
          {evidence.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No evidence entries found for this prediction.</p>
              <p className="text-xs mt-1">This prediction uses heuristic estimates.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {evidence.map((ev, i) => (
                <EvidenceCard key={ev.id || i} evidence={ev} />
              ))}
            </div>
          )}
        </ScrollArea>

        <DrawerFooter className="border-t border-slate-800 pt-3">
          <Button variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:bg-slate-800">
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}