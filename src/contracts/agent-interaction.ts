import type { SkillResult,ResultStatus } from './skill-result';
export interface AgentInteraction {
  interactionId:string;
  kind:'conversation'|'skill'|'resource'|'workflow'|'collection'|'session';
  userInput:string;
  resourceRef?:{type:string;id:string;action?:string};
  sessionRef?:{id:string};
  attachments?:unknown[];
  viewContext?:unknown;
  history?:{role:'user'|'assistant';content:string}[];
}
export interface SkillRun {reusedFrom?:string;callId:string;skillId:string;skillName:string;args:Record<string,unknown>;result:SkillResult;}
export interface AguiResult {version:'1';runId:string;component:string;result:SkillResult;}
export interface AgentTurnResult {
  runId:string;
  interactionId:string;
  status:ResultStatus;
  replyText:string;
  reasoningText?:string;
  reasoningDuration?:number;
  sessionTitle?:string;
  session?:{id:string;title:string};
  agui:AguiResult[];
  skillRuns:SkillRun[];
  mapComposition?:import('./map-composition').MapComposition;
  outcomes?:import('@/application/agent/output-outcomes').OutputOutcome[];
  intentSummary?:Record<string,unknown>;
  intentDiagnostics?:import('./interaction-intent').IntentDiagnostic[];
  answerDiagnostics?:{code:string;message:string}[];
  error?:{code:string;message:string};
}
