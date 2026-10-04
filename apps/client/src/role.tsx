import React, { createContext, useContext, useState } from 'react';
import { api } from './api';

export type RoleName = 'owner' | 'guardian' | 'beneficiary';
const KEY = 'heirloom.role';

interface RoleCtx {
  role: RoleName;
  setRole: (r: RoleName) => void;
}

const Ctx = createContext<RoleCtx>({ role: 'owner', setRole: () => {} });

function load(): RoleName {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'owner' || v === 'guardian' || v === 'beneficiary') return v;
  } catch {
    /* storage unavailable */
  }
  return 'owner';
}

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<RoleName>(() => {
    const r = load();
    api.setRole(r);
    return r;
  });
  const setRole = (r: RoleName) => {
    api.setRole(r);
    setRoleState(r);
    try {
      localStorage.setItem(KEY, r);
    } catch {
      /* storage unavailable */
    }
  };
  return <Ctx.Provider value={{ role, setRole }}>{children}</Ctx.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useRole = () => useContext(Ctx);

// eslint-disable-next-line react-refresh/only-export-components
export const ROLE_HOME: Record<RoleName, string> = { owner: '/', guardian: '/g', beneficiary: '/b' };
