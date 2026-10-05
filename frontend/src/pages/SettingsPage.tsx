import { useState } from 'react';
import { triggerStorm, clearSimulated, resetDatabase } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Sliders, CloudRain, Database, ShieldAlert,
  Info, Trash2, RotateCcw, CheckCircle2, Waves
} from 'lucide-react';

const INTENSITIES = [
  'Moderate Rain (35mm)',
  'Heavy Downpour (75mm)',
  'Severe Cloudburst (110mm)',
];

export default function SettingsPage() {
  const [intensity, setIntensity] = useState('Severe Cloudburst (110mm)');
  const [tide, setTide] = useState(4.45);
  const [simLoading, setSimLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [simResult, setSimResult] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  async function handleStorm() {
    setSimLoading(true); setMessage('');
    try {
      const r = await triggerStorm(intensity, tide);
      setSimResult(r);
      setMessage('Storm simulation completed. Refresh other pages to see updated risk scores.');
    } catch (e: unknown) { setMessage(`Error: ${(e as Error).message}`); }
    finally { setSimLoading(false); }
  }

  async function handleClear() {
    if (!confirm('Clear all SIMULATED records? Real, Imported, and Manually entered records will be preserved.')) return;
    setClearLoading(true); setMessage('');
    try {
      const r = await clearSimulated();
      setMessage(`Cleared simulated records: ${JSON.stringify((r as Record<string, unknown>).deleted_counts)}`);
    } catch (e: unknown) { setMessage(`Error: ${(e as Error).message}`); }
    finally { setClearLoading(false); }
  }

  async function handleReset() {
    if (!confirm('Reset entire database to seed state? All user-entered records will be lost.')) return;
    setResetLoading(true); setMessage('');
    try {
      await resetDatabase();
      setMessage('Database reset to seed state. Refresh the page.');
    } catch (e: unknown) { setMessage(`Error: ${(e as Error).message}`); }
    finally { setResetLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-cyan-900/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Platform Configuration</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">Settings & Simulation Controls</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monsoon hydrological stress testing, database seed controls, and open-source provenance
          </p>
        </div>
      </div>

      {/* System Info */}
      <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
        <CardHeader className="border-b border-cyan-900/30 pb-3">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            System Runtime & Telemetry Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs pt-4">
          <div className="flex justify-between py-1.5 border-b border-cyan-950/40">
            <span className="text-slate-400">Project Engine</span>
            <span className="font-semibold text-white">JalRakshak v1.0 — Ocean Intelligence Architecture</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-cyan-950/40">
            <span className="text-slate-400">Hackathon Track</span>
            <span className="font-semibold text-cyan-300">Techfest IIT Bombay InnovateX — Theme 3: Coastal Mumbai</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-cyan-950/40">
            <span className="text-slate-400">Backend API Gateway</span>
            <span className="font-mono text-cyan-300">Python FastAPI + SQLite (Port 8000)</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-cyan-950/40">
            <span className="text-slate-400">Perception Pipelines</span>
            <span className="font-semibold text-white flex items-center gap-1.5">
              YOLOv8 + OpenCV Creek Analysis
              <Badge className="bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 text-[10px]">Active</Badge>
            </span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-cyan-950/40">
            <span className="text-slate-400">Risk Forecaster</span>
            <span className="font-semibold text-white">XGBoost Classifier + Physical Heuristic Sum</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-400">Data Integrity Protocol</span>
            <span className="font-medium text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700/50">
              Strict Non-Negotiable Honesty Rules Enforced
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Storm Simulator */}
      <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
        <CardHeader className="border-b border-cyan-900/30 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <CloudRain className="w-4 h-4 text-cyan-400" />
                Monsoon Storm Surge Simulator
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Injects SIMULATED rainfall observations and recalculates risk for all 10 monitored outfalls
              </p>
            </div>
            <Badge className="bg-teal-950/80 text-teal-300 border border-teal-700/50 text-[10px] self-start sm:self-auto">
              OUTPUTS LABELED SIMULATED
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Rainfall Intensity Scenario</label>
            <select
              value={intensity}
              onChange={e => setIntensity(e.target.value)}
              className="w-full text-xs border border-cyan-800/60 rounded-xl px-3 py-2.5 bg-[#030914] text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {INTENSITIES.map(i => <option key={i} className="bg-[#030914] text-white">{i}</option>)}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">Tide Surge Level</label>
              <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700/50">
                {tide.toFixed(2)} meters
              </span>
            </div>
            <input
              type="range"
              min={1.0}
              max={5.5}
              step={0.05}
              value={tide}
              onChange={e => setTide(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1.5">
              Mumbai astronomical high-tide threshold is ~4.2m. Levels above this simulate tidal seawater backflow choking drain outlets.
            </p>
          </div>
          <Button variant="danger" onClick={handleStorm} loading={simLoading} className="bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center gap-2 shadow-sm">
            <CloudRain className="w-4 h-4" />
            Trigger Storm Simulation
          </Button>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
        <CardHeader className="border-b border-cyan-900/30 pb-3">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Database & State Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#030914] rounded-xl border border-cyan-900/40">
            <div>
              <p className="text-xs font-bold text-slate-200">Clear Simulated Records</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Removes only SIMULATED observations. Preserves Real, Imported, and Manually entered data.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleClear} loading={clearLoading} className="border-cyan-800 text-cyan-300 hover:bg-cyan-950/50 self-start sm:self-auto text-xs">
              Clear Simulated
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-rose-950/20 rounded-xl border border-rose-900/40">
            <div>
              <p className="text-xs font-bold text-rose-300">Reset Demo Database to Seed</p>
              <p className="text-[11px] text-rose-400/80 mt-0.5">
                Drops all transient records and re-seeds with the initial 10-outfall Mumbai dataset.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={handleReset} loading={resetLoading} className="bg-rose-600 hover:bg-rose-700 text-white self-start sm:self-auto text-xs">
              Reset Database
            </Button>
          </div>
        </CardContent>
      </Card>

      {message && (
        <div className="bg-cyan-950/80 border border-cyan-500/50 rounded-xl px-4 py-3 text-xs text-cyan-200 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Credits */}
      <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
        <CardHeader className="border-b border-cyan-900/30 pb-3">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Waves className="w-4 h-4 text-cyan-400" />
            Open-Source Credits & Attribution Registry
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-300 space-y-2 pt-4">
          <p><strong className="text-white">AniLeo-01/Plastic-In-River-Detection</strong> — YOLOv8m training pipeline on Kili plastic_in_river dataset. Classes: PLASTIC_BAG, PLASTIC_BOTTLE, OTHER_PLASTIC_WASTE, NOT_PLASTIC_WASTE. (AGPL-3.0).</p>
          <p><strong className="text-white">SwastikGorai/ReWater</strong> — Single-class YOLOv8m weights from aerial drone imagery over river waterways. <span className="text-emerald-400 font-semibold">MIT Licence.</span></p>
          <p><strong className="text-white">Kili plastic_in_river Dataset</strong> — Hugging Face open dataset repository for plastic pollution research.</p>
          <p><strong className="text-white">Ultralytics YOLOv8</strong> — Modern computer vision perception engine. <span className="text-amber-400 font-semibold">AGPL-3.0 Licence.</span></p>
          <p><strong className="text-white">OpenStreetMap & Leaflet</strong> — © OpenStreetMap contributors. Cartographic base tiles under ODbL licence.</p>
          <p><strong className="text-white">Google OR-Tools</strong> — Combinatorial optimization suite for vehicle routing and TSP dispatch (Apache 2.0).</p>
        </CardContent>
      </Card>
    </div>
  );
}

