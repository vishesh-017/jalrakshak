import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getBasinComparison, getPlasticComposition, getDataIntegrity, getDashboardMetrics } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import {
  BarChart3,
  PieChart as PieIcon,
  ShieldCheck,
  Calculator,
  Waves,
  Droplets,
  Layers,
  Sparkles
} from 'lucide-react';

export default function AnalyticsPage() {
  const [basins, setBasins] = useState<unknown[]>([]);
  const [composition, setComposition] = useState<unknown[]>([]);
  const [integrity, setIntegrity] = useState<unknown[]>([]);
  const [metrics, setMetrics] = useState<{ total_monitored_sites: number; total_plastic_recovered_kg: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interception, setInterception] = useState(5);

  async function load() {
    setLoading(true);
    try {
      const [b, c, i, m] = await Promise.all([getBasinComparison(), getPlasticComposition(), getDataIntegrity(), getDashboardMetrics()]);
      setBasins(b);
      setComposition(c);
      setIntegrity(i);
      setMetrics({ total_monitored_sites: m.total_monitored_sites, total_plastic_recovered_kg: m.total_plastic_recovered_kg });
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner text="Loading analytics..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  const annualTonnes = 5000;
  const interceptedTonnes = (annualTonnes * interception) / 100;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-cyan-900/30">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              Waterway Analytics & Environmental Impact
            </h1>
            <Badge className="bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 text-[10px] font-bold">INTELLIGENCE</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-basin hydrodynamic risk comparisons, polymer waste classification, and scenario impact projection
          </p>
        </div>

        <span className="px-2.5 py-1 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 text-[11px] font-semibold flex items-center gap-1.5 self-start md:self-auto shadow-sm">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Monitored Basins & Scenario Projections
        </span>
      </div>

      {/* Basin Comparison & Composition Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <Waves className="w-4 h-4 text-cyan-400" />
                Basin-Level Risk & Recovery Comparison
              </CardTitle>
              <Badge className="bg-cyan-950/60 text-cyan-300 border border-cyan-800 text-[10px] font-bold">3 BASINS</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={basins as Record<string, unknown>[]} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="zone" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: string) => v.split(' ')[0]} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#0e7490', backgroundColor: '#030914', color: '#f8fafc' }}
                  formatter={(val: any, name: any) => [name === 'Avg Risk Score' ? `${val}/100` : `${val} kg`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4, color: '#94a3b8' }} />
                <Bar dataKey="average_risk_score" name="Avg Risk Score" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total_recovered_kg" name="Recovered (kg)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Plastic Composition */}
        <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-teal-400" />
                Recovered Plastic Polymer Breakdown
              </CardTitle>
              <Badge className="bg-teal-950/60 text-teal-300 border border-teal-800 text-[10px] font-bold">CPCB CLASSES</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
            <PieChart width={160} height={160}>
              <Pie data={composition as Record<string, unknown>[]} dataKey="weight_kg" cx={75} cy={75} outerRadius={72} innerRadius={38}>
                {(composition as { color: string }[]).map((item, i) => (
                  <Cell key={i} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
            <div className="space-y-2.5 w-full sm:w-auto">
              {(composition as { category: string; weight_kg: number; percentage: number; color: string }[]).map(item => (
                <div key={item.category} className="flex items-center gap-2.5 text-xs">
                  <div className="w-3.5 h-3.5 rounded-md shrink-0 shadow-xs" style={{ background: item.color }} />
                  <span className="text-slate-300 font-medium">{item.category}</span>
                  <span className="font-mono font-bold text-cyan-300 ml-auto">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Integrity */}
      <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Data Provenance & Partition Integrity
            </CardTitle>
            <span className="text-[11px] text-slate-400">Simulated records are strictly separated</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(integrity as { source: string; count: number; percentage: number; badge_color: string }[]).map(item => (
              <div key={item.source} className="bg-[#030914] rounded-xl p-3.5 border border-cyan-900/30">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">{item.source}</p>
                <p className="text-2xl font-black text-white font-mono mt-1">{item.count}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.percentage}% of database records</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Impact Calculator */}
      <Card className="ocean-card border border-cyan-800/40 bg-gradient-to-br from-[#051329] via-[#030914] to-[#04101e]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              Illustrative Interception Impact Simulator
            </CardTitle>
            <Badge className="bg-amber-950/80 text-amber-300 border border-amber-700/60 text-[10px] font-bold">
              SCENARIO PROJECTION
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-[#020617]/80 backdrop-blur border border-cyan-900/40 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed">
            Mumbai generates an estimated <strong className="text-white">5,000 tonnes/year</strong> of plastic leakage into coastal water bodies (per InnovateX challenge brief). This figure is illustrative. JalRakshak has not measured or verified this estimate.
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-200">
                Assumed Interception Rate: <span className="text-cyan-400 font-mono text-sm font-black">{interception}%</span>
              </label>
              <span className="text-[11px] text-slate-400 italic">(scenario slider — not a field measurement)</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={interception}
              onChange={e => setInterception(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="bg-[#030914] border border-cyan-900/40 rounded-xl p-4 text-center shadow-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Annual Scenario Estimate</p>
              <p className="text-3xl font-black text-cyan-400 font-heading font-mono mt-1">{interceptedTonnes.toFixed(0)} t</p>
              <p className="text-[10px] text-slate-400 mt-1">Illustrative — not validated</p>
            </div>
            <div className="bg-[#030914] border border-cyan-900/40 rounded-xl p-4 text-center shadow-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monitoring Sites Required</p>
              <p className="text-3xl font-black text-teal-400 font-heading font-mono mt-1">{metrics?.total_monitored_sites ?? '10'}</p>
              <p className="text-[10px] text-slate-400 mt-1">Current pilot phase</p>
            </div>
            <div className="bg-[#030914] border border-cyan-900/40 rounded-xl p-4 text-center shadow-xs">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Illustrative Demo Ledger Recovery</p>
              <p className="text-3xl font-black text-emerald-400 font-heading font-mono mt-1">{((metrics?.total_plastic_recovered_kg ?? 0) / 1000).toFixed(1)} t</p>
              <p className="text-[10px] text-slate-400 mt-1">Recorded in demo database</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 italic">
            *This calculator applies the InnovateX challenge scenario figure to a user-adjustable interception percentage. It is a planning illustration, not a measurement. Real impact depends on outlet coverage, rainfall capture timing, and verified field collections.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
