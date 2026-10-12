import type { AgentDomain } from './dataset';
export type UserRole = 'PROVINCIAL_ADMIN' | 'CITY_EXPERT' | 'DISTRICT_SURVEILLANCE' | 'PUBLIC_VIEWER';
export interface Principal {
  userId: string;
  role: UserRole;
  organizationId: string;
  domainGrants: AgentDomain[];
  jurisdiction: { city?: string; district?: string };
  mode: 'dev' | 'authenticated';
}
