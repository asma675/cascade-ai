import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  BookOpen, Search, FlaskConical, Database, History,
  Plus, Trash2, Download, Upload, RefreshCw, Check, X,
  Loader2, ExternalLink, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/landing/ThemeToggle';

const EVIDENCE_SERVICE_URL = import.meta.env.VITE_EVIDENCE_SERVICE_URL || 'http://localhost:5001';

const HAZARD_TYPES = ['heatwave', 'drought', 'flood', 'wildfire', 'air_quality', 'high_wind'];
const OUTCOME_TYPES = ['mortality', 'hospitalizations', 'displacement', 'infrastructure_stress', 'vegetation_stress', 'fire_activity', 'aid_requests'];

async function apiCall(path, options = {}) {
  const resp = await fetch(`${EVIDENCE_SERVICE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function EvidenceTable({ evidence, onDelete, onRefresh }) {
  if (!evidence || evidence.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No evidence entries found.</p>
        <p className="text-xs mt-1">Use the Seed button to load curated evidence, or search literature.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-800 hover:bg-transparent">
            <TableHead className="text-slate-400 text-xs">Title</TableHead>
            <TableHead className="text-slate-400 text-xs">Hazard</TableHead>
            <TableHead className="text-slate-400 text-xs">Outcome</TableHead>
            <TableHead className="text-slate-400 text-xs">Effect</TableHead>
            <TableHead className="text-slate-400 text-xs">Year</TableHead>
            <TableHead className="text-slate-400 text-xs">Source</TableHead>
            <TableHead className="text-slate-400 text-xs">Status</TableHead>
            <TableHead className="text-slate-400 text-xs w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {evidence.map((ev) => (
            <TableRow key={ev.id} className="border-slate-800 hover:bg-slate-800/50">
              <TableCell className="max-w-[250px]">
                <div className="text-sm text-slate-200 truncate" title={ev.title}>{ev.title || '--'}</div>
                {ev.doi && (
                  <a href={`https://doi.org/${ev.doi}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5">
                    <ExternalLink className="w-2.5 h-2.5" />{ev.doi}
                  </a>
                )}
              </TableCell>
              <TableCell>
                <Badge className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30">{ev.hazard_type}</Badge>
              </TableCell>
              <TableCell>
                <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30">{ev.outcome_type}</Badge>
              </TableCell>
              <TableCell className="font-mono text-sm text-slate-300">
                {ev.effect_value != null ? ev.effect_value : '--'}
                <span className="text-slate-500 text-[10px] ml-1">{ev.effect_metric?.replace('_', ' ')}</span>
              </TableCell>
              <TableCell className="text-sm text-slate-400">{ev.year || '--'}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">{ev.source_api || 'unknown'}</Badge>
              </TableCell>
              <TableCell>
                {ev.verified ? (
                  <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30"><Check className="w-3 h-3 mr-0.5" />Verified</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">Unverified</Badge>
                )}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-red-400" onClick={() => onDelete(ev.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CandidatesTable({ candidates, onExtract, extracting }) {
  if (!candidates || candidates.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p>No literature candidates yet.</p>
        <p className="text-xs mt-1">Use the Literature Search tab to find papers.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-800 hover:bg-transparent">
            <TableHead className="text-slate-400 text-xs">Title</TableHead>
            <TableHead className="text-slate-400 text-xs">Source</TableHead>
            <TableHead className="text-slate-400 text-xs">Year</TableHead>
            <TableHead className="text-slate-400 text-xs">Status</TableHead>
            <TableHead className="text-slate-400 text-xs w-24">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((c) => (
            <TableRow key={c.id} className="border-slate-800 hover:bg-slate-800/50">
              <TableCell className="max-w-[300px]">
                <div className="text-sm text-slate-200 truncate" title={c.title}>{c.title || '--'}</div>
                {c.doi && (
                  <a href={`https://doi.org/${c.doi}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:underline">
                    {c.doi}
                  </a>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">{c.source_api}</Badge>
              </TableCell>
              <TableCell className="text-sm text-slate-400">{c.year || '--'}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`text-[10px] ${c.status === 'extracted' ? 'border-green-500/30 text-green-400' : c.status === 'error' ? 'border-red-500/30 text-red-400' : 'border-slate-600 text-slate-400'}`}>
                  {c.status}
                </Badge>
              </TableCell>
              <TableCell>
                {c.status === 'found' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={() => onExtract(c.id)}
                    disabled={extracting === c.id}
                  >
                    {extracting === c.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <FlaskConical className="w-3 h-3 mr-1" />
                    )}
                    Extract
                  </Button>
                )}
                {c.status === 'extracted' && <span className="text-xs text-green-400">Done</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminEvidence() {
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [queryLogs, setQueryLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serviceUp, setServiceUp] = useState(null);

  // Search form
  const [searchHazard, setSearchHazard] = useState('heatwave');
  const [searchOutcome, setSearchOutcome] = useState('mortality');
  const [searchTerms, setSearchTerms] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  // Extraction
  const [extracting, setExtracting] = useState(null);

  const checkHealth = useCallback(async () => {
    try {
      await apiCall('/health');
      setServiceUp(true);
    } catch {
      setServiceUp(false);
    }
  }, []);

  const loadEvidence = useCallback(async () => {
    try {
      const data = await apiCall('/evidence');
      setEvidence(data.evidence || []);
    } catch (e) {
      console.error('Failed to load evidence:', e);
    }
  }, []);

  const loadCandidates = useCallback(async () => {
    try {
      const data = await apiCall('/candidates');
      setCandidates(data.candidates || []);
    } catch (e) {
      console.error('Failed to load candidates:', e);
    }
  }, []);

  const loadQueryLogs = useCallback(async () => {
    try {
      const data = await apiCall('/query-logs');
      setQueryLogs(data.logs || []);
    } catch (e) {
      console.error('Failed to load logs:', e);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([checkHealth(), loadEvidence(), loadCandidates(), loadQueryLogs()]);
    setLoading(false);
  }, [checkHealth, loadEvidence, loadCandidates, loadQueryLogs]);

  useEffect(() => { loadAll(); }, []);

  const handleSeed = async () => {
    try {
      const data = await apiCall('/evidence/seed', { method: 'POST' });
      toast.success(`Loaded ${data.loaded} seed entries (${data.total_evidence} total)`);
      loadEvidence();
    } catch (e) {
      toast.error(`Seed failed: ${e.message}`);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiCall(`/evidence/${id}`, { method: 'DELETE' });
      toast.success('Evidence deleted');
      loadEvidence();
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    setSearchResults(null);
    try {
      const data = await apiCall('/literature/search', {
        method: 'POST',
        body: JSON.stringify({
          hazard_type: searchHazard,
          outcome_type: searchOutcome,
          additional_terms: searchTerms,
          sources: ['pubmed', 'openalex'],
          max_results: 15,
        }),
      });
      setSearchResults(data);
      toast.success(`Found ${data.deduplicated_count} papers`);
      loadCandidates();
      loadQueryLogs();
    } catch (e) {
      toast.error(`Search failed: ${e.message}`);
    }
    setSearching(false);
  };

  const handleExtract = async (candidateId) => {
    setExtracting(candidateId);
    try {
      const data = await apiCall('/literature/extract', {
        method: 'POST',
        body: JSON.stringify({ candidate_id: candidateId }),
      });
      if (data.status === 'success') {
        toast.success('Evidence extracted successfully');
        loadEvidence();
        loadCandidates();
      } else {
        toast.error(`Extraction failed: ${data.error}`);
      }
    } catch (e) {
      toast.error(`Extraction failed: ${e.message}`);
    }
    setExtracting(null);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/Landing')} className="text-slate-400 hover:text-slate-200">
                <ArrowLeft className="w-4 h-4 mr-1" />Back
              </Button>
              <Separator orientation="vertical" className="h-6 bg-slate-700" />
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" />
                <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Evidence Registry</h1>
              </div>
              {serviceUp === true && <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">Service Online</Badge>}
              {serviceUp === false && <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">Service Offline</Badge>}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="border-slate-700 text-slate-300">
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleSeed} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                <Upload className="w-3.5 h-3.5 mr-1" />Seed Data
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <Tabs defaultValue="evidence" className="space-y-4">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="evidence" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
              <Database className="w-3.5 h-3.5 mr-1.5" />Evidence ({evidence.length})
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Search className="w-3.5 h-3.5 mr-1.5" />Literature Search
            </TabsTrigger>
            <TabsTrigger value="candidates" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
              <BookOpen className="w-3.5 h-3.5 mr-1.5" />Candidates ({candidates.length})
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-500/20 data-[state=active]:text-slate-300">
              <History className="w-3.5 h-3.5 mr-1.5" />Query Log ({queryLogs.length})
            </TabsTrigger>
          </TabsList>

          {/* Evidence Tab */}
          <TabsContent value="evidence">
            <Card className="bg-white/5 dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5">
              <EvidenceTable evidence={evidence} onDelete={handleDelete} onRefresh={loadEvidence} />
            </Card>
          </TabsContent>

          {/* Literature Search Tab */}
          <TabsContent value="search">
            <Card className="bg-white/5 dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5">
              <h3 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan-400" />
                Search Scholarly Literature
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Hazard Type</label>
                  <Select value={searchHazard} onValueChange={setSearchHazard}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {HAZARD_TYPES.map(h => (
                        <SelectItem key={h} value={h} className="text-slate-200">{h.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Outcome Type</label>
                  <Select value={searchOutcome} onValueChange={setSearchOutcome}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {OUTCOME_TYPES.map(o => (
                        <SelectItem key={o} value={o} className="text-slate-200">{o.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Additional terms</label>
                  <Input
                    value={searchTerms}
                    onChange={e => setSearchTerms(e.target.value)}
                    placeholder="e.g. elderly, tropical"
                    className="bg-slate-800 border-slate-700 text-slate-200 h-9"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleSearch}
                    disabled={searching}
                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-9"
                  >
                    {searching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                    Search
                  </Button>
                </div>
              </div>

              {searchResults && (
                <div className="mt-4">
                  <div className="text-sm text-slate-400 mb-2">
                    Query: <span className="text-slate-300 font-mono text-xs">{searchResults.query}</span>
                    <span className="ml-3">Found: {searchResults.total_found}</span>
                    <span className="ml-3">Deduplicated: {searchResults.deduplicated_count}</span>
                  </div>
                  <div className="space-y-2">
                    {(searchResults.candidates || []).map((c, i) => (
                      <div key={c.id || i} className="rounded border border-slate-700 bg-slate-800/50 p-3">
                        <div className="text-sm text-slate-200">{c.title}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {c.journal} {c.year && `(${c.year})`}
                          {c.doi && (
                            <a href={`https://doi.org/${c.doi}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline ml-2">
                              DOI
                            </a>
                          )}
                        </div>
                        {c.abstract && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.abstract}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Candidates Tab */}
          <TabsContent value="candidates">
            <Card className="bg-white/5 dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5">
              <CandidatesTable candidates={candidates} onExtract={handleExtract} extracting={extracting} />
            </Card>
          </TabsContent>

          {/* Query Logs Tab */}
          <TabsContent value="logs">
            <Card className="bg-white/5 dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-5">
              {queryLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No search queries yet.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-800">
                        <TableHead className="text-slate-400 text-xs">Date</TableHead>
                        <TableHead className="text-slate-400 text-xs">Hazard</TableHead>
                        <TableHead className="text-slate-400 text-xs">Outcome</TableHead>
                        <TableHead className="text-slate-400 text-xs">Query</TableHead>
                        <TableHead className="text-slate-400 text-xs">Found</TableHead>
                        <TableHead className="text-slate-400 text-xs">Stored</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queryLogs.slice().reverse().map((log) => (
                        <TableRow key={log.id} className="border-slate-800">
                          <TableCell className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</TableCell>
                          <TableCell><Badge className="text-[10px] bg-orange-500/20 text-orange-400">{log.hazard_type}</Badge></TableCell>
                          <TableCell><Badge className="text-[10px] bg-purple-500/20 text-purple-400">{log.outcome_type}</Badge></TableCell>
                          <TableCell className="text-xs text-slate-300 max-w-[300px] truncate font-mono">{log.query}</TableCell>
                          <TableCell className="text-xs text-slate-400">{log.total_found}</TableCell>
                          <TableCell className="text-xs text-slate-400">{log.candidates_stored}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}