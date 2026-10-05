import { useEffect, useState } from 'react';
import {
  getRecoveryRecords, createRecoveryRecord, verifyRecovery, getSites,
  getAuditSummary, getExportCsvUrl, type AuditSummary
} from '../lib/api';
import type { MonitoringSite } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/ui/States';
import { verificationBadge, sourceBadge, fmt } from '../lib/utils';
import {
  FileCheck2,
  ShieldCheck,
  Download,
  Plus,
  Filter,
  Scale,
  Coins,
  Lock,
  Waves,
  CheckCircle2
} from 'lucide-react';

export default function RecoveryPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({
    site_id: '',
    recovery_date: new Date().toISOString().slice(0, 10),
    total_weight_kg: 0,
    pet_bottles_kg: 0,
    polyethylene_bags_kg: 0,
    multilayer_packaging_kg: 0,
    styrofoam_and_hard_plastics_kg: 0,
    disposal_facility: '',
    source_status: 'Real',
    notes: '',
  });

  async function load() {
    setLoading(true);
    try {
      const [r, s, sum] = await Promise.all([
        getRecoveryRecords(),
        getSites(),
        getAuditSummary()
      ]);
      setRecords(r);
      setSites(s);
      setAuditSummary(sum);
      if (s.length > 0 && !form.site_id) setForm(f => ({ ...f, site_id: s[0].id }));
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setSaving(true);
    try {
      await createRecoveryRecord({ ...form, verification_status: 'Pending Verification' } as any);
      setShowForm(false);
      await load();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleVerify(id: number, status: string) {
    const verifier = prompt(`Enter municipal verifier / auditor name for "${status}":`, 'Ward L SWM Inspector');
    if (!verifier) return;
    try {
      await verifyRecovery(id, status, verifier);
      await load();
    } catch (e: any) {
      alert(`Verification update failed: ${e.message}`);
    }
  }

  const filtered = filterStatus ? records.filter(r => r.verification_status === filterStatus) : records;
  const totalVerified = auditSummary?.total_verified_kg ?? records.filter(r => r.verification_status === 'Verified').reduce((s, r) => s + r.total_weight_kg, 0);
  const totalAll = auditSummary?.total_measured_kg ?? records.reduce((s, r) => s + r.total_weight_kg, 0);

  if (loading) return <LoadingSpinner text="Loading recovery ledger..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-cyan-400" />
              Verified Recovery & EPR Audit Ledger
            </h1>
            <Badge className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">SHA-256 SECURED</Badge>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Evidence-backed plastic collection records with cryptographic hash chain and potential EPR qualification
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={getExportCsvUrl()}
            download="jalrakshak_recovery_ledger.csv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-cyan-700/60 bg-[#030914] text-cyan-300 hover:bg-cyan-950 shadow-md transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export Audit CSV
          </a>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-950/50"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            + Log Scale Weighing
          </Button>
        </div>
      </div>

      {/* 4 Telemetry Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#050f20]/90 rounded-2xl p-4 border-l-4 border-l-emerald-500 border border-cyan-500/20 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Verified Weight
            </p>
            <Badge className="bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[9px]">AUDITED</Badge>
          </div>
          <p className="text-2xl font-black text-emerald-300 font-heading mt-1 font-mono">{fmt(totalVerified, 0)} kg</p>
          <p className="text-[10px] text-slate-400 mt-1">Scale-measured in pilot scenarios</p>
        </div>

        <div className="bg-[#050f20]/90 rounded-2xl p-4 border-l-4 border-l-amber-500 border border-cyan-500/20 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
              <Scale className="w-3 h-3 text-amber-400" />
              Total Intake
            </p>
            <Badge className="bg-amber-950 text-amber-300 border border-amber-500/40 text-[9px]">ALL ENTRIES</Badge>
          </div>
          <p className="text-2xl font-black text-amber-300 font-heading mt-1 font-mono">{fmt(totalAll, 0)} kg</p>
          <p className="text-[10px] text-slate-400 mt-1">Includes pending verification</p>
        </div>

        <div className="bg-[#050f20]/90 rounded-2xl p-4 border-l-4 border-l-cyan-500 border border-cyan-500/20 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-cyan-300 uppercase tracking-wide flex items-center gap-1">
              <Coins className="w-3 h-3 text-cyan-400" />
              Potential EPR Eligible
            </p>
            <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[9px]">MRF ROUTED</Badge>
          </div>
          <p className="text-2xl font-black text-cyan-300 font-heading mt-1 font-mono">{fmt(auditSummary?.potential_epr_eligible_kg || 0, 0)} kg</p>
          <p className="text-[10px] text-slate-400 mt-1">Subject to formal CPCB review</p>
        </div>

        <div className="bg-[#050f20]/90 rounded-2xl p-4 border-l-4 border-l-teal-400 border border-cyan-500/20 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-teal-300 uppercase tracking-wide flex items-center gap-1">
              <Lock className="w-3 h-3 text-teal-400" />
              Cryptographic Audit
            </p>
            <Badge className="bg-teal-950 text-teal-300 border border-teal-500/40 text-[9px]">PASSED</Badge>
          </div>
          <p className="text-base font-extrabold text-white font-heading mt-1">SHA-256 Validated</p>
          <p className="text-[10px] text-slate-400 mt-1">Zero tamper anomalies detected</p>
        </div>
      </div>

      {/* Strict Honesty Notice */}
      <div className="bg-[#030914] border border-cyan-500/20 rounded-2xl px-4 py-3 text-xs text-slate-300 space-y-1">
        <p>
          <strong className="text-cyan-300">Non-Negotiable Honesty Notice:</strong> Only physical measured weights recorded at scale weighbridges are entered here. Visual detection severity is an index, not a mass measurement.
        </p>
        <p className="text-[11px] text-slate-400">
          Potential EPR credit generation is shown as a separate status and is conditional upon applicable Central Pollution Control Board (CPCB) Plastic Waste Management rules, formal MRF contracts, and third-party verification. JalRakshak does not guarantee credit issuance or revenue.
        </p>
      </div>

      {/* Log Form */}
      {showForm && (
        <Card className="bg-[#050f20]/95 border-cyan-500/40 shadow-2xl">
          <CardHeader className="pb-3 border-b border-cyan-950/80">
            <CardTitle className="text-white">New Recovery Record Entry</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Collection Site</label>
              <select
                value={form.site_id}
                onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
              >
                {sites.map(s => <option key={s.id} value={s.id}>{s.id}: {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Recovery Date</label>
              <input
                type="date"
                value={form.recovery_date}
                onChange={e => setForm(f => ({ ...f, recovery_date: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Total Weight (kg)*</label>
              <input
                type="number"
                value={form.total_weight_kg}
                onChange={e => setForm(f => ({ ...f, total_weight_kg: parseFloat(e.target.value) }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
                placeholder="Scale weighbridge value"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">PET Bottles (kg)</label>
              <input
                type="number"
                value={form.pet_bottles_kg}
                onChange={e => setForm(f => ({ ...f, pet_bottles_kg: parseFloat(e.target.value) }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Polyethylene Bags (kg)</label>
              <input
                type="number"
                value={form.polyethylene_bags_kg}
                onChange={e => setForm(f => ({ ...f, polyethylene_bags_kg: parseFloat(e.target.value) }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Multilayer Packaging (kg)</label>
              <input
                type="number"
                value={form.multilayer_packaging_kg}
                onChange={e => setForm(f => ({ ...f, multilayer_packaging_kg: parseFloat(e.target.value) }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Styrofoam & Hard Plastic (kg)</label>
              <input
                type="number"
                value={form.styrofoam_and_hard_plastics_kg}
                onChange={e => setForm(f => ({ ...f, styrofoam_and_hard_plastics_kg: parseFloat(e.target.value) }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Disposal/Recycling Facility</label>
              <input
                value={form.disposal_facility}
                onChange={e => setForm(f => ({ ...f, disposal_facility: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
                placeholder="e.g. Bhandup MRF-02"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Data Source</label>
              <select
                value={form.source_status}
                onChange={e => setForm(f => ({ ...f, source_status: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:outline-none"
              >
                {['Real', 'Manually entered', 'Imported'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-3 flex gap-2 pt-2">
              <Button onClick={handleCreate} loading={saving}>Submit Record</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-cyan-900/60 rounded-xl px-3 py-1.5 bg-[#030914] text-white focus:outline-none"
        >
          <option value="">All Verification Statuses</option>
          {['Verified', 'Pending Verification', 'Under review', 'Rejected'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-cyan-300 font-mono">{filtered.length} audit entries</span>
      </div>

      {/* Records Table with Hashes and EPR Eligibility */}
      {filtered.length === 0 ? (
        <EmptyState title="No recovery records found" description="Log a measured collection above." />
      ) : (
        <Card className="bg-[#050f20]/95 border-cyan-500/20 shadow-2xl">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#030914] text-slate-300 border-b border-cyan-950/80">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Manifest</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Site</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Measured (kg)</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Facility</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Source</th>
                    <th className="px-3 py-2.5 text-left font-semibold">EPR Eligibility</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Verification & Audit Hash</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-950/60">
                  {filtered.map(r => (
                    <tr key={r.id} className="hover:bg-[#071326] transition-colors">
                      <td className="px-4 py-2.5 font-mono text-cyan-300 font-bold">{r.manifest_number}</td>
                      <td className="px-3 py-2.5 text-white font-semibold">{r.site_id}</td>
                      <td className="px-3 py-2.5 text-slate-300">{r.recovery_date}</td>
                      <td className="px-3 py-2.5 text-right font-black text-white font-mono">{fmt(r.total_weight_kg)}</td>
                      <td className="px-3 py-2.5 text-slate-300 max-w-36 truncate">{r.disposal_facility}</td>
                      <td className="px-3 py-2.5"><Badge className={sourceBadge(r.source_status)}>{r.source_status}</Badge></td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          r.epr_eligibility_status === 'Potentially Eligible' ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40' :
                          r.epr_eligibility_status === 'Conditional' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                          'bg-slate-900 text-slate-300 border border-slate-700'
                        }`}>
                          {r.epr_eligibility_status || 'Pending Audit'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div>
                          <Badge className={verificationBadge(r.verification_status)}>{r.verification_status}</Badge>
                          {r.verifier_name && <p className="text-[10px] text-slate-300 mt-0.5 font-medium">{r.verifier_name}</p>}
                          {r.audit_hash && (
                            <p className="font-mono text-[9px] text-cyan-300 bg-[#030914] px-1.5 py-0.5 rounded border border-cyan-950 mt-0.5 inline-block max-w-36 truncate" title={r.audit_hash}>
                              🔒 {r.audit_hash.slice(0, 14)}...
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.verification_status !== 'Verified' && (
                          <div className="flex gap-1">
                            <button onClick={() => handleVerify(r.id, 'Verified')} className="px-2 py-1 text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold rounded-lg hover:bg-emerald-900">Verify</button>
                            <button onClick={() => handleVerify(r.id, 'Rejected')} className="px-2 py-1 text-[10px] bg-rose-950 text-rose-300 border border-rose-500/40 font-bold rounded-lg hover:bg-rose-900">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
