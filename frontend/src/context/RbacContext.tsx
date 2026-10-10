import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'FIELD_WORKER'
  | 'INSPECTOR'
  | 'DRONE_OPERATOR'
  | 'ZONAL_OFFICER'
  // Legacy aliases
  | 'COMMISSIONER'
  | 'ZONAL_MITHI'
  | 'ZONAL_MALAD'
  | 'ZONAL_TROMBAY'
  | 'OPERATOR';

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  title: string;
  badge: string;
  badgeColor: string;
  clearanceLevel: string;
  department: string;
  zoneScope: string;
  allowedBasins: string[];
  allowedRoutes: string[];
  homeRoute: string;
  avatarBg: string;
  canApproveDispatch: boolean;
  canConfigureSensors: boolean;
  canLogRecovery: boolean;
  canEmergencyFlush: boolean;
  canSubmitFieldReport: boolean;
  canPilotDrone: boolean;
  description: string;
}

export type RoleConfig = UserProfile;

export const PERSONAS: Record<string, UserProfile> = {
  SUPER_ADMIN: {
    id: 'SUPER_ADMIN',
    name: 'Rahul Sharma',
    username: 'admin',
    role: 'SUPER_ADMIN',
    title: 'Municipal Commissioner & Disaster HQ',
    badge: 'SUPER ADMIN',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    clearanceLevel: 'LEVEL 4 — FULL ACCESS',
    department: 'BMC Stormwater & Disaster Command HQ',
    zoneScope: 'All Mumbai Basins (City-wide Command)',
    allowedBasins: ['Mithi River Basin', 'Malad Creek Basin', 'Trombay / Thane Creek Basin'],
    allowedRoutes: [
      '/overview',
      '/map',
      '/drone',
      '/worker',
      '/satellite',
      '/iot-management',
      '/forecast',
      '/cleanup',
      '/analytics',
      '/simulator',
      '/monsoon'
    ],
    homeRoute: '/overview',
    avatarBg: 'from-emerald-600 to-teal-800',
    canApproveDispatch: true,
    canConfigureSensors: true,
    canLogRecovery: true,
    canEmergencyFlush: true,
    canSubmitFieldReport: true,
    canPilotDrone: true,
    description: 'Unrestricted administrative authority across all 10 outfall stations, AI models, GIS dispatch, and executive analytics.'
  },
  FIELD_WORKER: {
    id: 'FIELD_WORKER',
    name: 'Ramesh Pawar (Badge #BMC-SW-408)',
    username: 'worker',
    role: 'FIELD_WORKER',
    title: 'Sanitation Field Lead / Inspector',
    badge: 'FIELD WORKER',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    clearanceLevel: 'LEVEL 1 — GROUND OPS ONLY',
    department: 'Ward L (Kurla / Dharavi) Ground Sanitation Division',
    zoneScope: 'Ground Drainage Culverts & Silt Screens',
    allowedBasins: ['Mithi River Basin'],
    allowedRoutes: ['/worker', '/cleanup'],
    homeRoute: '/worker',
    avatarBg: 'from-amber-600 to-orange-800',
    canApproveDispatch: false,
    canConfigureSensors: false,
    canLogRecovery: true,
    canEmergencyFlush: false,
    canSubmitFieldReport: true,
    canPilotDrone: false,
    description: 'Strictly authorized for Field Inspection reporting with photo evidence, GPS geotagging, and updating assigned cleanup task progress.'
  },
  INSPECTOR: {
    id: 'INSPECTOR',
    name: 'Suresh Patil (Monsoon Inspector)',
    username: 'inspector',
    role: 'INSPECTOR',
    title: 'Senior Drainage Inspector',
    badge: 'INSPECTOR',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    clearanceLevel: 'LEVEL 1 — GROUND OPS ONLY',
    department: 'Monsoon Blockage Rapid Verification',
    zoneScope: 'All Mumbai Basins (City-wide Command)',
    allowedBasins: ['Mithi River Basin', 'Malad Creek Basin', 'Trombay / Thane Creek Basin'],
    allowedRoutes: ['/monsoon', '/worker'],
    homeRoute: '/monsoon',
    avatarBg: 'from-indigo-600 to-purple-800',
    canApproveDispatch: false,
    canConfigureSensors: false,
    canLogRecovery: true,
    canEmergencyFlush: false,
    canSubmitFieldReport: true,
    canPilotDrone: false,
    description: 'Specialized field inspector tasked with verifying suspected monsoon drainage blockages.'
  },
  DRONE_OPERATOR: {
    id: 'DRONE_OPERATOR',
    name: 'Vikram Shinde (DGCA Pilot #DRN-9021)',
    username: 'drone',
    role: 'DRONE_OPERATOR',
    title: 'Aerial Drone Reconnaissance Pilot',
    badge: 'DRONE PILOT',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    clearanceLevel: 'LEVEL 2 — AERIAL RECON',
    department: 'BMC Rapid Aerial Reconnaissance Wing',
    zoneScope: 'Mithi River & Malad Creek Flight Corridors',
    allowedBasins: ['Mithi River Basin', 'Malad Creek Basin'],
    allowedRoutes: ['/drone', '/map'],
    homeRoute: '/drone',
    avatarBg: 'from-amber-500 to-yellow-700',
    canApproveDispatch: false,
    canConfigureSensors: false,
    canLogRecovery: false,
    canEmergencyFlush: false,
    canSubmitFieldReport: false,
    canPilotDrone: true,
    description: 'Authorized for DJI drone video uploads, ReWater ML inference, plastic hotspot clustering, optical AI scans, and GIS coordinates.'
  },
  ZONAL_OFFICER: {
    id: 'ZONAL_OFFICER',
    name: 'Ajay Patne (Ward Officer, Zone 1)',
    username: 'zonal',
    role: 'ZONAL_OFFICER',
    title: 'Zonal Assistant Commissioner — Zone 1',
    badge: 'ZONAL OFFICER',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    clearanceLevel: 'LEVEL 3 — ZONAL COMMAND',
    department: 'Ward L & G/North Stormwater Drainage Division',
    zoneScope: 'Mithi River Basin & Mahim Bay Outfall',
    allowedBasins: ['Mithi River Basin'],
    allowedRoutes: ['/map', '/cleanup', '/worker', '/forecast', '/iot-management', '/monsoon', '/'],
    homeRoute: '/map',
    avatarBg: 'from-cyan-600 to-blue-800',
    canApproveDispatch: true,
    canConfigureSensors: false,
    canLogRecovery: true,
    canEmergencyFlush: false,
    canSubmitFieldReport: true,
    canPilotDrone: false,
    description: 'Authorized to inspect Hotspot GIS clusters, dispatch skimmer boats and heavy machinery, review citizen reports, and monitor IoT stations.'
  }
};

// Map legacy role strings to primary personas
function normalizeRole(r: string): UserRole {
  if (r === 'COMMISSIONER') return 'SUPER_ADMIN';
  if (r === 'OPERATOR') return 'FIELD_WORKER';
  if (r === 'ZONAL_MITHI' || r === 'ZONAL_MALAD' || r === 'ZONAL_TROMBAY') return 'ZONAL_OFFICER';
  if (PERSONAS[r]) return r as UserRole;
  return 'SUPER_ADMIN';
}

export const ROLES: Record<string, UserProfile> = {
  ...PERSONAS,
  // Alias mapping for compatibility
  COMMISSIONER: PERSONAS.SUPER_ADMIN,
  OPERATOR: PERSONAS.FIELD_WORKER,
  ZONAL_MITHI: PERSONAS.ZONAL_OFFICER,
  ZONAL_MALAD: PERSONAS.ZONAL_OFFICER,
  ZONAL_TROMBAY: PERSONAS.ZONAL_OFFICER
};

interface RbacContextType {
  role: UserRole;
  roleConfig: RoleConfig;
  user: UserProfile;
  isAuthenticated: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: (targetRole: UserRole) => void;
  loginWithCredentials: (username: string, pass: string) => { success: boolean; message?: string };
  logout: () => void;
  setRole: (role: UserRole) => void;
  isRouteAllowed: (path: string) => boolean;
  isSiteAllowed: (zone: string) => boolean;
}

const RbacContext = createContext<RbacContextType | null>(null);

export const RbacProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('jalrakshak_rbac_role') || 'SUPER_ADMIN';
    return normalizeRole(saved);
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedAuth = localStorage.getItem('jalrakshak_authenticated');
    return savedAuth !== 'false'; // default to authenticated
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  const activePersona = PERSONAS[normalizeRole(role)] || PERSONAS.SUPER_ADMIN;

  const login = (newRole: UserRole) => {
    const normalized = normalizeRole(newRole);
    setRoleState(normalized);
    setIsAuthenticated(true);
    localStorage.setItem('jalrakshak_rbac_role', normalized);
    localStorage.setItem('jalrakshak_authenticated', 'true');
    setIsLoginModalOpen(false);
  };

  const loginWithCredentials = (uname: string, pass: string): { success: boolean; message?: string } => {
    const cleanUname = uname.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (cleanPass !== 'jalrakshak' && cleanPass !== 'admin123' && cleanPass !== '123456') {
      return { success: false, message: 'Invalid password. (Use default password: jalrakshak)' };
    }

    let foundRole: UserRole | null = null;
    if (cleanUname === 'admin' || cleanUname === 'commissioner') foundRole = 'SUPER_ADMIN';
    else if (cleanUname === 'worker' || cleanUname === 'field') foundRole = 'FIELD_WORKER';
    else if (cleanUname === 'drone' || cleanUname === 'pilot') foundRole = 'DRONE_OPERATOR';
    else if (cleanUname === 'zonal' || cleanUname === 'officer') foundRole = 'ZONAL_OFFICER';

    if (foundRole) {
      login(foundRole);
      return { success: true };
    }
    return { success: false, message: 'Username not found. Try admin, worker, drone, or zonal.' };
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.setItem('jalrakshak_authenticated', 'false');
    setIsLoginModalOpen(true);
  };

  const setRole = (newRole: UserRole) => {
    login(newRole);
  };

  const isRouteAllowed = (path: string): boolean => {
    if (!isAuthenticated) return false;
    if (role === 'SUPER_ADMIN') return true;
    const cleanPath = path === '/' ? '/' : path.split('?')[0].replace(/\/+$/, '');
    return activePersona.allowedRoutes.some(r => r === cleanPath || (r !== '/' && cleanPath.startsWith(r)));
  };

  const isSiteAllowed = (zone: string): boolean => {
    if (role === 'SUPER_ADMIN' || role === 'FIELD_WORKER') return true;
    return activePersona.allowedBasins.some(b => zone.toLowerCase().includes(b.split(' ')[0].toLowerCase()));
  };

  return (
    <RbacContext.Provider
      value={{
        role,
        roleConfig: activePersona,
        user: activePersona,
        isAuthenticated,
        isLoginModalOpen,
        openLoginModal: () => setIsLoginModalOpen(true),
        closeLoginModal: () => setIsLoginModalOpen(false),
        login,
        loginWithCredentials,
        logout,
        setRole,
        isRouteAllowed,
        isSiteAllowed
      }}
    >
      {children}
    </RbacContext.Provider>
  );
};

export const useRbac = () => {
  const ctx = useContext(RbacContext);
  if (!ctx) throw new Error('useRbac must be used within RbacProvider');
  return ctx;
};
