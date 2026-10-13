import type { AgentDomain } from './dataset';
import type { Principal } from './principal';
export type DeploymentTier = 'local' | 'demo' | 'pilot';
export interface ExecutionContext {
  frozenScopeExecution?:boolean;
  runId: string;
  domain: AgentDomain;
  deploymentTier: DeploymentTier;
  principal: Principal;
  signal?: AbortSignal;
  deadlineAt?:number;
  callId?:string;
  userInput?:string;
  approvedIntent?:import('./approved-intent').ApprovedIntent;
}
