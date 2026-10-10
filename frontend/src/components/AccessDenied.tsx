import React from 'react';
import { useRbac } from '../context/RbacContext';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, Lock, UserCheck, Waves } from 'lucide-react';
import { Button } from './ui/Button';

export default function AccessDenied({ path }: { path: string }) {
  const { user, openLoginModal } = useRbac();
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-[#040a16] border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-500/30">
            RBAC ACCESS RESTRICTED
          </span>
          <h2 className="text-xl font-black text-white mt-2 font-heading">
            Module Clearance Required
          </h2>
          <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
            Your current municipal role <strong className="text-cyan-400">({user.badge} — {user.name})</strong> does not have authorization clearance to access <code className="text-rose-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">{path}</code>.
          </p>
        </div>

        <div className="bg-[#020614] rounded-xl p-3 border border-slate-800 text-left text-xs space-y-1.5">
          <div className="text-slate-400 font-bold flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            Role Scope Details:
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            {user.description}
          </p>
          <div className="pt-2 border-t border-slate-800">
            <span className="text-[10.5px] text-slate-400 block mb-1">Your authorized workspaces:</span>
            <div className="flex flex-wrap gap-1">
              {user.allowedRoutes.map(r => (
                <Link
                  key={r}
                  to={r}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-900"
                >
                  {r === '/' ? 'Command Center' : r}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <Button
            onClick={() => navigate(user.homeRoute)}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs h-9"
          >
            <span>Go to My Workspace ({user.homeRoute})</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>

          <Button
            variant="outline"
            onClick={openLoginModal}
            className="flex-1 border-cyan-500/40 text-cyan-300 hover:bg-cyan-950/60 text-xs h-9"
          >
            <UserCheck className="w-3.5 h-3.5 mr-1" />
            Switch Municipal Role
          </Button>
        </div>
      </div>
    </div>
  );
}
