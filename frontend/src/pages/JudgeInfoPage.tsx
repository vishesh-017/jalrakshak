import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  Award, Sparkles, AlertCircle, Lightbulb, Camera,
  Cpu, Navigation, ShieldCheck, Clock, HelpCircle, CheckCircle2
} from 'lucide-react';

export default function JudgeInfoPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Hackathon Pitch Deck & Alignment</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">JalRakshak — Judge Briefing & Pitch Materials</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Predictive Plastic Leakage Monitoring, Smart Dispatch, and Evidence-Backed Recovery Ledger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-sky-50 text-sky-800 border border-sky-200 text-xs px-3 py-1 font-semibold flex items-center gap-1.5 shadow-sm">
            <Award className="w-3.5 h-3.5 text-sky-600" />
            Techfest IIT Bombay InnovateX
          </Badge>
          <Badge className="bg-teal-50 text-teal-800 border border-teal-200 text-xs px-3 py-1 font-semibold">
            Theme 3: Coastal Mumbai
          </Badge>
        </div>
      </div>

      {/* One-Line Pitch Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#041628] via-[#072b48] to-[#0a3f63] text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <p className="text-xs uppercase tracking-widest font-bold text-cyan-300">Executive One-Line Pitch</p>
        </div>
        <p className="text-lg md:text-xl font-medium leading-relaxed text-slate-100 italic">
          "JalRakshak forecasts which Mumbai drain outlets are most likely to leak plastic after rainfall, dispatches cleanup crews in an optimized order, and keeps an evidence-backed recovery ledger for potential EPR credit generation."
        </p>
      </div>

      {/* Problem & Solution Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="ocean-card">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              The Mumbai Coastal Waterway Challenge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs text-slate-700 leading-relaxed pt-4">
            <p>
              Mumbai discharges stormwater through over 200 major nullahs and creek outfalls into the Arabian Sea, Mahim Bay, and Thane Creek.
            </p>
            <p>
              During intense monsoon rainfall, stormwater surges flush uncollected municipal solid waste. Simultaneously, high spring tides (&gt;4.2m) force seawater back into culverts, submerging trash booms and causing sudden debris chokes.
            </p>
            <p>
              Municipal crews currently clean drains reactively after flooding has already occurred, losing valuable time and allowing thousands of kilograms of plastic to spill into the marine ecosystem.
            </p>
          </CardContent>
        </Card>

        <Card className="ocean-card">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-teal-600" />
              The JalRakshak Innovation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs text-slate-700 leading-relaxed pt-4">
            <p>
              <strong>1. Predictive Leakage Forecaster:</strong> Fuses rainfall forecasts, semi-diurnal tidal cycles, urban density, and CCTV debris counts to score choke risk 48 hours in advance.
            </p>
            <p>
              <strong>2. Smart Routing Dispatch:</strong> Uses Google OR-Tools to compute the optimal multi-stop route for skimmer boats and excavators before peak rainfall hits.
            </p>
            <p>
              <strong>3. Tamper-Evident Recovery Ledger:</strong> Logs scale-weighed kilograms with material segregation and SHA-256 audit hashes, creating verifiable provenance for potential EPR credits.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Technical Architecture */}
      <Card className="ocean-card">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-600" />
            End-to-End System Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-xl space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <p className="font-bold text-slate-900 text-xs mt-2">1. Perception</p>
              <p className="text-[11px] text-slate-600 font-semibold">YOLOv8 + OpenCV</p>
              <p className="text-[10px] text-slate-400">Kili river & ReWater aerial weights</p>
            </div>
            <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-xl space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <p className="font-bold text-slate-900 text-xs mt-2">2. Forecasting</p>
              <p className="text-[11px] text-slate-600 font-semibold">XGBoost + Heuristic</p>
              <p className="text-[10px] text-slate-400">Multi-factor hydrological model</p>
            </div>
            <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-xl space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <Navigation className="w-4 h-4" />
              </div>
              <p className="font-bold text-slate-900 text-xs mt-2">3. Optimization</p>
              <p className="text-[11px] text-slate-600 font-semibold">Google OR-Tools</p>
              <p className="text-[10px] text-slate-400">Vehicle routing with time limits</p>
            </div>
            <div className="p-3.5 bg-slate-50/80 border border-slate-200/90 rounded-xl space-y-1">
              <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="font-bold text-slate-900 text-xs mt-2">4. Recovery Ledger</p>
              <p className="text-[11px] text-slate-600 font-semibold">SHA-256 Hash Chain</p>
              <p className="text-[10px] text-slate-400">Tamper-evident audit export</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5-Minute Demonstration Guide */}
      <Card className="ocean-card">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              5-Minute Live Demonstration Timeline
            </CardTitle>
            <Badge className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-semibold">
              JUDGE WALKTHROUGH
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-700 pt-4">
          <div className="space-y-2.5">
            <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
              <span className="font-mono font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                0:00 – 1:00
              </span>
              <p>
                <strong>Overview & Map:</strong> Show the Hotspot Map. Point out the 10 pilot outfall sites along Mithi River, Malad Creek, and Trombay. Emphasize that all coordinates and baseline risk scores reflect typical pre-monsoon conditions.
              </p>
            </div>
            <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
              <span className="font-mono font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                1:00 – 2:00
              </span>
              <p>
                <strong>Storm Simulation:</strong> Navigate to Settings or Demo Mode. Trigger the 85mm heavy downpour with 4.4m spring tide. Show the immediate recalculation of risk scores across all 10 outlets.
              </p>
            </div>
            <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
              <span className="font-mono font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                2:00 – 3:00
              </span>
              <p>
                <strong>AI Debris Detection:</strong> Open AI Detection Studio. Run inference on <code className="bg-white border border-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">mithi_high_plastic_01.jpg</code>. Show detected bounding boxes (bottles, bags, rigid plastic) and accumulation severity index.
              </p>
            </div>
            <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
              <span className="font-mono font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                3:00 – 4:00
              </span>
              <p>
                <strong>Cleanup Dispatch & Routing:</strong> Go to Cleanup Dispatch. View recommendations ranked by risk score. Click "Optimize Cleanup Route" to demonstrate OR-Tools generating the optimal stop order for BMC Skimmer Unit 1.
              </p>
            </div>
            <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-start gap-3">
              <span className="font-mono font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded text-[11px] shrink-0 mt-0.5">
                4:00 – 5:00
              </span>
              <p>
                <strong>Verified Recovery Ledger:</strong> Complete the task and log 485 kg weighed at Bhandup MRF. Show the SHA-256 audit hash and CSV export. Conclude on the Model Card highlighting our strict data honesty rules.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 10-Minute Pitch Outline & Q&A Cheat Sheet */}
      <Card className="ocean-card">
        <CardHeader className="border-b border-slate-100 pb-3">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-600" />
            Q&A Cheat Sheet for InnovateX Judges
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3.5 text-xs text-slate-700 pt-4">
          <div className="p-3.5 border border-slate-200/80 rounded-xl bg-slate-50/50">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
              Q1: How do you address domain shift between clean river datasets and muddy Mumbai nullahs?
            </p>
            <p className="text-slate-600 mt-1 pl-3 border-l-2 border-cyan-500">
              <strong>Answer:</strong> Benchmark models like Kili were trained on clear European/Asian rivers. Mumbai nullahs suffer from heavy silt turbidity and floating hyacinth. JalRakshak addresses this by providing a dedicated localized training pipeline (<code className="bg-white border border-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">/data/mumbai</code>) and a hybrid contour-density fallback in OpenCV when confidence is marginal.
            </p>
          </div>
          <div className="p-3.5 border border-slate-200/80 rounded-xl bg-slate-50/50">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
              Q2: Can you guarantee EPR credit revenue to the municipality?
            </p>
            <p className="text-slate-600 mt-1 pl-3 border-l-2 border-cyan-500">
              <strong>Answer:</strong> Absolutely not. In accordance with our Non-Negotiable Honesty Rules, JalRakshak tracks "potential EPR eligibility" only. EPR credits require accredited third-party validation and registration under CPCB/MPCB plastic waste management rules. Our primary municipal value proposition is flood mitigation and operational cost reduction.
            </p>
          </div>
          <div className="p-3.5 border border-slate-200/80 rounded-xl bg-slate-50/50">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-600"></span>
              Q3: How do you avoid future-data leakage in your risk model?
            </p>
            <p className="text-slate-600 mt-1 pl-3 border-l-2 border-cyan-500">
              <strong>Answer:</strong> We enforce strict chronological train/test splitting (first 70% for training, subsequent 30% for validation). Standard random K-fold CV leaks temporal autocorrelation in monsoon weather sequences.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

