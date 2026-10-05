import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { RiskLevel, SourceStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function riskColor(level: RiskLevel | string) {
  switch (level) {
    case 'Critical': return 'text-rose-400';
    case 'High': return 'text-orange-400';
    case 'Medium': return 'text-amber-400';
    default: return 'text-emerald-400';
  }
}

export function riskBgColor(level: RiskLevel | string) {
  switch (level) {
    case 'Critical': return 'bg-rose-950/40 border-rose-500/30 text-rose-200';
    case 'High': return 'bg-orange-950/40 border-orange-500/30 text-orange-200';
    case 'Medium': return 'bg-amber-950/40 border-amber-500/30 text-amber-200';
    default: return 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200';
  }
}

export function riskBadgeColor(level: RiskLevel | string) {
  switch (level) {
    case 'Critical': return 'bg-rose-950/80 text-rose-300 border border-rose-500/50 shadow-xs shadow-rose-900/40';
    case 'High': return 'bg-orange-950/80 text-orange-300 border border-orange-500/50 shadow-xs shadow-orange-900/40';
    case 'Medium': return 'bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-xs shadow-amber-900/40';
    default: return 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-xs shadow-emerald-900/40';
  }
}

export function riskMarkerColor(level: RiskLevel | string) {
  switch (level) {
    case 'Critical': return '#f43f5e';
    case 'High': return '#fb923c';
    case 'Medium': return '#facc15';
    default: return '#10b981';
  }
}

export function sourceBadge(status: SourceStatus | string) {
  switch (status) {
    case 'Real': return 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40';
    case 'Simulated': return 'bg-purple-950/80 text-purple-300 border border-purple-500/40';
    case 'Manually entered': return 'bg-amber-950/80 text-amber-300 border border-amber-500/40';
    case 'Imported': return 'bg-sky-950/80 text-sky-300 border border-sky-500/40';
    default: return 'bg-slate-900 text-slate-300 border border-slate-700';
  }
}

export function priorityBadge(p: string) {
  switch (p) {
    case 'Critical': return 'bg-rose-950/80 text-rose-300 border border-rose-500/50';
    case 'High': return 'bg-orange-950/80 text-orange-300 border border-orange-500/50';
    case 'Medium': return 'bg-amber-950/80 text-amber-300 border border-amber-500/50';
    default: return 'bg-slate-900 text-slate-300 border border-slate-700';
  }
}

export function statusBadge(s: string) {
  switch (s) {
    case 'Completed': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'In Progress': return 'bg-blue-100 text-blue-700 border border-blue-200';
    case 'Dispatched': return 'bg-indigo-100 text-indigo-700 border border-indigo-200';
    case 'Cancelled': return 'bg-slate-100 text-slate-500';
    default: return 'bg-amber-100 text-amber-700 border border-amber-200';
  }
}

export function verificationBadge(v: string) {
  switch (v) {
    case 'Verified': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'Rejected': return 'bg-red-100 text-red-700 border border-red-200';
    default: return 'bg-amber-100 text-amber-700 border border-amber-200';
  }
}

export function fmt(n: number, decimals = 1) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
