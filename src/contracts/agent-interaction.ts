import type { SkillResult,ResultStatus } from './skill-result';
export interface AgentInteraction {
  interactionId:string;
  kind:'conversation'|'skill'|'resource'|'workflow'|'collection'|'session';
  userInput:string;
  resourceRef?:{type:string;id:string;action?:string};
  attachments?:unknown[];
  viewContext?:unknown;
  history?:{role:'user'|'assistant';content:string}[];
}
export interface SkillRun {callId:string;skillId:string;skillName:string;args:Record<string,unknown>;result:SkillResult;}
export interface AguiResult {version:'1';runId:string;component:string;result:SkillResult;}
export interface AgentTurnResult {
  runId:string;
  interactionId:string;
  status:ResultStatus;
  replyText:string;
  agui:AguiResult[];
  skillRuns:SkillRun[];
  error?:{code:string;message:string};
}
