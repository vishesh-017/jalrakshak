import { useNavigate } from 'react-router-dom';
import { useRbac } from '../context/RbacContext';
import { Button } from '../components/ui/Button';
import { Waves, Shield, Activity, Droplets, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const { openLoginModal, user } = useRbac();

  const handleLoginClick = () => {
    // If we're somehow using the app and just landed here, 
    // we can either open modal or jump straight if they want.
    // For the demo, let's open the login modal to show off the persona switcher.
    openLoginModal();
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-900/20 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[120px]"></div>
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        
        {/* Logo & Branding */}
        <div className="flex items-center gap-3 mb-8 animate-[fade-in-down_1s_ease-out]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/50">
            <Waves className="w-8 h-8 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 font-heading">
              JalRakshak
            </h1>
            <span className="text-cyan-400 font-bold tracking-widest text-sm uppercase mt-1">
              Autonomous Marine Defense
            </span>
          </div>
        </div>

        {/* Hero Text */}
        <div className="text-center max-w-2xl mb-12 space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-200 leading-tight">
            Mumbai Creek Surveillance & Choke Prevention System
          </h2>
          <p className="text-slate-400 text-sm md:text-base">
            Aggregating Satellite FDI anomaly detection, Drone-based YOLOv8 reconnaissance, and real-time IoT sonar telemetry to proactively identify and clear plastic choke-points before catastrophic flooding occurs.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-14">
          <div className="bg-[#050e1b]/80 border border-cyan-900/40 p-5 rounded-2xl backdrop-blur-sm">
            <Activity className="w-6 h-6 text-cyan-400 mb-3" />
            <h3 className="font-bold text-white text-sm mb-1">Real-time Telemetry</h3>
            <p className="text-xs text-slate-400">Heartbeat monitoring across 10 strategic outfall stations via ESP32 sonar and radar networks.</p>
          </div>
          <div className="bg-[#050e1b]/80 border border-emerald-900/40 p-5 rounded-2xl backdrop-blur-sm">
            <Shield className="w-6 h-6 text-emerald-400 mb-3" />
            <h3 className="font-bold text-white text-sm mb-1">Predictive AI</h3>
            <p className="text-xs text-slate-400">Hydrodynamic physical risk estimates blending tidal surge data with 7-day monsoon flush records.</p>
          </div>
          <div className="bg-[#050e1b]/80 border border-blue-900/40 p-5 rounded-2xl backdrop-blur-sm">
            <Droplets className="w-6 h-6 text-blue-400 mb-3" />
            <h3 className="font-bold text-white text-sm mb-1">EPR Auditing</h3>
            <p className="text-xs text-slate-400">Blockchain-verified plastic recovery ledgers bridging civic sanitation with corporate accountability.</p>
          </div>
        </div>

        {/* Login CTA */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleLoginClick}
            className="group relative px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full overflow-hidden transition-all shadow-[0_0_40px_-10px_rgba(6,182,212,0.5)] hover:shadow-[0_0_60px_-10px_rgba(6,182,212,0.7)] flex items-center gap-3 cursor-pointer"
          >
            <span className="relative z-10 flex items-center gap-2 text-lg">
              Login to Command Center <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-in-out"></div>
          </button>
          
          <p className="mt-6 text-[10px] text-slate-500 max-w-md text-center">
            Authorized personnel only. Access is protected by role-based clearance (RBAC). 
            Unauthorized access to BMC internal telemetry is strictly prohibited.
          </p>
        </div>

      </div>
    </div>
  );
}
