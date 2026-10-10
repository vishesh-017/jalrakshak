/**
 * JalRakshak — Monsoon Blockage Detection Dashboard
 *
 * Identifies suspicious drainage behaviour using water level, flow rate,
 * and rainfall sensors. Does NOT claim a plastic blockage is confirmed from
 * sensor data alone — all anomalies are flagged as suspected until inspected.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle, Activity, Droplets, Wind, CloudRain, Wifi, WifiOff,
  Play, Pause, SkipForward, RotateCcw, CheckCircle2, XCircle, Eye,
  ClipboardList, MapPin, Info, AlertCircle, Zap, Thermometer, Radio,
  ChevronDown, ChevronUp, Clock, User, Camera, FileText, Shield, ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useRbac, PERSONAS } from '../context/RbacContext';

const BASE = 'http://localhost:8000/api';

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

interface MonsoonStation {
  id: string;
  name: string;
  zone: string;
  latitude: number;
  longitude: number;
  sensor_mode: 'Simulated' | 'Real';
  has_flow_sensor: boolean;
  has_rainfall_gauge: boolean;
  culvert_capacity_m: number;
  baseline_depth_m: number;
  known_plastic_nearby_kg: number;
  prior_anomaly_count: number;
  downstream_vulnerability: string;
  current_water_depth_m: number | null;
  current_flow_velocity_mps: number | null;
  current_rainfall_mm: number | null;
  current_status: string;
  current_risk_score: number;
  current_risk_category: string;
  last_reading_at: string | null;
  is_stale: boolean;
}

interface EvidenceFactor {
  factor: string;
  contribution: string;
  detail: string;
  baseline: string;
  measured: string;
}

interface AnomalyResult {
  status: string;
  risk_score: number;
  risk_category: string;
  triggered_rules: string[];
  evidence_factors: EvidenceFactor[];
  missing_data: string[];
  rainfall_context: string;
  recommended_action: string;
  confidence_note: string;
  timestamp: string;
}

interface Incident {
  id: string;
  station_id: string;
  station_name: string;
  zone: string;
  latitude: number;
  longitude: number;
  status: string;
  blockage_status: string;
  risk_score: number;
  risk_category: string;
  triggered_rules: string[];
  evidence_factors: EvidenceFactor[];
  missing_data: string[];
  rainfall_context: string;
  confidence_note: string;
  recommended_action: string;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  inspector_name: string | null;
  resolved_at: string | null;
  resolution: string | null;
  inspection_notes: string | null;
  inspection_photos: { url: string; caption: string }[];
  is_simulated: boolean;
}

interface ScenarioDef {
  key: string;
  name: string;
  description: string;
  step_count: number;
}

interface ScenarioStep {
  t: number;
  rainfall_mm: number | null;
  water_depth_m: number | null;
  flow_velocity_mps: number | null;
  label: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err?.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function riskColor(cat: string) {
  switch (cat) {
    case 'Critical': return 'text-red-400';
    case 'High':     return 'text-orange-400';
    case 'Medium':   return 'text-yellow-400';
    case 'Low':      return 'text-emerald-400';
    default:         return 'text-slate-400';
  }
}

function riskBg(cat: string) {
  switch (cat) {
    case 'Critical': return 'bg-red-500/15 border-red-500/40';
    case 'High':     return 'bg-orange-500/15 border-orange-500/40';
    case 'Medium':   return 'bg-yellow-500/15 border-yellow-500/40';
    case 'Low':      return 'bg-emerald-500/15 border-emerald-500/40';
    default:         return 'bg-slate-800/60 border-slate-600/40';
  }
}

function riskBadge(cat: string) {
  switch (cat) {
    case 'Critical': return 'bg-red-500/20 text-red-300 border border-red-500/40';
    case 'High':     return 'bg-orange-500/20 text-orange-300 border border-orange-500/40';
    case 'Medium':   return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40';
    case 'Low':      return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    default:         return 'bg-slate-800 text-slate-400 border border-slate-600/40';
  }
}

function GaugeBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SimBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 uppercase tracking-wider">
      <Zap className="w-2.5 h-2.5" /> SIMULATED
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Station Card
// ──────────────────────────────────────────────────────────────────────────

function StationCard({
  station, selected, onClick
}: {
  station: MonsoonStation;
  selected: boolean;
  onClick: () => void;
}) {
  const cat = station.current_risk_category;
  const noData = station.current_water_depth_m === null;
  const isOnline = !station.is_stale && !noData;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3.5 rounded-xl border transition-all duration-200',
        selected ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'border-slate-700/50 bg-[#050e1d] hover:border-cyan-500/40',
        riskBg(cat)
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn('w-2 h-2 rounded-full shrink-0', isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
            <span className="text-[10px] font-mono text-slate-400">{station.id}</span>
            {station.sensor_mode === 'Simulated' && <SimBadge />}
          </div>
          <h3 className="text-sm font-bold text-slate-100 truncate leading-tight">{station.name}</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">{station.zone}</p>
        </div>
        <div className="shrink-0">
          <span className={cn('text-[10px] font-black px-2 py-1 rounded-lg', riskBadge(cat))}>
            {noData ? 'OFFLINE' : cat.toUpperCase()}
          </span>
        </div>
      </div>

      {noData ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>No readings yet — run a scenario to start</span>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="text-center">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Water</p>
            <p className="text-sm font-bold text-cyan-300">{station.current_water_depth_m?.toFixed(2)}m</p>
            <GaugeBar value={station.current_water_depth_m ?? 0} max={station.culvert_capacity_m} color="bg-cyan-500" />
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Flow</p>
            {station.has_flow_sensor && station.current_flow_velocity_mps !== null ? (
              <>
                <p className="text-sm font-bold text-blue-300">{station.current_flow_velocity_mps?.toFixed(2)}<span className="text-[9px]">m/s</span></p>
                <GaugeBar value={station.current_flow_velocity_mps ?? 0} max={2} color="bg-blue-500" />
              </>
            ) : (
              <p className="text-[10px] text-slate-500 mt-0.5">No sensor</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-[9px] text-slate-500 uppercase tracking-wider">Rain</p>
            {station.has_rainfall_gauge && station.current_rainfall_mm !== null ? (
              <>
                <p className="text-sm font-bold text-indigo-300">{station.current_rainfall_mm?.toFixed(1)}<span className="text-[9px]">mm</span></p>
                <GaugeBar value={station.current_rainfall_mm ?? 0} max={80} color="bg-indigo-500" />
              </>
            ) : (
              <p className="text-[10px] text-slate-500 mt-0.5">No gauge</p>
            )}
          </div>
        </div>
      )}

      {!noData && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
          <AlertTriangle className={cn('w-3 h-3', riskColor(cat))} />
          <span className={cn('font-semibold', riskColor(cat))} title={station.current_status}>
            {station.current_status.length > 38 ? station.current_status.slice(0, 38) + '…' : station.current_status}
          </span>
        </div>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Evidence Panel
// ──────────────────────────────────────────────────────────────────────────

function EvidencePanel({ factors, missing }: { factors: EvidenceFactor[]; missing: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-[#050e1d] border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          Explainable Risk Factors
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2.5">
          {missing.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">Missing sensor data: </span>
                <span className="text-slate-300">{missing.join(', ')} — conclusions are limited by unavailable evidence.</span>
              </div>
            </div>
          )}

          {factors.map((f, i) => {
            const isUnavail = f.contribution === 'UNAVAILABLE';
            const isZero = f.contribution.startsWith('+0');
            return (
              <div key={i} className={cn(
                'rounded-lg p-2.5 border text-[11px]',
                isUnavail ? 'bg-slate-800/40 border-slate-600/30' :
                isZero ? 'bg-slate-900/40 border-slate-700/20' :
                'bg-cyan-950/30 border-cyan-500/20'
              )}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-slate-200">{f.factor}</span>
                  <span className={cn(
                    'font-mono text-[10px] shrink-0 px-1.5 py-0.5 rounded font-black',
                    isUnavail ? 'bg-slate-700 text-slate-400' :
                    isZero ? 'bg-slate-800 text-slate-500' :
                    'bg-cyan-900 text-cyan-300'
                  )}>{f.contribution}</span>
                </div>
                <p className="text-slate-400 leading-relaxed">{f.detail}</p>
                {!isUnavail && (
                  <div className="flex gap-4 mt-1.5 text-[10px] text-slate-500">
                    <span>Baseline: <span className="text-slate-400">{f.baseline}</span></span>
                    <span>Measured: <span className="text-slate-300">{f.measured}</span></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Incident Detail Panel
// ──────────────────────────────────────────────────────────────────────────

function IncidentPanel({ incident, onRefresh }: { incident: Incident; onRefresh: () => void }) {
  const { user } = useRbac();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [ackBy, setAckBy] = useState(user.name.split('(')[0]);
  const [inspectorName, setInspectorName] = useState('');
  const [resolution, setResolution] = useState('false_alarm');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const acknowledge = async () => {
    setBusy(true);
    try {
      await apiFetch(`/monsoon/incidents/${incident.id}/acknowledge`, {
        method: 'PATCH',
        body: JSON.stringify({ acknowledged_by: ackBy, inspector_name: inspectorName || undefined }),
      });
      onRefresh();
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const resolve = async () => {
    setBusy(true);
    try {
      await apiFetch(`/monsoon/incidents/${incident.id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution, inspection_notes: notes }),
      });
      onRefresh();
      setResolveOpen(false);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const statusBadge = (s: string) => {
    if (s === 'Open') return 'bg-red-500/20 text-red-300 border-red-500/40';
    if (s === 'Acknowledged') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    if (s === 'Inspector Dispatched') return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
    if (s === 'Resolved') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    return 'bg-slate-700 text-slate-400 border-slate-600';
  };

  return (
    <div className="bg-[#050e1d] border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('w-4 h-4', riskColor(incident.risk_category))} />
          <span className="text-sm font-bold text-slate-100">{incident.id}</span>
          {incident.is_simulated && <SimBadge />}
        </div>
        <span className={cn('text-[10px] font-black px-2 py-1 rounded border uppercase', statusBadge(incident.status))}>
          {incident.status}
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs font-bold text-slate-300 mb-0.5">{incident.station_name}</p>
          <p className="text-[11px] text-slate-400">{incident.zone}</p>
          <p className="text-[10px] text-slate-500 mt-1">Created: {new Date(incident.created_at).toLocaleString('en-IN')}</p>
        </div>

        {/* Blockage Status */}
        <div className={cn('rounded-lg p-3 border text-xs', riskBg(incident.risk_category))}>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('font-black text-[10px] px-2 py-0.5 rounded', riskBadge(incident.risk_category))}>
              Priority Score: {incident.risk_score.toFixed(0)}/100
            </span>
          </div>
          <p className="font-bold text-slate-200 mb-1">{incident.blockage_status}</p>
          <p className="text-slate-400 leading-relaxed">{incident.recommended_action}</p>
        </div>

        {/* Confidence note */}
        <div className="flex items-start gap-2 bg-slate-800/40 rounded-lg p-2.5 text-[11px]">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-slate-400">{incident.confidence_note}</p>
        </div>

        {/* Rainfall context */}
        <div className="flex items-start gap-2 bg-indigo-950/30 rounded-lg p-2.5 text-[11px]">
          <CloudRain className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-slate-300">{incident.rainfall_context}</p>
        </div>

        {/* Evidence factors */}
        <EvidencePanel factors={incident.evidence_factors} missing={incident.missing_data} />

        {/* Inspection photos */}
        {incident.inspection_photos.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Inspection Photos</p>
            <div className="space-y-1.5">
              {incident.inspection_photos.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-800/40 rounded-lg p-2 text-[11px]">
                  <Camera className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="text-slate-300">{p.caption || p.url}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions (role gated) */}
        {incident.status !== 'Resolved' && (
          <div className="space-y-2 pt-2 border-t border-slate-700/40">
            {incident.status === 'Open' && user.canApproveDispatch && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Acknowledge & Assign Inspector</p>
                <select
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  value={inspectorName}
                  onChange={e => setInspectorName(e.target.value)}
                >
                  <option value="">-- Select an Inspector (Optional) --</option>
                  {Object.values(PERSONAS)
                    .filter(p => p.role === 'FIELD_WORKER' || p.role === 'INSPECTOR')
                    .map(insp => (
                      <option key={insp.id} value={insp.name}>
                        {insp.name} — {insp.title}
                      </option>
                    ))}
                </select>
                <button
                  disabled={busy}
                  onClick={acknowledge}
                  className="w-full py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {busy ? 'Saving…' : '✓ Acknowledge Incident'}
                </button>
              </div>
            )}

            {incident.status !== 'Open' && (user.canApproveDispatch || user.role === 'INSPECTOR') && (
              <>
                <button
                  onClick={() => setResolveOpen(o => !o)}
                  className="w-full py-2 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/40 text-slate-300 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Classify & Resolve Incident
                </button>
                {resolveOpen && (
                  <div className="space-y-2 bg-slate-900/60 rounded-xl p-3 border border-slate-700/40">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Resolution Classification</p>
                    {[
                      { v: 'confirmed_blockage', l: 'Confirmed Blockage', desc: 'Physical blockage found and verified by inspector' },
                      { v: 'other_drainage', l: 'Other Drainage Issue', desc: 'Another cause identified (collapse, sedimentation, etc.)' },
                      { v: 'false_alarm', l: 'False Alarm', desc: 'No blockage found — anomaly had another explanation' },
                      { v: 'resolved', l: 'Resolved', desc: 'Situation resolved — no further action needed' },
                    ].map(({ v, l, desc }) => (
                      <label key={v} className={cn(
                        'flex items-start gap-2 p-2 rounded-lg cursor-pointer border transition-colors',
                        resolution === v ? 'border-cyan-500/60 bg-cyan-950/30' : 'border-slate-700/40 hover:border-slate-600/60'
                      )}>
                        <input type="radio" name="resolution" value={v} checked={resolution === v} onChange={() => setResolution(v)} className="mt-0.5" />
                        <div>
                          <span className="text-xs font-bold text-slate-200">{l}</span>
                          <p className="text-[10px] text-slate-500">{desc}</p>
                        </div>
                      </label>
                    ))}
                    <textarea
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                      placeholder="Inspector findings / notes…"
                      rows={3}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                    <button
                      disabled={busy}
                      onClick={resolve}
                      className="w-full py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {busy ? 'Saving…' : '✓ Submit Resolution'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {incident.status === 'Resolved' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-emerald-300">Resolved: </span>
              <span className="text-slate-300">{incident.resolution?.replace('_', ' ')} — {incident.inspection_notes || 'No notes provided.'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Scenario Runner
// ──────────────────────────────────────────────────────────────────────────

function ScenarioRunner({
  stationId,
  onStepComplete,
}: {
  stationId: string;
  onStepComplete: () => void;
}) {
  const [scenarios, setScenarios] = useState<ScenarioDef[]>([]);
  const [selected, setSelected] = useState<string>('suspected_blockage');
  const [steps, setSteps] = useState<ScenarioStep[]>([]);
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [log, setLog] = useState<{ label: string; status: string; score: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiFetch<ScenarioDef[]>('/monsoon/scenarios').then(setScenarios).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) return;
    apiFetch<any>(`/monsoon/scenarios/${selected}`).then(sc => {
      setSteps(sc.steps ?? []);
      setStepIndex(-1);
      setLog([]);
      setLastResult(null);
    }).catch(() => {});
  }, [selected]);

  const runStep = useCallback(async (idx: number, sc: string, sid: string) => {
    try {
      const result = await apiFetch<any>(`/monsoon/scenarios/${sc}/run-step?station_id=${sid}&step_index=${idx}`, { method: 'POST' });
      setLastResult(result);
      setStepIndex(idx);
      const step = result.reading?.step_label ?? '';
      setLog(l => [...l, {
        label: step || `Step ${idx + 1}`,
        status: result.anomaly?.risk_category ?? 'Unknown',
        score: result.anomaly?.risk_score ?? 0,
      }]);
      onStepComplete();
    } catch { /* ignore */ }
  }, [onStepComplete]);

  const start = useCallback(() => {
    if (!steps.length) return;
    setRunning(true);
    let i = 0;
    runStep(i, selected, stationId);
    intervalRef.current = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(intervalRef.current!);
        setRunning(false);
        return;
      }
      runStep(i, selected, stationId);
    }, 2200);
  }, [steps, selected, stationId, runStep]);

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setStepIndex(-1);
    setLog([]);
    setLastResult(null);
  }, [stop]);

  const nextStep = useCallback(() => {
    const next = stepIndex + 1;
    if (next < steps.length) runStep(next, selected, stationId);
  }, [stepIndex, steps.length, selected, stationId, runStep]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const sc = scenarios.find(s => s.key === selected);

  return (
    <div className="bg-[#050e1d] border border-amber-500/30 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-bold text-amber-300">SIMULATED SCENARIO</span>
        </div>
        <SimBadge />
      </div>

      <div className="p-4 space-y-3">
        {/* Scenario selector */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Select Scenario</label>
          <select
            value={selected}
            onChange={e => { reset(); setSelected(e.target.value); }}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
          >
            {scenarios.map(s => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
          {sc && <p className="text-[10px] text-slate-500 mt-1 leading-snug">{sc.description}</p>}
        </div>

        {/* Steps timeline */}
        {steps.length > 0 && (
          <div className="space-y-1">
            {steps.map((s, i) => {
              const done = i <= stepIndex;
              const current = i === stepIndex;
              return (
                <div key={i} className={cn(
                  'flex items-start gap-2 p-2 rounded-lg text-[11px] transition-all',
                  current ? 'bg-amber-500/20 border border-amber-400/40' :
                  done ? 'bg-slate-800/40' : 'opacity-40'
                )}>
                  <span className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5',
                    current ? 'bg-amber-400 text-slate-900' :
                    done ? 'bg-emerald-500/30 text-emerald-400' :
                    'bg-slate-700 text-slate-500'
                  )}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className={cn('font-medium', current ? 'text-amber-200' : done ? 'text-slate-300' : 'text-slate-500')}>{s.label}</p>
                    <div className="flex gap-2 text-[10px] text-slate-500 mt-0.5">
                      {s.water_depth_m !== null ? <span>Water: {s.water_depth_m}m</span> : <span>Water: offline</span>}
                      {s.flow_velocity_mps !== null ? <span>Flow: {s.flow_velocity_mps}m/s</span> : <span>Flow: offline</span>}
                      {s.rainfall_mm !== null ? <span>Rain: {s.rainfall_mm}mm</span> : <span>Rain: offline</span>}
                    </div>
                    {i === stepIndex && log[log.length - 1] && (
                      <span className={cn('inline-block mt-1 text-[10px] font-black px-1.5 py-0.5 rounded', riskBadge(log[log.length-1].status))}>
                        {log[log.length-1].status} — {log[log.length-1].score.toFixed(0)}/100
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 pt-2">
          {!running ? (
            <button onClick={start} className="flex-1 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center justify-center gap-2">
              <Play className="w-3.5 h-3.5" /> Auto-Run
            </button>
          ) : (
            <button onClick={stop} className="flex-1 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold flex items-center justify-center gap-2">
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          )}
          <button onClick={nextStep} disabled={running || stepIndex >= steps.length - 1} className="py-2 px-3 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/40 text-slate-300 text-xs font-bold disabled:opacity-40 flex items-center gap-1">
            <SkipForward className="w-3.5 h-3.5" /> Step
          </button>
          <button onClick={reset} className="py-2 px-3 rounded-xl bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/40 text-slate-300 text-xs font-bold flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Latest anomaly result */}
        {lastResult && (
          <div className={cn('rounded-xl p-3 border text-xs space-y-2', riskBg(lastResult.anomaly?.risk_category))}>
            <div className="flex items-center justify-between">
              <span className={cn('font-black text-sm', riskColor(lastResult.anomaly?.risk_category))}>
                {lastResult.anomaly?.risk_score?.toFixed(0)}/100 — {lastResult.anomaly?.risk_category}
              </span>
              {lastResult.incident_id && (
                <span className="text-[10px] font-mono text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded px-1.5 py-0.5">
                  INCIDENT CREATED
                </span>
              )}
            </div>
            <p className="text-slate-300 font-medium">{lastResult.anomaly?.status}</p>
            <p className="text-slate-400 leading-relaxed">{lastResult.anomaly?.recommended_action}</p>
            <div className="bg-slate-900/50 rounded-lg p-2 text-[10px]">
              <p className="text-indigo-300 font-semibold mb-0.5">Rainfall Context:</p>
              <p className="text-slate-400">{lastResult.anomaly?.rainfall_context}</p>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-2 text-[10px]">
              <p className="text-yellow-300 font-semibold mb-0.5">Confidence:</p>
              <p className="text-slate-400">{lastResult.anomaly?.confidence_note}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Manual Controls
// ──────────────────────────────────────────────────────────────────────────

function ManualControls({ stationId, station, onSubmit }: {
  stationId: string;
  station: MonsoonStation;
  onSubmit: () => void;
}) {
  const [waterDepth, setWaterDepth] = useState(station.baseline_depth_m.toString());
  const [flowVelocity, setFlowVelocity] = useState(station.baseline_depth_m > 0 ? '0.35' : '');
  const [rainfall, setRainfall] = useState('0');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${station.latitude}&longitude=${station.longitude}&current=precipitation`);
        const data = await res.json();
        if (data?.current?.precipitation !== undefined) {
          setRainfall(data.current.precipitation.toString());
        }
      } catch {}
    };
    fetchWeather();
  }, [stationId, station.latitude, station.longitude]);

  const submit = async () => {
    setBusy(true);
    try {
      const body: Record<string, any> = {
        water_depth_m: parseFloat(waterDepth) || null,
        rainfall_mm: parseFloat(rainfall) || 0,
        source_status: 'Simulated',
      };
      if (station.has_flow_sensor) body.flow_velocity_mps = parseFloat(flowVelocity) || null;
      const r = await apiFetch<any>(`/monsoon/stations/${stationId}/reading`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setResult(r);
      onSubmit();
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const slider = (label: string, val: string, set: (v: string) => void, min: number, max: number, step: number, unit: string, color: string) => (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
        <span className={cn('text-sm font-bold', color)}>{parseFloat(val).toFixed(2)} {unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={val}
        onChange={e => set(e.target.value)}
        className="w-full accent-cyan-500"
      />
      <div className="flex justify-between text-[9px] text-slate-600">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-[#050e1d] border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-xs font-bold text-slate-200">Manual Sensor Controls</span>
        <SimBadge />
      </div>
      <div className="p-4 space-y-4">
        {slider('Water Depth', waterDepth, setWaterDepth, 0, 3, 0.01, 'm', 'text-cyan-300')}
        {station.has_flow_sensor && slider('Flow Velocity', flowVelocity, setFlowVelocity, 0, 3, 0.01, 'm/s', 'text-blue-300')}
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              Rainfall Intensity
              <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1 py-0.5 rounded border border-indigo-500/30">Auto-Fetched Live</span>
            </label>
            <span className={cn('text-sm font-bold text-indigo-300')}>{parseFloat(rainfall || '0').toFixed(2)} mm/h</span>
          </div>
          <input
            type="range" min={0} max={80} step={0.5} value={isNaN(parseFloat(rainfall)) ? 0 : rainfall}
            onChange={e => setRainfall(e.target.value)}
            className="w-full accent-cyan-500"
          />
          <div className="flex justify-between text-[9px] text-slate-600">
            <span>0</span><span>80</span>
          </div>
        </div>

        <button
          disabled={busy}
          onClick={submit}
          className="w-full py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-colors disabled:opacity-50"
        >
          {busy ? 'Analysing…' : '→ Analyse Reading'}
        </button>

        {result && (
          <div className={cn('rounded-lg p-3 border text-xs', riskBg(result.anomaly?.risk_category))}>
            <span className={cn('font-black', riskColor(result.anomaly?.risk_category))}>
              {result.anomaly?.risk_score?.toFixed(0)}/100 — {result.anomaly?.status}
            </span>
            <p className="text-slate-400 mt-1 text-[10px]">{result.anomaly?.recommended_action}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────

export default function MonsoonMonitoringPage() {
  const { user } = useRbac();
  const [stations, setStations] = useState<MonsoonStation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<MonsoonStation | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [openIncident, setOpenIncident] = useState<Incident | null>(null);
  const [tab, setTab] = useState<'station' | 'incidents'>('station');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  const loadStations = useCallback(async () => {
    try {
      const data = await apiFetch<MonsoonStation[]>('/monsoon/stations');
      const filtered = user.zoneScope === 'All Mumbai Basins (City-wide Command)' 
        ? data 
        : data.filter(s => user.allowedBasins.includes(s.zone));
      setStations(filtered);
      if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].id);
    } catch { /* ignore */ }
  }, [selectedId, user.zoneScope, user.allowedBasins]);

  const loadIncidents = useCallback(async () => {
    try {
      const data = await apiFetch<Incident[]>('/monsoon/incidents');
      const filtered = user.zoneScope === 'All Mumbai Basins (City-wide Command)'
        ? data
        : data.filter(i => user.allowedBasins.includes(i.zone));
      setIncidents(filtered);
    } catch { /* ignore */ }
  }, [user.zoneScope, user.allowedBasins]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/monsoon/summary');
      setSummary(data);
    } catch { /* ignore */ }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStations(), loadIncidents(), loadSummary()]);
  }, [loadStations, loadIncidents, loadSummary]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshAll();
      setLoading(false);
    })();
  }, []);

  // Auto-refresh every 8 seconds
  useEffect(() => {
    const t = setInterval(refreshAll, 8000);
    return () => clearInterval(t);
  }, [refreshAll]);

  // Update selected station detail on data reload
  useEffect(() => {
    if (selectedId) {
      const s = stations.find(s => s.id === selectedId);
      setSelectedStation(s ?? null);
    }
  }, [selectedId, stations]);

  const openInc = incidents.filter(i => i.status !== 'Resolved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-cyan-400 animate-pulse mx-auto" />
          <p className="text-slate-400 text-sm">Loading monsoon monitoring…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full space-y-4">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CloudRain className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-black text-white">Monsoon Blockage Detection</h1>
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">BETA</span>
          </div>
          <p className="text-sm text-slate-400 max-w-2xl">
            Identifies suspicious drainage behaviour when plastic may be hidden underwater.
            <span className="text-amber-300 font-semibold"> Anomalies are suspected drainage issues — not confirmed blockages — until field-verified.</span>
          </p>
        </div>
        {openInc > 0 && (
          <button
            onClick={() => setTab('incidents')}
            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            {openInc} Open Incident{openInc !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Summary Bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Stations', value: summary.total_stations, color: 'text-slate-300', icon: Radio },
            { label: 'Online', value: summary.stations_online, color: 'text-emerald-400', icon: Wifi },
            { label: 'Offline', value: summary.stations_offline, color: 'text-slate-500', icon: WifiOff },
            { label: 'Critical/High', value: summary.stations_critical_or_high, color: 'text-red-400', icon: AlertTriangle },
            { label: 'Open Incidents', value: summary.open_incidents, color: 'text-orange-400', icon: AlertCircle },
            { label: 'Confirmed Blockages', value: summary.confirmed_blockages_today, color: 'text-rose-400', icon: XCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="bg-[#050e1d] border border-slate-700/50 rounded-xl p-3 text-center">
              <Icon className={cn('w-4 h-4 mx-auto mb-1', color)} />
              <p className={cn('text-xl font-black', color)}>{value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Station List */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Monitoring Stations</p>
          {stations.map(s => (
            <StationCard
              key={s.id}
              station={s}
              selected={selectedId === s.id}
              onClick={() => { setSelectedId(s.id); setTab('station'); }}
            />
          ))}

          {/* Incident list preview */}
          {incidents.filter(i => i.status !== 'Resolved').length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Open Incidents</p>
              {incidents.filter(i => i.status !== 'Resolved').map(inc => (
                <button
                  key={inc.id}
                  onClick={() => { setOpenIncident(inc); setTab('incidents'); }}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border transition-all',
                    riskBg(inc.risk_category),
                    openIncident?.id === inc.id ? 'border-orange-400' : ''
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-slate-400">{inc.id}</span>
                    <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded border uppercase', riskBadge(inc.risk_category))}>
                      {inc.risk_category}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-200 truncate">{inc.station_name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{inc.blockage_status}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Detail Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-[#040a14] rounded-xl p-1 border border-slate-700/50">
            <button
              onClick={() => setTab('station')}
              className={cn(
                'flex-1 py-2 text-xs font-bold rounded-lg transition-colors',
                tab === 'station' ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Station Dashboard
            </button>
            <button
              onClick={() => setTab('incidents')}
              className={cn(
                'flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5',
                tab === 'incidents' ? 'bg-orange-950/80 text-orange-300 border border-orange-500/40' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              Incidents
              {openInc > 0 && <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{openInc}</span>}
            </button>
          </div>

          {/* Station tab */}
          {tab === 'station' && selectedStation && (
            <div className="space-y-4">
              {/* Station header */}
              <div className={cn('rounded-xl border p-4', riskBg(selectedStation.current_risk_category))}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('w-2.5 h-2.5 rounded-full', !selectedStation.is_stale ? 'bg-emerald-400 animate-pulse' : 'bg-red-500')} />
                      <span className="text-[10px] font-mono text-slate-400">{selectedStation.id}</span>
                      {selectedStation.sensor_mode === 'Simulated' && <SimBadge />}
                    </div>
                    <h2 className="text-lg font-black text-white">{selectedStation.name}</h2>
                    <p className="text-xs text-slate-400">{selectedStation.zone}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span>{selectedStation.latitude.toFixed(4)}°N, {selectedStation.longitude.toFixed(4)}°E</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-3xl font-black', riskColor(selectedStation.current_risk_category))}>
                      {selectedStation.current_risk_score.toFixed(0)}
                    </div>
                    <div className="text-[10px] text-slate-500">Priority Score</div>
                    <div className={cn('text-xs font-black mt-1', riskColor(selectedStation.current_risk_category))}>
                      {selectedStation.current_risk_category}
                    </div>
                  </div>
                </div>

                {/* Sensor readings */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: 'Water Depth', icon: Droplets, color: 'text-cyan-300',
                      value: selectedStation.current_water_depth_m !== null ? `${selectedStation.current_water_depth_m?.toFixed(2)}m` : '—',
                      sub: `Capacity: ${selectedStation.culvert_capacity_m}m`,
                      bar: selectedStation.current_water_depth_m !== null,
                      barVal: selectedStation.current_water_depth_m ?? 0,
                      barMax: selectedStation.culvert_capacity_m,
                      barColor: 'bg-cyan-500',
                    },
                    {
                      label: 'Flow Velocity', icon: Wind, color: 'text-blue-300',
                      value: !selectedStation.has_flow_sensor ? 'No Sensor' :
                             selectedStation.current_flow_velocity_mps !== null ? `${selectedStation.current_flow_velocity_mps?.toFixed(2)} m/s` : 'Offline',
                      sub: `Baseline: ${selectedStation.baseline_depth_m > 0 ? '0.35 m/s' : 'N/A'}`,
                      bar: selectedStation.has_flow_sensor && selectedStation.current_flow_velocity_mps !== null,
                      barVal: selectedStation.current_flow_velocity_mps ?? 0,
                      barMax: 2,
                      barColor: 'bg-blue-500',
                    },
                    {
                      label: 'Rainfall', icon: CloudRain, color: 'text-indigo-300',
                      value: !selectedStation.has_rainfall_gauge ? 'No Gauge' :
                             selectedStation.current_rainfall_mm !== null ? `${selectedStation.current_rainfall_mm?.toFixed(1)} mm/h` : 'Offline',
                      sub: 'Local gauge',
                      bar: selectedStation.has_rainfall_gauge && selectedStation.current_rainfall_mm !== null,
                      barVal: selectedStation.current_rainfall_mm ?? 0,
                      barMax: 80,
                      barColor: 'bg-indigo-500',
                    },
                  ].map(({ label, icon: Icon, color, value, sub, bar, barVal, barMax, barColor }) => (
                    <div key={label} className="bg-slate-900/60 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={cn('w-3.5 h-3.5', color)} />
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
                      </div>
                      <p className={cn('text-lg font-black', color)}>{value}</p>
                      <p className="text-[10px] text-slate-500 mb-1.5">{sub}</p>
                      {bar && <GaugeBar value={barVal} max={barMax} color={barColor} />}
                    </div>
                  ))}
                </div>

                {/* Status */}
                {selectedStation.current_status !== 'Normal' && (
                  <div className="mt-3 flex items-start gap-2 bg-slate-900/60 rounded-lg p-3">
                    <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', riskColor(selectedStation.current_risk_category))} />
                    <div>
                      <p className={cn('text-sm font-bold', riskColor(selectedStation.current_risk_category))}>{selectedStation.current_status}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Last reading: {selectedStation.last_reading_at ? new Date(selectedStation.last_reading_at).toLocaleTimeString('en-IN') : 'Never'}
                        {selectedStation.is_stale && <span className="ml-2 text-red-400 font-bold">⚠ STALE</span>}
                      </p>
                    </div>
                  </div>
                )}

                {/* Station metadata */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-slate-900/40 rounded-lg p-2">
                    <span className="text-slate-500">Known plastic nearby:</span>
                    <span className="ml-1.5 text-orange-300 font-bold">{selectedStation.known_plastic_nearby_kg} kg</span>
                    <p className="text-[9px] text-slate-600 mt-0.5">From prior drone/field surveys — may be a contributing factor</p>
                  </div>
                  <div className="bg-slate-900/40 rounded-lg p-2">
                    <span className="text-slate-500">Downstream vulnerability:</span>
                    <span className={cn('ml-1.5 font-bold', selectedStation.downstream_vulnerability === 'Very High' || selectedStation.downstream_vulnerability === 'High' ? 'text-red-300' : 'text-yellow-300')}>
                      {selectedStation.downstream_vulnerability}
                    </span>
                    <p className="text-[9px] text-slate-600 mt-0.5">Prior anomaly count: {selectedStation.prior_anomaly_count}</p>
                  </div>
                </div>
              </div>

              {/* Scenario Runner */}
              <ScenarioRunner stationId={selectedStation.id} onStepComplete={refreshAll} />

              {/* Manual Controls */}
              <ManualControls stationId={selectedStation.id} station={selectedStation} onSubmit={refreshAll} />

              {/* Hardware integration note */}
              <div className="bg-[#050e1d] border border-slate-700/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-300">Hardware Integration (ESP32)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  When physical sensors are ready, configure your ESP32 to POST to:
                </p>
                <code className="block bg-slate-900 rounded-lg p-2 text-[10px] font-mono text-green-300 break-all">
                  POST http://&lt;server-ip&gt;:8000/api/monsoon/hardware/ingest
                </code>
                <p className="text-[10px] text-slate-500">
                  Include device_id, water_level_cm, and optionally flow_velocity_mps, rainfall_mm, battery_pct.
                  Store WIFI credentials and API keys in firmware only — never in frontend code.
                  Stale devices (no reading for &gt;15 min) are shown as Offline automatically.
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 border border-slate-700/40 rounded-lg p-2 bg-slate-900/40">
                  <Wifi className="w-3 h-3 text-slate-500" />
                  <span>Mode: <span className="text-amber-300 font-bold">{selectedStation.sensor_mode}</span></span>
                  <span className="mx-2 text-slate-700">|</span>
                  <span>Device ID: <span className="font-mono text-slate-300">{selectedStation.device_id}</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Incidents tab */}
          {tab === 'incidents' && (
            <div className="space-y-4">
              {incidents.length === 0 ? (
                <div className="text-center py-16 bg-[#050e1d] rounded-xl border border-slate-700/50">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                  <p className="text-slate-300 font-bold">No Incidents</p>
                  <p className="text-sm text-slate-500 mt-1">Run a scenario to generate an alert</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {incidents.map(inc => (
                    <div key={inc.id}>
                      {(openIncident?.id === inc.id) ? (
                        <div>
                          <button
                            onClick={() => setOpenIncident(null)}
                            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 mb-2 transition-colors"
                          >
                            <ChevronUp className="w-3.5 h-3.5" /> Collapse
                          </button>
                          <IncidentPanel
                            incident={inc}
                            onRefresh={async () => {
                              await loadIncidents();
                              const updated = incidents.find(i => i.id === inc.id);
                              if (updated) setOpenIncident(updated);
                            }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setOpenIncident(inc)}
                          className={cn(
                            'w-full text-left p-4 rounded-xl border transition-all hover:border-cyan-500/40',
                            riskBg(inc.risk_category)
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-mono text-slate-400">{inc.id}</span>
                                {inc.is_simulated && <SimBadge />}
                              </div>
                              <p className="text-sm font-bold text-slate-100">{inc.station_name}</p>
                              <p className="text-xs text-slate-400">{inc.blockage_status}</p>
                              <p className="text-[10px] text-slate-500 mt-1">{new Date(inc.created_at).toLocaleString('en-IN')}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={cn('text-[10px] font-black px-2 py-1 rounded border mb-2 block', riskBadge(inc.risk_category))}>
                                {inc.risk_category}
                              </span>
                              <span className={cn('text-[10px] font-black px-2 py-1 rounded border block',
                                inc.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                inc.status === 'Open' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                                'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                              )}>
                                {inc.status}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                            <ChevronDown className="w-3 h-3" /> Click to expand
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'station' && !selectedStation && (
            <div className="text-center py-16 bg-[#050e1d] rounded-xl border border-slate-700/50">
              <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select a monitoring station</p>
            </div>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-[#040a14] border border-slate-700/30 rounded-xl p-4 text-[11px] text-slate-500 leading-relaxed">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-300">Important: </span>
            Monsoon monitoring identifies <em>suspicious drainage anomalies</em>, not confirmed plastic blockages.
            High water levels during heavy rainfall are expected and do not indicate a blockage.
            A drain anomaly does not automatically mean plastic is present.
            All incidents are labelled as suspected until field-verified by an authorised inspector.
            Do not dispatch personnel based solely on unverified sensor data.
          </div>
        </div>
      </div>
    </div>
  );
}

// Cpu icon needed
function Cpu(props: { className?: string }) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="6" height="6"/><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
      <line x1="9" y1="2" x2="9" y2="0"/><line x1="15" y1="2" x2="15" y2="0"/>
      <line x1="9" y1="24" x2="9" y2="22"/><line x1="15" y1="24" x2="15" y2="22"/>
      <line x1="2" y1="9" x2="0" y2="9"/><line x1="2" y1="15" x2="0" y2="15"/>
      <line x1="24" y1="9" x2="22" y2="9"/><line x1="24" y1="15" x2="22" y2="15"/>
    </svg>
  );
}

