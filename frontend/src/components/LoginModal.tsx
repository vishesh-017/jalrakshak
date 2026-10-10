import React, { useState } from 'react';
import { useRbac, PERSONAS, type UserRole } from '../context/RbacContext';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  UserCheck,
  Lock,
  ArrowRight,
  Waves,
  X,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
  Plane,
  Truck,
  Building2
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function LoginModal() {
  const {
    isLoginModalOpen,
    closeLoginModal,
    isAuthenticated,
    user,
    login,
    loginWithCredentials
  } = useRbac();

  const navigate = useNavigate();

  const [mode, setMode] = useState<'personas' | 'credentials'>('personas');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isLoginModalOpen && isAuthenticated) return null;

  const handleSelectPersona = (roleKey: UserRole) => {
    login(roleKey);
    const persona = PERSONAS[roleKey];
    if (persona) {
      navigate(persona.homeRoute);
    }
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = loginWithCredentials(username, password);
    if (res.success) {
      const activeRole = (username.toLowerCase() === 'worker' ? 'FIELD_WORKER' :
                          username.toLowerCase() === 'drone' ? 'DRONE_OPERATOR' :
                          username.toLowerCase() === 'zonal' ? 'ZONAL_OFFICER' : 'SUPER_ADMIN') as UserRole;
      navigate(PERSONAS[activeRole]?.homeRoute || '/');
    } else {
      setErrorMsg(res.message || 'Authentication failed');
    }
  };

  const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    SUPER_ADMIN: Shield,
    FIELD_WORKER: Truck,
    DRONE_OPERATOR: Plane,
    ZONAL_OFFICER: Building2
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#040a16] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-cyan-950 bg-gradient-to-r from-[#030814] via-[#051326] to-[#030814] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 p-0.5 shadow-md shadow-cyan-950/60 shrink-0">
              <div className="w-full h-full bg-[#030914] rounded-[10px] flex items-center justify-center">
                <Waves className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-wide font-heading">
                  JalRakshak RBAC Access Portal
                </h2>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  MUNICIPAL SSO
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Brihanmumbai Municipal Corporation (BMC) · Secure Role-Scoped Authentication
              </p>
            </div>
          </div>

          {isAuthenticated && (
            <button
              onClick={closeLoginModal}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-cyan-950/80 bg-[#020612] px-5 pt-3 gap-3">
          <button
            onClick={() => { setMode('personas'); setErrorMsg(null); }}
            className={cn(
              'pb-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2',
              mode === 'personas'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <UserCheck className="w-4 h-4" />
            1-Click Persona Login (Evaluator Profiles)
          </button>
          <button
            onClick={() => { setMode('credentials'); setErrorMsg(null); }}
            className={cn(
              'pb-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2',
              mode === 'credentials'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <KeyRound className="w-4 h-4" />
            BMC Officer Credentials Login
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[75vh] overflow-y-auto">
          {mode === 'personas' ? (
            <div className="space-y-4">
              <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3 text-xs text-slate-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p>
                  Select a municipal role below to immediately test the system with that persona’s strictly scoped authorization and navigation barriers.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(Object.keys(PERSONAS) as UserRole[]).map((rKey) => {
                  const p = PERSONAS[rKey];
                  const Icon = roleIcons[rKey] || Shield;
                  const isCurrent = isAuthenticated && user.id === p.id;

                  return (
                    <div
                      key={rKey}
                      className={cn(
                        'rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between relative group hover:border-cyan-400/80 hover:bg-[#071326]',
                        isCurrent
                          ? 'border-cyan-400 bg-cyan-950/30 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                          : 'border-cyan-900/40 bg-[#030914]'
                      )}
                    >
                      {isCurrent && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-black text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded-full border border-cyan-500/40">
                          <CheckCircle2 className="w-3 h-3" /> ACTIVE SESSION
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className={cn(
                            'w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0 shadow-md',
                            p.avatarBg
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className={cn('text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase border', p.badgeColor)}>
                              {p.badge}
                            </span>
                            <h3 className="font-bold text-slate-100 text-sm mt-0.5 leading-tight">
                              {p.name}
                            </h3>
                          </div>
                        </div>

                        <p className="text-[10.5px] text-cyan-400 font-mono font-medium">
                          {p.clearanceLevel}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>

                        {/* Allowed Modules Tags */}
                        <div className="mt-3 pt-2.5 border-t border-cyan-950">
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">
                            Authorized Modules ({p.allowedRoutes.length}):
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {p.allowedRoutes.map(route => {
                              const label = route === '/' ? 'Command' : route.replace('/', '').replace('-', ' ');
                              return (
                                <span
                                  key={route}
                                  className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80 text-cyan-300 border border-slate-800 uppercase"
                                >
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectPersona(rKey)}
                        className={cn(
                          'mt-4 w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md',
                          isCurrent
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                            : 'bg-slate-800 hover:bg-cyan-600 hover:text-slate-950 text-slate-200 border border-cyan-900/60'
                        )}
                      >
                        <span>{isCurrent ? 'Continue as ' + p.badge : 'Log In as ' + p.badge}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto py-2">
              <form onSubmit={handleCredentialSubmit} className="space-y-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center mx-auto mb-2 shadow-lg">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-white text-base">BMC Municipal Single Sign-On</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter your BMC municipal credentials to verify authorization
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Officer Username / Service ID
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin / worker / drone / zonal"
                    required
                    className="w-full bg-[#020614] border border-cyan-900/60 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Quick test users: <strong className="text-cyan-400">admin</strong> (Commissioner), <strong className="text-cyan-400">worker</strong> (Field Worker), <strong className="text-cyan-400">drone</strong> (Pilot), <strong className="text-cyan-400">zonal</strong> (Zonal Officer)
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (default: jalrakshak)"
                    required
                    className="w-full bg-[#020614] border border-cyan-900/60 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Default pass: <code className="text-cyan-400 font-mono">jalrakshak</code>
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-950/60"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Authenticate & Sign In
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-cyan-950 bg-[#030814] flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-mono text-cyan-400/80">Gov of Maharashtra · BMC Stormwater Division</span>
          <span>Role-Based Access Control (RBAC) Active</span>
        </div>
      </div>
    </div>
  );
}
