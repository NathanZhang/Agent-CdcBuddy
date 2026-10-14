'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {setCsrfToken,authHeaders} from '@/infrastructure/auth/client';
import type {Principal} from '@/contracts/principal';
import {authorizeSkill} from '@/infrastructure/auth/authorization';
import { UserRole, UserProfile, PRESET_ROLES } from './types';

interface RbacContextType {
  currentUser: UserProfile;
  activeRole: UserRole;
  switchRole: (role: UserRole) => void;
  canAccessSkill: (skillId: string) => boolean;
  filterByJurisdiction: <T extends { city?: string; district?: string }>(items: T[]) => T[];
}

const RbacContext = createContext<RbacContextType | undefined>(undefined);

export const RbacProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<UserRole>('PROVINCIAL_ADMIN');
  const [principal,setPrincipal]=useState<Principal|null>(null);const [requiresLogin,setRequiresLogin]=useState(false);const [username,setUsername]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');
  useEffect(()=>{void fetch('/api/auth/me',{cache:'no-store'}).then(async r=>{if(!r.ok){setRequiresLogin(true);return;}const b=await r.json();setPrincipal(b.principal);setCsrfToken(b.csrfToken);if(b.principal?.role)setActiveRole(b.principal.role);}).catch(()=>setRequiresLogin(true));},[]);
  const currentUser=principal?.mode==='authenticated'?{...PRESET_ROLES[principal.role],id:principal.userId,name:principal.userId,department:principal.organizationId,jurisdictionCity:principal.jurisdiction.city,jurisdictionDistrict:principal.jurisdiction.district}:PRESET_ROLES[activeRole];
  async function signIn(){setError('');try{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const b=await r.json();if(!r.ok)throw new Error(b.error);setPrincipal(b.principal);setActiveRole(b.principal.role);setCsrfToken(b.csrfToken);setRequiresLogin(false);setPassword('');}catch(e){setError(e instanceof Error?e.message:'登录失败');}}


  const switchRole = (role: UserRole) => {
    if(principal?.mode==='authenticated'||requiresLogin)return;
    setActiveRole(role);
  };

  const canAccessSkill = (skillId: string): boolean => {
    if(typeof window==='undefined')return false;
    const profile=(window as any).__CDC_RUNTIME_PROFILE__;
    const skill=profile?.capabilities?.find((s:any)=>s.id===skillId);
    if(!skill)return false;
    const identity:Principal=principal??{userId:currentUser.id,organizationId:currentUser.department,role:currentUser.role,domainGrants:[profile.domain],jurisdiction:{city:currentUser.jurisdictionCity,district:currentUser.jurisdictionDistrict},mode:'dev'};
    try{authorizeSkill(skill,{action:'list'},{runId:'ui-eligibility',domain:profile.domain,deploymentTier:'local',principal:identity});return true;}catch{return false;}
  };

  const filterByJurisdiction = <T extends { city?: string; district?: string }>(items: T[]): T[] => {
    if (currentUser.role === 'PROVINCIAL_ADMIN' || currentUser.role === 'PUBLIC_VIEWER') {
      return items;
    }
    if (currentUser.role === 'CITY_EXPERT' && currentUser.jurisdictionCity) {
      return items.filter(i => !i.city || i.city === currentUser.jurisdictionCity);
    }
    if (currentUser.role === 'DISTRICT_SURVEILLANCE') {
      return items.filter(i => {
        const matchCity = !currentUser.jurisdictionCity || !i.city || i.city === currentUser.jurisdictionCity;
        const matchDistrict = !currentUser.jurisdictionDistrict || !i.district || i.district === currentUser.jurisdictionDistrict;
        return matchCity && matchDistrict;
      });
    }
    return items;
  };

  return (
    <RbacContext.Provider value={{
      currentUser,
      activeRole,
      switchRole,
      canAccessSkill,
      filterByJurisdiction
    }}>
      {requiresLogin?<div className="max-w-md mx-auto mt-24 p-6 border rounded-xl space-y-4"><h1>使用服务端账户登录</h1><input aria-label="用户名" value={username} onChange={e=>setUsername(e.target.value)} className="w-full border p-2"/><input aria-label="密码" type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border p-2"/><button onClick={()=>void signIn()}>登录</button><p role="alert">{error}</p></div>:<>{principal?.mode==='authenticated'&&<button className="fixed top-2 right-2 z-50 text-xs" onClick={()=>{void authHeaders().then(headers=>fetch('/api/auth/logout',{method:'POST',headers})).then(r=>{if(r.ok){setCsrfToken(null);setPrincipal(null);setRequiresLogin(true);}});}}>退出登录</button>}{children}</>}
    </RbacContext.Provider>
  );
};

export function useRbac(): RbacContextType {
  const context = useContext(RbacContext);
  if (!context) {
    throw new Error('useRbac must be used within an RbacProvider');
  }
  return context;
}
