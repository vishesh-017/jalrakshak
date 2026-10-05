import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole =
  | 'COMMISSIONER'    // Super Admin: City-wide Municipal Commissioner
  | 'ZONAL_MITHI'     // Zonal Officer: Zone 1 (Mithi River Basin & Mahim Bay)
  | 'ZONAL_MALAD'     // Zonal Officer: Zone 2 (Malad Creek & Versova)
  | 'ZONAL_TROMBAY'   // Zonal Officer: Zone 3 (Trombay & Thane Creek)
  | 'OPERATOR';       // Field Skimmer Boat Operator / Rapid Response Unit

export interface RoleConfig {
  id: UserRole;
  title: string;
  badge: string;
  department: string;
  zoneScope: string;
  allowedBasins: string[];
  canApproveDispatch: boolean;
  canConfigureSensors: boolean;
  canLogRecovery: boolean;
  canEmergencyFlush: boolean;
}

export const ROLES: Record<UserRole, RoleConfig> = {
  COMMISSIONER: {
    id: 'COMMISSIONER',
    title: 'Municipal Commissioner (Super Admin)',
    badge: 'SUPER ADMIN',
    department: 'BMC Stormwater & Disaster Management HQ',
    zoneScope: 'All Mumbai Basins (City-wide)',
    allowedBasins: ['Mithi River Basin', 'Malad Creek Basin', 'Trombay / Thane Creek Basin'],
    canApproveDispatch: true,
    canConfigureSensors: true,
    canLogRecovery: true,
    canEmergencyFlush: true,
  },
  ZONAL_MITHI: {
    id: 'ZONAL_MITHI',
    title: 'Zonal Officer — Zone 1 (Mithi River & Mahim)',
    badge: 'ZONE 1 CHIEF',
    department: 'Ward L & G/North Stormwater Drainage',
    zoneScope: 'Mithi River (MTH-01 to MTH-04)',
    allowedBasins: ['Mithi River Basin'],
    canApproveDispatch: true,
    canConfigureSensors: false,
    canLogRecovery: true,
    canEmergencyFlush: false,
  },
  ZONAL_MALAD: {
    id: 'ZONAL_MALAD',
    title: 'Zonal Officer — Zone 2 (Malad Creek & Versova)',
    badge: 'ZONE 2 CHIEF',
    department: 'Ward P/North & K/West Drainage Division',
    zoneScope: 'Malad Creek & Marve (MLD-01 to MLD-03)',
    allowedBasins: ['Malad Creek Basin'],
    canApproveDispatch: true,
    canConfigureSensors: false,
    canLogRecovery: true,
    canEmergencyFlush: false,
  },
  ZONAL_TROMBAY: {
    id: 'ZONAL_TROMBAY',
    title: 'Zonal Officer — Zone 3 (Trombay & Thane Creek)',
    badge: 'ZONE 3 CHIEF',
    department: 'Ward M/East Coastal Marine Division',
    zoneScope: 'Trombay Creek & Mahul (TRM-01 to TRM-03)',
    allowedBasins: ['Trombay / Thane Creek Basin'],
    canApproveDispatch: true,
    canConfigureSensors: false,
    canLogRecovery: true,
    canEmergencyFlush: false,
  },
  OPERATOR: {
    id: 'OPERATOR',
    title: 'Rapid Response Vessel Operator (Field Ops)',
    badge: 'SKIMMER UNIT',
    department: 'BMC Marine Trash Skimmer Fleet (Unit 1 & 2)',
    zoneScope: 'Dispatched Waypoint Task Operations',
    allowedBasins: ['Mithi River Basin', 'Malad Creek Basin', 'Trombay / Thane Creek Basin'],
    canApproveDispatch: false,
    canConfigureSensors: false,
    canLogRecovery: true,
    canEmergencyFlush: false,
  },
};

interface RbacContextType {
  role: UserRole;
  roleConfig: RoleConfig;
  setRole: (role: UserRole) => void;
  isSiteAllowed: (zone: string) => boolean;
}

const RbacContext = createContext<RbacContextType | null>(null);

export const RbacProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('jalrakshak_rbac_role') as UserRole) || 'COMMISSIONER';
  });

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('jalrakshak_rbac_role', newRole);
  };

  const roleConfig = ROLES[role] || ROLES.COMMISSIONER;

  const isSiteAllowed = (zone: string): boolean => {
    if (role === 'COMMISSIONER' || role === 'OPERATOR') return true;
    return roleConfig.allowedBasins.some(b => zone.toLowerCase().includes(b.split(' ')[0].toLowerCase()));
  };

  return (
    <RbacContext.Provider value={{ role, roleConfig, setRole, isSiteAllowed }}>
      {children}
    </RbacContext.Provider>
  );
};

export const useRbac = () => {
  const ctx = useContext(RbacContext);
  if (!ctx) throw new Error('useRbac must be used within RbacProvider');
  return ctx;
};
