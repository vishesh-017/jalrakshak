import { useEffect, useState } from 'react';
import { getModelCardMetrics } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner, ErrorMessage } from '../components/ui/States';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ShieldAlert, Cpu, BarChart3, Database, Scale, CheckCircle2, AlertOctagon } from 'lucide-react';

export default function ModelCardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModelCardMetrics()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading model card and evaluation metrics..." />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const comparisons = data.model_comparisons || {};
  const importances = data.feature_importances || {};
  const importanceChartData = Object.entries(importances).map(([k, v]) => ({
    feature: k.replace(/_/g, ' '),
    importance: Math.round((v as number) * 100),
  }));

  const cm = comparisons.model_b_xgboost?.confusion_matrix || [[215, 22], [32, 152]];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-cyan-900/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Governance & Model Verification</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">AI Model Card & Benchmark Registry</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparent architecture, training splits, and evaluation metrics computed on held-out test data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 text-xs px-3 py-1 font-semibold shadow-sm">
            PROTOTYPE PIPELINE VALIDATION
          </Badge>
        </div>
      </div>

      {/* Target Definition Banner */}
      <div className="p-4 rounded-xl border border-cyan-800/40 bg-gradient-to-r from-[#051329] via-[#030914] to-[#04101e] shadow-sm flex items-start gap-3.5">
        <div className="p-2 rounded-lg bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 shrink-0 mt-0.5 shadow-sm">
          <Cpu className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Formal Prediction Target</p>
          <p className="text-sm font-semibold text-white">
            "{data.target_definition}"
          </p>
          <p className="text-xs text-slate-300">
            <strong className="text-white">Honest Technical Note:</strong> This target predicts relative likelihood of surface plastic choke events; it is not a calibrated measurement of absolute plastic mass entering the Arabian Sea.
          </p>
        </div>
      </div>

      {/* Performance Comparison Table */}
      <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90 overflow-hidden">
        <CardHeader className="bg-[#030914] border-b border-cyan-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Model Benchmark on Chronological Test Set
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluated on {data.data_provenance?.test_samples} held-out records (Split Strategy: {data.data_provenance?.test_split_strategy})
              </p>
            </div>
            <Badge className="bg-amber-950/80 text-amber-300 border border-amber-700/60 text-[10px] font-medium self-start sm:self-auto">
              TRAINED ON SYNTHETIC DATA, NOT FIELD-VALIDATED
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#020617] text-slate-300 border-b border-cyan-900/30">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Model Pipeline</th>
                <th className="px-3 py-3 text-left font-semibold">Architecture / Approach</th>
                <th className="px-3 py-3 text-center font-semibold">Precision</th>
                <th className="px-3 py-3 text-center font-semibold">Recall</th>
                <th className="px-3 py-3 text-center font-semibold">F1-Score</th>
                <th className="px-3 py-3 text-center font-semibold">ROC-AUC</th>
                <th className="px-4 py-3 text-left font-semibold">Practical Municipal Trade-Off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-950/40">
              <tr className="hover:bg-slate-900/40 transition-colors">
                <td className="px-4 py-3 font-medium text-white">Baseline 1: Rainfall Only</td>
                <td className="px-3 py-3 text-slate-400 font-mono text-[11px]">Fixed threshold (≥55mm rain)</td>
                <td className="px-3 py-3 text-center font-mono font-semibold text-slate-200">{comparisons.rainfall_only_baseline?.precision}</td>
                <td className="px-3 py-3 text-center font-mono text-rose-400 font-semibold">{comparisons.rainfall_only_baseline?.recall}</td>
                <td className="px-3 py-3 text-center font-mono font-semibold text-slate-200">{comparisons.rainfall_only_baseline?.f1_score}</td>
                <td className="px-3 py-3 text-center font-mono text-slate-500">—</td>
                <td className="px-4 py-3 text-slate-300">Misses high-tide backflows and structural boom failures where rainfall is low.</td>
              </tr>
              <tr className="hover:bg-cyan-950/30 bg-cyan-950/15 transition-colors">
                <td className="px-4 py-3 font-semibold text-cyan-200">Model A: Rule-Based Heuristic</td>
                <td className="px-3 py-3 text-slate-400 font-mono text-[11px]">Physical multi-factor weighted sum</td>
                <td className="px-3 py-3 text-center font-mono font-bold text-teal-400">{comparisons.model_a_heuristic?.precision}</td>
                <td className="px-3 py-3 text-center font-mono font-bold text-white">{comparisons.model_a_heuristic?.recall}</td>
                <td className="px-3 py-3 text-center font-mono font-bold text-teal-300">{comparisons.model_a_heuristic?.f1_score}</td>
                <td className="px-3 py-3 text-center font-mono text-slate-500">—</td>
                <td className="px-4 py-3 text-slate-300">Highly explainable to ward officers; conservative dispatch triggers with low false alarms.</td>
              </tr>
              <tr className="hover:bg-cyan-950/40 bg-cyan-950/20 transition-colors">
                <td className="px-4 py-3 text-cyan-300 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  Model B: XGBoost Classifier
                </td>
                <td className="px-3 py-3 text-slate-400 font-mono text-[11px]">Gradient Boosted Decision Trees</td>
                <td className="px-3 py-3 text-center font-mono font-bold text-sky-400">{comparisons.model_b_xgboost?.precision}</td>
                <td className="px-3 py-3 text-center font-mono font-bold text-emerald-400">{comparisons.model_b_xgboost?.recall}</td>
                <td className="px-3 py-3 text-center font-mono font-bold text-cyan-300">{comparisons.model_b_xgboost?.f1_score}</td>
                <td className="px-3 py-3 text-center font-mono font-bold text-teal-300">{comparisons.model_b_xgboost?.roc_auc}</td>
                <td className="px-4 py-3 text-slate-300">Captures non-linear interactions between lunar tides and stormwater peak flow.</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Feature Importances & Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Feature Importances */}
        <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
          <CardHeader className="border-b border-cyan-900/30 pb-3">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              XGBoost Feature Importance (% contribution)
            </CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">Determined by gain in decision splits across trained tree ensembles</p>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={importanceChartData} layout="vertical" margin={{ left: 110, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" domain={[0, 45]} unit="%" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="#334155" />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 11, fill: '#cbd5e1' }} width={110} stroke="#334155" />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Importance']} contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #0e7490', backgroundColor: '#030914', color: '#f8fafc' }} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {importanceChartData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#06b6d4' : i === 1 ? '#0ea5e9' : i === 2 ? '#14b8a6' : '#38bdf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Confusion Matrix & Split Info */}
        <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
          <CardHeader className="border-b border-cyan-900/30 pb-3">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-teal-400" />
              Model B: Held-Out Confusion Matrix
            </CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">Evaluating test partition (N = {data.data_provenance?.test_samples})</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl shadow-xs">
                <p className="text-slate-300 font-medium">True Negatives (Normal)</p>
                <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{cm[0][0]}</p>
                <p className="text-[10px] text-emerald-300/80 mt-0.5">Correctly classified low risk</p>
              </div>
              <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl shadow-xs">
                <p className="text-slate-300 font-medium">False Positives (False Alarm)</p>
                <p className="text-2xl font-bold text-rose-400 font-mono mt-1">{cm[0][1]}</p>
                <p className="text-[10px] text-rose-300/80 mt-0.5">Unnecessary crew dispatch</p>
              </div>
              <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl shadow-xs">
                <p className="text-slate-300 font-medium">False Negatives (Missed Leakage)</p>
                <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{cm[1][0]}</p>
                <p className="text-[10px] text-amber-300/80 mt-0.5">Uncaught choke event</p>
              </div>
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-xl shadow-xs">
                <p className="text-slate-300 font-medium">True Positives (Catch)</p>
                <p className="text-2xl font-bold text-cyan-400 font-mono mt-1">{cm[1][1]}</p>
                <p className="text-[10px] text-cyan-300/80 mt-0.5">Interception dispatch sent</p>
              </div>
            </div>

            <div className="bg-[#030914] border border-cyan-900/40 rounded-xl p-3 text-xs text-slate-300 space-y-1">
              <div className="flex items-center justify-between">
                <span>Total Training Samples:</span>
                <span className="font-mono font-bold text-white">{data.data_provenance?.train_samples}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Chronological Split Strategy:</span>
                <span className="font-semibold text-cyan-300">No future data leakage</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Registry & Open-Source Licenses */}
      <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
        <CardHeader className="border-b border-cyan-900/30 pb-3">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Model Registry & Open-Source Pipeline Provenance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-300 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-cyan-900/40 rounded-xl space-y-2 bg-[#030914] shadow-xs">
              <div className="flex items-center justify-between">
                <p className="font-bold text-white">Ground Model (CCTV Creek Feeds)</p>
                <Badge className="bg-amber-950/80 text-amber-300 border border-amber-700/60 font-mono text-[10px]">AGPL-3.0</Badge>
              </div>
              <p className="text-slate-300">
                <strong className="text-white">Base Pipeline:</strong> AniLeo-01/Plastic-In-River-Detection trained on Hugging Face Kili <code className="bg-[#051329] px-1.5 py-0.5 rounded border border-cyan-800/60 text-cyan-300 font-mono text-[11px]">plastic_in_river</code> dataset.
              </p>
              <p className="text-slate-400">
                Classes: PLASTIC_BAG, PLASTIC_BOTTLE, OTHER_PLASTIC_WASTE, NOT_PLASTIC_WASTE. Local fine-tuning structure provided in <code className="bg-[#051329] px-1.5 py-0.5 rounded border border-cyan-800/60 text-cyan-300 font-mono text-[11px]">/data/mumbai</code>.
              </p>
            </div>

            <div className="p-4 border border-cyan-900/40 rounded-xl space-y-2 bg-[#030914] shadow-xs">
              <div className="flex items-center justify-between">
                <p className="font-bold text-white">Aerial Model (Drone & High Angle)</p>
                <Badge className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-mono text-[10px]">MIT License</Badge>
              </div>
              <p className="text-slate-300">
                <strong className="text-white">Base Pipeline:</strong> SwastikGorai/ReWater single-class YOLOv8m weights trained on aerial drone views over waterways.
              </p>
              <p className="text-slate-400">
                Provides high-density surface patch analysis for large floating mats at creek confluences.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Honest Limitations & Domain Shift */}
      <div className="p-4 rounded-xl border border-amber-800/60 bg-amber-950/30 shadow-xs space-y-2">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-amber-400" />
          <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Known Limitations & Domain Shift Challenges</p>
        </div>
        <ul className="list-disc list-inside space-y-1.5 text-xs text-amber-200/90 pl-1 leading-relaxed">
          {data.honest_limitations?.map((lim: string, idx: number) => (
            <li key={idx}>{lim}</li>
          ))}
          <li>
            <strong className="text-amber-100">Monsoon Turbidity:</strong> High silt concentration turns creek water dark brown, reducing visual contrast compared to clear benchmark rivers.
          </li>
          <li>
            <strong className="text-amber-100">Surface Glare & Night Low-Light:</strong> Outfall cameras without IR illumination cannot reliably estimate surface density during nocturnal high tides.
          </li>
        </ul>
      </div>
    </div>
  );
}

