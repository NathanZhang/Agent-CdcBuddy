import type { AgentDomain } from './dataset';
import type { Principal } from './principal';
export type DeploymentTier = 'local' | 'demo' | 'pilot';
export interface ExecutionContext {
  runId: string;
  domain: AgentDomain;
  deploymentTier: DeploymentTier;
  principal: Principal;
  signal?: AbortSignal;
}
