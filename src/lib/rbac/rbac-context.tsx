'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
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
  const currentUser = PRESET_ROLES[activeRole];

  const switchRole = (role: UserRole) => {
    setActiveRole(role);
  };

  const canAccessSkill = (skillId: string): boolean => {
    if (currentUser.allowedSkillIds.includes('*')) return true;
    return currentUser.allowedSkillIds.includes(skillId);
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
      {children}
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
