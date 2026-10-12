import { afterEach,it,expect,vi } from 'vitest';
import { getRuntimeProfile,getServerDomain } from '@/application/config/runtime-profile';
import { getCurrentAgentDomain } from '@/lib/config/agent-profile';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('server domain is explicit and independent of port or client public build values',()=>{
  vi.stubEnv('AGENT_DOMAIN','env');vi.stubEnv('PORT','9447');vi.stubEnv('NEXT_PUBLIC_AGENT_DOMAIN','vector');
  expect(getServerDomain()).toBe('env');
  const profile=getRuntimeProfile('env');
  expect(profile.domain).toBe('env');expect(profile.datasets[0].origin).toBe('mock');
  expect(JSON.stringify(profile)).not.toContain('env_monitoring.db');
});
it('client domain uses the server-injected profile on any external port',()=>{
  vi.stubEnv('NEXT_PUBLIC_AGENT_DOMAIN','vector');
  vi.stubGlobal('window',{__CDC_RUNTIME_PROFILE__:{domain:'foodborne'},location:{port:'19999',pathname:'/env'}});
  expect(getCurrentAgentDomain()).toBe('foodborne');
});
it('invalid configured domain fails instead of silently becoming vector',()=>{
  vi.stubEnv('AGENT_DOMAIN','unrecognized');expect(()=>getServerDomain()).toThrow();
});
