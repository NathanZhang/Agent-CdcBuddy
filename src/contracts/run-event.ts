export interface RunEvent {
  version:'1';runId:string;seq:number;
  type:'started'|'tool_started'|'tool_completed'|'result'|'failed'|'completed';
  data:Record<string,any>;
}
