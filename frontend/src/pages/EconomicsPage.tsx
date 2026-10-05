import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fmt } from '../lib/utils';
import {
  Coins,
  DollarSign,
  TrendingUp,
  Cpu,
  Sliders,
  ShieldAlert,
  Layers,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function EconomicsPage() {
  // Pilot Cost Inputs (per year for 8 pilot sites)
  const [numSites, setNumSites] = useState(8);
  const [cloudHostingMonth, setCloudHostingMonth] = useState(25000); // INR / month
  const [fieldVisitsPerMonth, setFieldVisitsPerMonth] = useState(4);
  const [costPerVisit, setCostPerVisit] = useState(4500); // INR
  const [fuelPerMonth, setFuelPerMonth] = useState(35000); // INR for skimmer boats
  const [auditLaborMonth, setAuditLaborMonth] = useState(30000); // INR
  const [boomMaintPerSiteYear, setBoomMaintPerSiteYear] = useState(40000); // INR

  // Municipal Value & Service Fee
  const [municipalServiceFeeYear, setMunicipalServiceFeeYear] = useState(1800000); // INR annual service fee
  const [potentialEprPricePerKg, setPotentialEprPricePerKg] = useState(3.5); // INR / kg illustrative
  const [projectedRecoveryTonnes, setProjectedRecoveryTonnes] = useState(250); // tonnes / year

  // Calculations
  const annualHosting = cloudHostingMonth * 12;
  const annualFieldVisits = fieldVisitsPerMonth * costPerVisit * 12;
  const annualFuel = fuelPerMonth * 12;
  const annualAudit = auditLaborMonth * 12;
  const annualBoomMaint = boomMaintPerSiteYear * numSites;

  const totalAnnualPilotCost = annualHosting + annualFieldVisits + annualFuel + annualAudit + annualBoomMaint;
  const costPerSite = totalAnnualPilotCost / Math.max(1, numSites);

  // Revenue / value model
  const potentialEprRevenue = (projectedRecoveryTonnes * 1000) * potentialEprPricePerKg;
  const netPositionWithFee = municipalServiceFeeYear - totalAnnualPilotCost;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-cyan-900/30">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
              <Coins className="w-5 h-5 text-cyan-400" />
              Pilot Economics & Hardware Roadmap
            </h1>
            <Badge className="bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 text-[10px] font-bold">FEASIBILITY</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational expenditure worksheet, cost-recovery model, and Phase 2 IoT sensor roadmap
          </p>
        </div>

        <Badge className="bg-amber-950/80 text-amber-300 border border-amber-700/60 text-xs px-2.5 py-1 font-semibold self-start md:self-auto shadow-sm">
          PLANNING WORKSHEET — NOT A COMMERCIAL CONTRACT
        </Badge>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="ocean-card rounded-xl p-4 border-l-4 border-l-cyan-500 bg-[#050f20]/90">
          <p className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wide">Annual Operating Cost</p>
          <p className="text-2xl font-black text-white font-mono mt-1">₹{fmt(totalAnnualPilotCost, 0)}</p>
          <p className="text-[10px] text-slate-400 mt-1">For {numSites} pilot outfall sites</p>
        </div>
        <div className="ocean-card rounded-xl p-4 border-l-4 border-l-sky-400 bg-[#050f20]/90">
          <p className="text-[10px] font-semibold text-sky-300 uppercase tracking-wide">Cost Per Outlet / Year</p>
          <p className="text-2xl font-black text-sky-400 font-mono mt-1">₹{fmt(costPerSite, 0)}</p>
          <p className="text-[10px] text-slate-400 mt-1">~₹{fmt(costPerSite / 12, 0)} / mo per outlet</p>
        </div>
        <div className="ocean-card rounded-xl p-4 border-l-4 border-l-emerald-500 bg-[#050f20]/90">
          <p className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wide">Hypothetical Service Fee</p>
          <p className="text-2xl font-black text-emerald-400 font-mono mt-1">₹{fmt(municipalServiceFeeYear, 0)}</p>
          <p className="text-[10px] text-slate-400 mt-1">Annual municipal pilot budget</p>
        </div>
        <div className="ocean-card rounded-xl p-4 border-l-4 border-l-purple-500 bg-[#050f20]/90">
          <p className="text-[10px] font-semibold text-purple-300 uppercase tracking-wide">Net Pilot Viability</p>
          <p className={`text-2xl font-black font-mono mt-1 ${netPositionWithFee >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netPositionWithFee >= 0 ? '+' : ''}₹{fmt(netPositionWithFee, 0)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Excluding speculative EPR credits</p>
        </div>
      </div>

      {/* Editable Assumptions Worksheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
          <CardHeader>
            <CardTitle className="text-white font-bold text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-cyan-400" />
              Pilot Operational Cost Breakdown (Editable)
            </CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">Adjust line items to explore municipal deployment economics</p>
          </CardHeader>
          <CardContent className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Active Outfall Sites: <strong className="text-white font-mono">{numSites}</strong></span>
              </div>
              <input type="range" min="4" max="24" step="1" value={numSites} onChange={e => setNumSites(parseInt(e.target.value))} className="w-full accent-cyan-400 cursor-pointer" />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Software Hosting & Telemetry:</span>
                <span className="font-bold text-cyan-300 font-mono">₹{fmt(cloudHostingMonth, 0)} / mo (₹{fmt(annualHosting, 0)}/yr)</span>
              </div>
              <input type="range" min="10000" max="60000" step="5000" value={cloudHostingMonth} onChange={e => setCloudHostingMonth(parseInt(e.target.value))} className="w-full accent-cyan-400 cursor-pointer" />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Field Sampling Visits ({fieldVisitsPerMonth} visits/mo @ ₹{fmt(costPerVisit, 0)}):</span>
                <span className="font-bold text-cyan-300 font-mono">₹{fmt(annualFieldVisits, 0)} / yr</span>
              </div>
              <input type="range" min="2000" max="10000" step="500" value={costPerVisit} onChange={e => setCostPerVisit(parseInt(e.target.value))} className="w-full accent-cyan-400 cursor-pointer" />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Crew Travel & Skimmer Boat Fuel:</span>
                <span className="font-bold text-cyan-300 font-mono">₹{fmt(fuelPerMonth, 0)} / mo (₹{fmt(annualFuel, 0)}/yr)</span>
              </div>
              <input type="range" min="15000" max="70000" step="5000" value={fuelPerMonth} onChange={e => setFuelPerMonth(parseInt(e.target.value))} className="w-full accent-cyan-400 cursor-pointer" />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Third-Party Verification & Audit Labor:</span>
                <span className="font-bold text-cyan-300 font-mono">₹{fmt(annualAudit, 0)} / yr</span>
              </div>
              <input type="range" min="10000" max="60000" step="5000" value={auditLaborMonth} onChange={e => setAuditLaborMonth(parseInt(e.target.value))} className="w-full accent-cyan-400 cursor-pointer" />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300">Trash Boom & Winch Maintenance:</span>
                <span className="font-bold text-cyan-300 font-mono">₹{fmt(annualBoomMaint, 0)} / yr</span>
              </div>
              <input type="range" min="20000" max="80000" step="5000" value={boomMaintPerSiteYear} onChange={e => setBoomMaintPerSiteYear(parseInt(e.target.value))} className="w-full accent-cyan-400 cursor-pointer" />
            </div>
          </CardContent>
        </Card>

        {/* Value Realization & Revenue Sensitivity */}
        <div className="space-y-4">
          <Card className="ocean-card border border-cyan-900/40 bg-[#050f20]/90">
            <CardHeader>
              <CardTitle className="text-white font-bold text-base">Municipal Service Fee & EPR Sensitivity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Assumed Municipal Annual Service Budget:</span>
                  <span className="font-bold text-emerald-400 font-mono">₹{fmt(municipalServiceFeeYear, 0)}</span>
                </div>
                <input type="range" min="800000" max="3000000" step="100000" value={municipalServiceFeeYear} onChange={e => setMunicipalServiceFeeYear(parseInt(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Annual Recovered Quantity (Scenario):</span>
                  <span className="font-bold text-cyan-300 font-mono">{projectedRecoveryTonnes} tonnes</span>
                </div>
                <input type="range" min="50" max="1000" step="25" value={projectedRecoveryTonnes} onChange={e => setProjectedRecoveryTonnes(parseInt(e.target.value))} className="w-full accent-cyan-400 cursor-pointer" />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-300">Potential EPR Credit Value (Subject to Audit):</span>
                  <span className="font-bold text-sky-400 font-mono">₹{potentialEprPricePerKg.toFixed(1)} / kg</span>
                </div>
                <input type="range" min="0" max="8.0" step="0.5" value={potentialEprPricePerKg} onChange={e => setPotentialEprPricePerKg(parseFloat(e.target.value))} className="w-full accent-cyan-400 cursor-pointer" />
                <p className="text-[10px] text-slate-400 mt-1">
                  Illustrative potential: <span className="text-cyan-300 font-mono">₹{fmt(potentialEprRevenue, 0)}/yr</span> if formal EPR credits are certified.
                </p>
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-amber-200 text-[11px] leading-relaxed">
                <strong className="text-amber-300">Strict Honesty Notice:</strong> EPR credits cannot be guaranteed in advance. Municipal service fees and avoided flood damage represent the core business case; EPR eligibility is an upside contingent on accredited third-party certification.
              </div>
            </CardContent>
          </Card>

          {/* Phase 2 Hardware Roadmap */}
          <Card className="ocean-card border border-indigo-900/40 bg-[#070b1e]/90">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white font-bold text-sm">Phase 2 Hardware Roadmap</CardTitle>
                <Badge className="bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">FUTURE PHASES</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <span className="font-bold text-cyan-400 font-mono">1.</span>
                <p>
                  <strong className="text-white">Solar-Powered ESP32 Ultrasonic Water-Depth Telemetry:</strong> Low-cost ultrasonic transducers mounted above outfall culverts transmitting hourly depth readings over LoRaWAN/NB-IoT.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-cyan-400 font-mono">2.</span>
                <p>
                  <strong className="text-white">Solar CCTV Edge Nodes:</strong> 4G camera units with local micro-NPU for on-device debris bounding box detection, reducing cloud bandwidth costs.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-cyan-400 font-mono">3.</span>
                <p>
                  <strong className="text-white">Citizen WhatsApp Bot:</strong> Geotagged photo reporting pipeline for slum settlements along Mithi River, validating model choke predictions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
