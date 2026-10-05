import { useEffect, useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import {
  getSites, getForecasts, calculateForecast, getModelCardMetrics,
  getDataCoverage, importObservationsCsv
} from '../lib/api';
import type { MonitoringSite, RiskForecast } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import { riskBadgeColor, sourceBadge, fmt } from '../lib/utils';
import {
  TrendingUp,
  Cpu,
  Sliders,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Waves,
  Droplets,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';

const FACTOR_LABELS: Record<string, string> = {
  rainfall_flush_score: 'Rainfall Flush Hydrodynamics',
  tidal_surge_score: 'Tidal Backflow Inundation',
  catchment_density_score: 'Urban Catchment Debris Density',
  barrier_vulnerability_score: 'Trash Boom Condition Vulnerability',
};

function FactorBar({ label, value, max = 35 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 70 ? 'bg-gradient-to-r from-rose-500 to-red-600' : pct > 45 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : pct > 25 ? 'bg-gradient-to-r from-sky-500 to-cyan-500' : 'bg-gradient-to-r from-teal-400 to-emerald-400';
  return (
    <div className="space-y-1.5 p-2 rounded-xl bg-[#030914] border border-cyan-950">
      <div className="flex justify-between text-xs">
        <span className="text-slate-200 font-semibold">{label}</span>
        <span className="font-mono font-bold text-white">{value.toFixed(1)} <span className="text-slate-400 text-[10px]">/ {max}</span></span>
      </div>
      <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [forecasts, setForecasts] = useState<RiskForecast[]>([]);
  const [modelCard, setModelCard] = useState<any>(null);
  const [coverageData, setCoverageData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<MonitoringSite | null>(null);
  const [simRunning, setSimRunning] = useState(false);

  // CSV Import State
  const [showImport, setShowImport] = useState(false);
  const [importType, setImportType] = useState('rainfall');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulator state
  const [simRain, setSimRain] = useState(65);
  const [simForecast, setSimForecast] = useState(90);
  const [simTide, setSimTide] = useState(3.8);
  const [simDensity, setSimDensity] = useState('High');
  const [simBarrier, setSimBarrier] = useState('Operational');
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [s, f, mc, cov] = await Promise.all([
        getSites(),
        getForecasts(),
        getModelCardMetrics().catch(() => null),
        getDataCoverage().catch(() => [])
      ]);
      setSites(s);
      setForecasts(f);
      setModelCard(mc);
      setCoverageData(cov);
      if (s.length > 0) setSelectedSite(s[0]);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function runSimulation() {
    setSimRunning(true);
    try {
      const r = await calculateForecast({
        rainfall_24h_mm: simRain,
        forecast_24h_mm: simForecast,
        tide_level_m: simTide,
        upstream_urban_density: simDensity,
        barrier_status: simBarrier,
        catchment_area_sqkm: selectedSite?.catchment_area_sqkm ?? 8.0,
        current_water_depth_m: 1.5,
        horizon_hours: 48,
      });
      setSimResult(r);
    } catch {}
    finally { setSimRunning(false); }
  }

  async function handleCsvUpload(file: File) {
    setImportLoading(true);
    setImportResult(null);
    try {
      const r = await importObservationsCsv(file, importType);
      setImportResult(r);
      await load();
    } catch (e: any) {
      alert(`Import error: ${e.message}`);
    } finally {
      setImportLoading(false);
    }
  }

  const siteForecasts = selectedSite
    ? forecasts.filter(f => f.site_id === selectedSite.id)
    : [];

  const latestForecast = siteForecasts[0] ?? null;
  const factors = latestForecast
    ? (() => { try { return JSON.parse(latestForecast.factors_json); } catch { return {}; } })()
    : {};

  const rankingData = sites
    .map(s => ({ id: s.id, name: s.name.split(' ').slice(0, 2).join(' '), score: s.current_risk_score, level: s.current_risk_level }))
    .sort((a, b) => b.score - a.score);

  const levelColors: Record<string, string> = {
    Critical: '#f43f5e',
    High: '#fb923c',
    Medium: '#facc15',
    Low: '#2dd4bf',
  };

  if (loading) return <LoadingSpinner text="Computing hydrodynamic risk forecasts..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Predictive Creek Choke Risk Engine
            </h1>
            <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">48H PROTOTYPE</Badge>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Target: <em>"Relative likelihood of high plastic accumulation at an outlet within 48h following rainfall."</em>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(!showImport)}
            className="text-xs border-cyan-700/60 text-cyan-300 hover:bg-cyan-950"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-cyan-400" />
            Ingest Observations CSV
          </Button>
          <span className="px-2.5 py-1 rounded-xl bg-amber-950/70 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Multi-Factor Physical Model
          </span>
        </div>
      </div>

      {/* CSV Import Drawer */}
      {showImport && (
        <Card className="bg-[#050f20]/95 border-cyan-500/40 shadow-2xl">
          <CardHeader className="pb-3 border-b border-cyan-950/80">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                Data Pipeline: Ingest Observation Records
              </CardTitle>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            <p className="text-xs text-slate-300">
              Upload historical or live CSV files for rainfall rain gauges, ultrasonic water depth, or tidal tables.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-slate-300">Observation Stream:</label>
              <select
                value={importType}
                onChange={e => setImportType(e.target.value)}
                className="text-xs border border-cyan-900/60 rounded-xl px-2.5 py-1.5 bg-[#030914] text-white font-medium focus:outline-none"
              >
                <option value="rainfall">Rainfall Observations (mm)</option>
                <option value="water_level">Water Level & Flow Depth (m)</option>
                <option value="tide">Tidal Gauge Levels (m)</option>
              </select>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleCsvUpload(e.target.files[0]); }}
              />
              <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={importLoading} className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 text-white text-xs">
                Select CSV File
              </Button>
            </div>

            {importResult && (
              <div className="p-3 bg-[#030914] rounded-xl border border-cyan-950 text-xs space-y-1 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">✓ Ingestion Complete</span>
                  <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40">Quality: {importResult.data_quality_pct}%</Badge>
                </div>
                <p className="text-slate-300">
                  Imported <strong>{importResult.imported_rows}</strong> of {importResult.total_rows} rows. (Source status: <strong>{importResult.source_status}</strong>)
                </p>
                {importResult.warnings?.length > 0 && (
                  <div className="text-[11px] text-amber-300 pt-1">
                    <strong>Warnings:</strong> {importResult.warnings.join('; ')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Model Benchmark Comparison Cards */}
      {modelCard && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#050f20]/90 rounded-2xl p-4 space-y-1.5 border-l-4 border-l-slate-500 border border-cyan-950/70 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-bold text-white">Baseline: Rainfall Only</p>
              <Badge className="bg-slate-900 text-slate-300 text-[10px] border border-slate-700">Single Feature</Badge>
            </div>
            <p className="text-slate-300 text-[11px]">Threshold: ≥55mm rain flush</p>
            <div className="pt-2 flex justify-between font-mono text-[11px] border-t border-cyan-950/60">
              <span className="text-slate-400">Precision: <strong className="text-white">{modelCard.model_comparisons?.rainfall_only_baseline?.precision}</strong></span>
              <span className="text-slate-400">Recall: <strong className="text-rose-400">{modelCard.model_comparisons?.rainfall_only_baseline?.recall}</strong></span>
              <span className="text-slate-400">F1: <strong className="text-white">{modelCard.model_comparisons?.rainfall_only_baseline?.f1_score}</strong></span>
            </div>
          </div>

          <div className="bg-[#050f20]/90 rounded-2xl p-4 space-y-1.5 border-l-4 border-l-amber-500 border border-cyan-950/70 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-bold text-white">Model A: JalRakshak Heuristic</p>
              <Badge className="bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px]">Physical Rule</Badge>
            </div>
            <p className="text-slate-300 text-[11px]">Multi-factor physical weighted sum</p>
            <div className="pt-2 flex justify-between font-mono text-[11px] border-t border-cyan-950/60">
              <span className="text-slate-400">Precision: <strong className="text-cyan-300">{modelCard.model_comparisons?.model_a_heuristic?.precision}</strong></span>
              <span className="text-slate-400">Recall: <strong className="text-white">{modelCard.model_comparisons?.model_a_heuristic?.recall}</strong></span>
              <span className="text-slate-400">F1: <strong className="text-white">{modelCard.model_comparisons?.model_a_heuristic?.f1_score}</strong></span>
            </div>
          </div>

          <div className="bg-[#050f20]/90 rounded-2xl p-4 space-y-1.5 border-l-4 border-l-cyan-400 border border-cyan-950/70 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="font-bold text-white">Model B: XGBoost Classifier</p>
              <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px]">Gradient Boosted</Badge>
            </div>
            <p className="text-slate-300 text-[11px]">Chronological 70/30 test split (N={modelCard.data_provenance?.test_samples})</p>
            <div className="pt-2 flex justify-between font-mono text-[11px] border-t border-cyan-950/60">
              <span className="text-slate-400">Precision: <strong className="text-white">{modelCard.model_comparisons?.model_b_xgboost?.precision}</strong></span>
              <span className="text-slate-400">Recall: <strong className="text-cyan-300">{modelCard.model_comparisons?.model_b_xgboost?.recall}</strong></span>
              <span className="text-slate-400">AUC: <strong className="text-emerald-400">{modelCard.model_comparisons?.model_b_xgboost?.roc_auc}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Main Ranking and Detail Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Site Ranking List (4 cols) */}
        <div className="lg:col-span-4">
          <Card className="bg-[#050f20]/95 border-cyan-500/30 shadow-xl h-full">
            <CardHeader className="pb-3 border-b border-cyan-950/80">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                Site Risk Ranking (48h Window)
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Calculated by multi-factor physical risk engine</p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-cyan-950/60 max-h-96 overflow-y-auto">
                {sites.sort((a, b) => b.current_risk_score - a.current_risk_score).map((site, i) => (
                  <div
                    key={site.id}
                    onClick={() => setSelectedSite(site)}
                    className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between ${
                      selectedSite?.id === site.id ? 'bg-cyan-950/80 border-l-4 border-l-cyan-400' : 'hover:bg-[#071326]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-cyan-400 w-4">{i + 1}.</span>
                      <div>
                        <p className="text-xs font-bold text-white">{site.name}</p>
                        <p className="text-[10px] text-cyan-300/80 font-mono">{site.id} · {site.zone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white font-mono">{site.current_risk_score.toFixed(0)}</span>
                      <Badge className={riskBadgeColor(site.current_risk_level)}>{site.current_risk_level}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selected Site Detail & Contributing Factor Breakdown (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Risk Score Distribution Chart */}
          <Card className="bg-[#050f20]/95 border-cyan-500/30 shadow-xl">
            <CardHeader className="pb-3 border-b border-cyan-950/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    48h Risk Score Comparison Across 10 Outfalls
                  </CardTitle>
                  <p className="text-xs text-slate-400 mt-0.5">Comparative horizontal distribution</p>
                </div>
                <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">10 BASINS</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={rankingData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0b1b30" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#1e293b" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#cbd5e1' }} width={80} stroke="#1e293b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#030914', borderColor: '#06b6d4', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                    formatter={(val: any) => [`${val}/100 Risk Score`, 'Score']}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {rankingData.map((d, i) => (
                      <Cell key={i} fill={levelColors[d.level] ?? '#0d9488'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Selected Site Breakdown */}
          {selectedSite && (
            <Card className="bg-[#050f20]/95 border-l-4 border-l-cyan-400 border border-cyan-500/30 shadow-xl">
              <CardHeader className="pb-3 border-b border-cyan-950/80">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/40">
                        {selectedSite.id}
                      </span>
                      <CardTitle className="text-base font-extrabold text-white font-heading">{selectedSite.name}</CardTitle>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">📍 {selectedSite.location_description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={riskBadgeColor(selectedSite.current_risk_level)}>
                      {selectedSite.current_risk_level} — {selectedSite.current_risk_score.toFixed(1)}/100
                    </Badge>
                    {latestForecast && <Badge className={sourceBadge(latestForecast.source_status)}>{latestForecast.source_status}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {latestForecast && (
                  <>
                    <div className="p-3 bg-[#030914] border border-cyan-500/30 rounded-xl text-xs text-slate-200 font-medium flex items-center gap-2">
                      <span className="text-cyan-400 font-bold shrink-0">Operator Directive:</span>
                      <span>{latestForecast.action_recommendation}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      <div className="bg-[#030914] border border-cyan-950 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Predicted Plastic Mass</p>
                        <p className="text-xl font-black text-cyan-300 font-mono mt-1">{latestForecast.predicted_plastic_volume_kg.toFixed(0)} kg</p>
                      </div>
                      <div className="bg-[#030914] border border-cyan-950 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Culvert Choke Probability</p>
                        <p className="text-xl font-black text-rose-400 font-mono mt-1">{latestForecast.choke_probability_pct.toFixed(0)}%</p>
                      </div>
                      <div className="bg-[#030914] border border-cyan-950 rounded-xl p-3 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Observation Window</p>
                        <p className="text-xl font-black text-teal-300 font-mono mt-1">{latestForecast.horizon_hours} Hours</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-bold text-slate-200 uppercase tracking-wide">4-Factor Attribution Breakdown:</p>
                      {Object.entries(factors).map(([key, val]) => (
                        <FactorBar key={key} label={FACTOR_LABELS[key] ?? key} value={val as number} />
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Scenario Simulator */}
      <Card className="bg-[#050f20]/95 border-cyan-500/30 shadow-2xl">
        <CardHeader className="pb-3 border-b border-cyan-950/80">
          <CardTitle className="text-white">Rainfall & Tidal Surge Scenario Simulator</CardTitle>
          <p className="text-xs text-slate-400 mt-0.5">Explore how baseline risk scores and choke likelihood respond to varying storm intensities</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {[
                { label: `Rainfall 24h: ${simRain} mm`, min: 0, max: 200, step: 5, val: simRain, set: setSimRain },
                { label: `Forecast 24h: ${simForecast} mm`, min: 0, max: 250, step: 5, val: simForecast, set: setSimForecast },
                { label: `Tide Level: ${simTide.toFixed(1)} m`, min: 0.5, max: 5.5, step: 0.1, val: simTide, set: setSimTide },
              ].map(({ label, min, max, step, val, set }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span>{label}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={val} onChange={e => set(parseFloat(e.target.value))} className="w-full accent-cyan-400" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Urban Density</label>
                  <select value={simDensity} onChange={e => setSimDensity(e.target.value)} className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 mt-1 bg-[#030914] text-white focus:outline-none">
                    {['Low', 'Moderate', 'High', 'Very High'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Barrier Status</label>
                  <select value={simBarrier} onChange={e => setSimBarrier(e.target.value)} className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 mt-1 bg-[#030914] text-white focus:outline-none">
                    {['Operational', 'Partially Blocked', 'Under Maintenance', 'Breached'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <Button onClick={runSimulation} loading={simRunning} className="w-full justify-center bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 text-white font-bold mt-2">
                Calculate Risk Score
              </Button>
            </div>

            {simResult ? (
              <div className="space-y-3">
                <div className={`p-4 rounded-xl border ${riskBadgeColor(simResult.risk_level as string)}`}>
                  <p className="text-xs text-slate-300 font-medium">Simulated 48h Risk Score</p>
                  <p className="text-4xl font-black mt-1 font-mono text-white">
                    {(simResult.risk_score as number).toFixed(1)}
                  </p>
                  <Badge className={`mt-1.5 ${riskBadgeColor(simResult.risk_level as string)}`}>{simResult.risk_level as string}</Badge>
                </div>
                <div className="p-3 bg-[#030914] border border-cyan-950 rounded-xl text-xs text-slate-200">
                  {simResult.action_recommendation as string}
                </div>
                <div className="space-y-2">
                  {Object.entries(simResult.factors as Record<string, number>).map(([k, v]) => (
                    <FactorBar key={k} label={FACTOR_LABELS[k] ?? k} value={v} />
                  ))}
                </div>
                <Badge className="bg-purple-950 text-purple-300 border border-purple-500/40">SIMULATED SCENARIO — Not a field measurement</Badge>
              </div>
            ) : (
              <div className="flex items-center justify-center text-slate-400 text-sm">
                Run simulation to see risk breakdown →
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
