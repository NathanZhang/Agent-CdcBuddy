import type { AgentDomain, DatasetRef } from './dataset';
import type { ExecutionContext } from './execution-context';
import type { ResultStatus, MetricEvidence } from './skill-result';
export type JsonSchema = Record<string,any>;
export interface SkillExecution {
  status: ResultStatus;
  payload: unknown | null;
  datasets?: DatasetRef[];
  metrics?: Record<string,MetricEvidence>;
  qualityFlags?: string[];
  error?: {code:string;message:string;retryable:boolean};
}
export interface SkillDefinition {
  id: string;
  aliases: string[];
  domain: AgentDomain;
  name: string;
  description?: string;
  requirementIds: number[];
  visibility?: 'public' | 'internal';
  availability: 'available' | 'planned';
  implementationStatus?: import('./skill-capability').ImplementationStatus;
  validationStatus?: import('./skill-capability').ValidationStatus;
  validationEvidence?: string[];
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  method: string;
  allowedOperations: ('read' | 'write' | 'review' | 'export')[];
  execute(args: Record<string,any>, ctx: ExecutionContext): Promise<SkillExecution>;
}
