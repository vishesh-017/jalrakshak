import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  getCleanupTasks, getSites, createCleanupTask, updateCleanupTask,
  getCleanupRecommendations, optimizeCleanupRoute,
  type RecommendationItem, type RouteResult
} from '../lib/api';
import type { CleanupTask, MonitoringSite } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../components/ui/States';
import { priorityBadge, statusBadge, riskBadgeColor, fmtDateTime } from '../lib/utils';
import { useRbac } from '../context/RbacContext';
import {
  Navigation as NavigationIcon,
  CheckCircle2,
  Clock,
  Truck,
  Plus,
  Filter,
  AlertTriangle,
  Waves,
  Sparkles,
  ArrowRight,
  Shield,
  Radio,
  RotateCcw,
  MapPin,
  ExternalLink
} from 'lucide-react';

const TEAMS = [
  'BMC Coastal Trash Skimmer Unit 1',
  'Ward L & H-East Rapid Cleanup Crew',
  'Mangrove Cell Coastal Taskforce',
  'Zone V Stormwater Operations',
  'Zone II Creek Response Team',
];

const EQUIPMENT = [
  'River Trash Skimmer Boat',
  'JCB Excavator & Silt Screen Winch',
  'Manual Netting Waders & Eco-Boat',
  'Hydraulic Grab Crane',
];

export default function CleanupPage() {
  const [searchParams] = useSearchParams();
  const { roleConfig } = useRbac();

  const [tasks, setTasks] = useState<CleanupTask[]>([]);
  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    site_id: '', title: '', priority: 'High', team_name: TEAMS[0],
    equipment_assigned: EQUIPMENT[0], target_date: new Date().toISOString().slice(0, 10),
    estimated_load_kg: 300, notes: '',
  });

  async function load() {
    setLoading(true);
    try {
      const [t, s, recs] = await Promise.all([
        getCleanupTasks(),
        getSites(),
        getCleanupRecommendations(40.0)
      ]);
      setTasks(t);
      setSites(s);
      setRecommendations(recs);

      const siteParam = searchParams.get('site');
      const hotspotParam = searchParams.get('hotspot');
      if (siteParam) {
        setForm(f => ({
          ...f,
          site_id: siteParam,
          title: hotspotParam ? `Clean Hotspot ${hotspotParam} at ${siteParam}` : `Clear outlet at ${siteParam}`
        }));
      } else if (s.length > 0 && !form.site_id) {
        setForm(f => ({ ...f, site_id: s[0].id }));
      }
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      await createCleanupTask({ ...form, status: 'Pending' } as Partial<CleanupTask>);
      setShowForm(false);
      await load();
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setCreating(false); }
  }

  async function handleStatusChange(taskId: number, status: string) {
    try {
      await updateCleanupTask(taskId, { status } as Partial<CleanupTask>);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: status as CleanupTask['status'] } : t));
    } catch {}
  }

  async function handleApproveRecommendation(rec: RecommendationItem) {
    try {
      await createCleanupTask({
        site_id: rec.site_id,
        title: `Clearance at ${rec.site_name}`,
        priority: rec.current_risk_level === 'Critical' ? 'Critical' : 'High',
        status: 'Dispatched',
        team_name: rec.suggested_crew,
        equipment_assigned: rec.suggested_equipment,
        target_date: new Date().toISOString().slice(0, 10),
        estimated_load_kg: rec.estimated_plastic_kg,
        notes: `Operator approved recommendation: ${rec.recommendation_reason}`
      });
      await load();
    } catch {}
  }

  async function handleOptimizeRoute() {
    setRoutingLoading(true);
    try {
      const highRiskIds = recommendations.slice(0, 5).map(r => r.site_id);
      const res = await optimizeCleanupRoute({
        site_ids: highRiskIds.length > 0 ? highRiskIds : undefined,
        max_shift_hours: 8.0,
      });
      setRouteResult(res);
    } catch (e: any) {
      alert(`Routing optimization error: ${e.message}`);
    } finally {
      setRoutingLoading(false);
    }
  }

  const filtered = tasks.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const statusCounts = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <LoadingSpinner text="Loading cleanup operations..." />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white font-heading flex items-center gap-2">
              <NavigationIcon className="w-5 h-5 text-cyan-400" />
              Smart Cleanup Dispatch & OR-Tools Routing
            </h1>
            <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">OPERATIONS</Badge>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Operator-reviewed trash skimmer dispatch and Google OR-Tools vehicle routing optimization
          </p>
        </div>

        <div className="flex items-center gap-2">
          {roleConfig.canApproveDispatch ? (
            <>
              <Button
                onClick={handleOptimizeRoute}
                loading={routingLoading}
                className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-950/50"
              >
                ⚡ Optimize Route (OR-Tools)
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(!showForm)}
                className="text-xs border-cyan-700/60 text-cyan-300 hover:bg-cyan-950/60"
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                + Manual Task
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-bold shadow-xs">
              <Truck className="w-4 h-4 text-cyan-400" />
              <span>Assigned Ground Tasks View</span>
            </div>
          )}
        </div>
      </div>

      {/* 5 Status Summary Cards with High-Contrast Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Pending Approval', count: statusCounts['Pending'] ?? 0, color: 'text-amber-400', border: 'border-l-amber-500' },
          { label: 'Dispatched', count: statusCounts['Dispatched'] ?? 0, color: 'text-cyan-400', border: 'border-l-cyan-400' },
          { label: 'In Progress', count: statusCounts['In Progress'] ?? 0, color: 'text-blue-400', border: 'border-l-blue-500' },
          { label: 'Completed', count: statusCounts['Completed'] ?? 0, color: 'text-emerald-400', border: 'border-l-emerald-400' },
          { label: 'Cancelled', count: statusCounts['Cancelled'] ?? 0, color: 'text-slate-400', border: 'border-l-slate-600' },
        ].map(s => (
          <div key={s.label} className={`bg-[#050f20]/90 border border-cyan-500/20 rounded-2xl p-3.5 text-center border-l-4 ${s.border} shadow-xl`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">{s.label}</p>
            <p className={`text-3xl font-black font-heading mt-1 font-mono ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Recommended Tasks from High-Risk Forecasts */}
      {recommendations.length > 0 && (
        <Card className="bg-[#050f20]/95 border-amber-500/40 shadow-2xl">
          <CardHeader className="pb-3 border-b border-amber-500/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  High-Risk Recommended Interventions ({recommendations.length})
                </CardTitle>
                <p className="text-xs text-slate-300 mt-0.5">
                  Algorithmically ranked by predicted choke risk and barrier status. Operator review required.
                </p>
              </div>
              <Badge className="bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] font-bold">DECISION SUPPORT</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-cyan-950/60">
              {recommendations.slice(0, 4).map(rec => (
                <div key={rec.site_id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#071426] transition-colors">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-amber-300 font-bold bg-[#040e1b] px-2 py-0.5 rounded border border-amber-500/30">
                        {rec.site_id}
                      </span>
                      <span className="text-sm font-bold text-white">{rec.site_name}</span>
                      <Badge className={riskBadgeColor(rec.current_risk_level)}>{rec.current_risk_level}</Badge>
                      <span className="text-xs text-slate-300">
                        Risk Score: <strong className="text-rose-400 font-mono">{rec.current_risk_score}/100</strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-200">
                      <strong className="text-amber-400">Directive:</strong> {rec.recommendation_reason}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Suggested: <strong className="text-slate-200">{rec.suggested_crew}</strong> ({rec.suggested_equipment}) · Est. Debris: <strong className="text-cyan-300 font-mono">{rec.estimated_plastic_kg} kg</strong>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleApproveRecommendation(rec)}
                    className="bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white font-bold text-xs shadow-md shrink-0"
                  >
                    ✓ Approve & Dispatch
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* OR-Tools Optimized Route Result */}
      {routeResult && (
        <Card className="bg-[#050f20]/95 border-cyan-500/40 shadow-2xl">
          <CardHeader className="pb-3 border-b border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <NavigationIcon className="w-4 h-4 text-cyan-400" />
                  Optimized Crew Stop Sequence (Google OR-Tools VRPTW)
                </CardTitle>
                <p className="text-xs text-slate-300 mt-0.5">
                  Depot: Dadar Central Hub · Shift Budget: 8.0h Max · Optimized waypoint sequence
                </p>
              </div>
              <Badge className="bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
                {routeResult.optimization_engine}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div className="bg-[#030914] p-3 rounded-xl border border-cyan-950 shadow-md">
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Total Patrol Distance</p>
                <p className="text-xl font-black text-cyan-300 font-mono mt-1">{routeResult.total_distance_km} km</p>
              </div>
              <div className="bg-[#030914] p-3 rounded-xl border border-cyan-950 shadow-md">
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Total Shift Duration</p>
                <p className="text-xl font-black text-teal-300 font-mono mt-1">{routeResult.total_duration_hours} h</p>
              </div>
              <div className="bg-[#030914] p-3 rounded-xl border border-cyan-950 shadow-md">
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide">Transit Travel Time</p>
                <p className="text-xl font-black text-blue-300 font-mono mt-1">{routeResult.transit_duration_hours} h</p>
              </div>
              <div className="bg-[#030914] p-3 rounded-xl border border-cyan-950 shadow-md">
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide">On-Site Work Duration</p>
                <p className="text-xl font-black text-emerald-300 font-mono mt-1">{routeResult.on_site_work_hours} h</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-200 uppercase tracking-wide">Recommended Waypoint Sequence:</p>
              <div className="divide-y divide-cyan-950/60 bg-[#030914] rounded-xl border border-cyan-950 overflow-hidden shadow-md">
                {routeResult.stops.map(stop => (
                  <div key={stop.stop_index} className="p-3 flex items-center justify-between text-xs hover:bg-[#071426] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-xs">
                        {stop.stop_index}
                      </span>
                      <div>
                        <p className="font-bold text-white text-xs">{stop.name}</p>
                        <p className="text-[11px] text-slate-300">{stop.urgency_reason}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-cyan-300 font-mono">Arrival: +{stop.arrival_time_offset_min.toFixed(0)} min</p>
                      <p className="text-[10px] text-slate-400">Leg: {stop.leg_distance_km} km · Est. debris: {stop.estimated_debris_kg} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {routeResult.unassigned_sites?.length > 0 && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-200">
                <strong className="text-rose-300">Unassigned Locations:</strong>
                <ul className="list-disc list-inside mt-1">
                  {routeResult.unassigned_sites.map(u => (
                    <li key={u.site_id}>{u.name}: {u.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-slate-500 italic">
              {routeResult.disclaimer}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Create Task Form */}
      {showForm && (
        <Card className="bg-[#050f20]/95 border-cyan-500/40 shadow-2xl">
          <CardHeader className="pb-3 border-b border-cyan-950/80">
            <CardTitle className="text-white">Create New Cleanup Task</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Site</label>
              <select
                value={form.site_id}
                onChange={e => setForm(f => ({ ...f, site_id: e.target.value, title: `Clear outlet at ${sites.find(s => s.id === e.target.value)?.name ?? ''}` }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
              >
                {sites.map(s => <option key={s.id} value={s.id}>{s.id}: {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
              >
                {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs text-slate-300 font-medium block mb-1">Task Title</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
                placeholder="Describe the cleanup objective..."
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Assigned Team</label>
              <select
                value={form.team_name}
                onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
              >
                {TEAMS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Equipment</label>
              <select
                value={form.equipment_assigned}
                onChange={e => setForm(f => ({ ...f, equipment_assigned: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
              >
                {EQUIPMENT.map(eq => <option key={eq}>{eq}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Target Date</label>
              <input
                type="date"
                value={form.target_date}
                onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium block mb-1">Est. Load (kg)</label>
              <input
                type="number"
                value={form.estimated_load_kg}
                onChange={e => setForm(f => ({ ...f, estimated_load_kg: parseFloat(e.target.value) }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs text-slate-300 font-medium block mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full text-xs border border-cyan-900/60 rounded-xl px-2.5 py-2 text-white bg-[#030914] focus:border-cyan-400 focus:outline-none h-16 resize-none"
              />
            </div>
            <div className="col-span-1 sm:col-span-2 flex gap-2">
              <Button onClick={handleCreate} loading={creating}>Create Task</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="text-xs border border-cyan-900/60 rounded-xl px-3 py-1.5 bg-[#030914] text-white focus:outline-none"
        >
          <option value="">All Statuses</option>
          {['Pending', 'Dispatched', 'In Progress', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="text-xs border border-cyan-900/60 rounded-xl px-3 py-1.5 bg-[#030914] text-white focus:outline-none"
        >
          <option value="">All Priorities</option>
          {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
        </select>
        <span className="text-xs text-cyan-300 font-mono">{filtered.length} active tasks</span>
      </div>

      {/* Task List */}
      {filtered.length === 0 ? (
        <EmptyState title="No cleanup tasks matching filters" description="Dispatch a task above or change filters." />
      ) : (
        <div className="space-y-3">
          {filtered.map((task, i) => {
            const site = sites.find(s => s.id === task.site_id);
            return (
              <Card key={task.id} className="bg-[#050f20]/90 border-cyan-500/20 shadow-xl hover:border-cyan-500/40 transition-colors">
                <CardContent className="py-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-xs font-black shrink-0 font-mono shadow-md">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{task.title}</p>
                          <Badge className={priorityBadge(task.priority)}>{task.priority}</Badge>
                          <Badge className={statusBadge(task.status)}>{task.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{task.team_name} · {task.equipment_assigned}</p>
                        {site && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-slate-400">Site:</span>
                            <span className="text-xs font-bold text-cyan-300">{site.name}</span>
                            <Badge className={riskBadgeColor(site.current_risk_level)}>{site.current_risk_level}</Badge>
                            <Link
                              to={`/map?highlight=${task.site_id}`}
                              className="text-[10.5px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                            >
                              <MapPin className="w-3 h-3" /> View on GIS Map
                            </Link>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                          <span>Target: <strong className="text-slate-200">{task.target_date}</strong></span>
                          <span>Est. load: <strong className="text-cyan-300 font-mono">{task.estimated_load_kg} kg</strong></span>
                          {task.dispatched_at && <span>Dispatched: <strong className="text-slate-200">{fmtDateTime(task.dispatched_at)}</strong></span>}
                        </div>
                        {task.notes && <p className="text-xs text-slate-400 mt-1.5 italic bg-[#030914] px-2.5 py-1 rounded-lg border border-cyan-950/70">{task.notes}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 pt-1">
                      {task.status === 'Pending' && (
                        <Button size="sm" onClick={() => handleStatusChange(task.id, 'Dispatched')}>Approve & Dispatch</Button>
                      )}
                      {task.status === 'Dispatched' && (
                        <Button size="sm" variant="secondary" onClick={() => handleStatusChange(task.id, 'In Progress')}>Mark In Progress</Button>
                      )}
                      {task.status === 'In Progress' && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(task.id, 'Completed')} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50">Complete</Button>
                      )}
                      {['Pending', 'Dispatched'].includes(task.status) && (
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(task.id, 'Cancelled')} className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/50">Cancel</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
