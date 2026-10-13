import type { AgentInteraction } from '@/contracts/agent-interaction';
import type { AgentDomain } from '@/contracts/dataset';
export class IntentError extends Error {constructor(public code:string,message:string){super(message);}}
/** Functional controls name an operation explicitly. The LLM cannot widen that intent or alter source measurements. */
export function bindOperationInput(interaction:AgentInteraction,name:string,args:Record<string,any>,domain:AgentDomain,canonical:(id:string)=>string):Record<string,any>{
 const ref=interaction.resourceRef;if(!ref || ref.action==='conversation')return args;
 const input=(interaction.attachments ?? []).find((attachment:any)=>attachment?.type==='operation-input') as any;
 const supplied=input?.args ?? {};
 if(!supplied || Array.isArray(supplied)||typeof supplied!=='object')throw new IntentError('INVALID_OPERATION_INPUT','Invalid operation input');
 let expected:string[]=[];let action:string|undefined;
 if(ref.type==='session'){expected=['skill_session_manage'];action=ref.action==='rename'?'update':ref.action;}
 else if(ref.type==='catalog'){expected=['skill_catalog_manage'];action=ref.action;}
 else if(ref.type==='skill'){if(ref.action==='execute')expected=[canonical(ref.id)];else{expected=['skill_catalog_manage'];action=ref.action;}}
 else if(ref.type==='collection'){if(['form','validate','submit'].includes(ref.action ?? '')){expected=['skill_collection_manage'];action=ref.action;}else throw new IntentError('CAPABILITY_UNAVAILABLE','该采集能力尚未实现，不能返回模拟识别结果');}
 else if(ref.type==='report'){expected=ref.action==='export'?['skill_artifact_export']:['skill_auto_report_gen','skill_foodborne_report_export','skill_chronic_death_report'];}
 else if(ref.type==='map'){expected=ref.action==='display'?['skill_map_display']:[{vector:'skill_monitoring_data_table',foodborne:'skill_foodborne_case_table',env:'skill_env_monitoring_table',chronic:'skill_chronic_monitoring_table'}[domain],'skill_spatial_early_warning'];}
 else if(ref.type==='approval'){expected=['skill_approval_decision'];}
 else if(ref.type==='workflow'){expected=['skill_job_manage','skill_retest_submit','skill_inbox_read','skill_daemon_surveillance','skill_disposal_workflow','skill_env_early_warning_disposal','skill_chronic_early_warning_disposal'];}
 if(expected.length && !expected.includes(canonical(name)))throw new IntentError('OPERATION_INTENT_MISMATCH','模型选择的技能与请求操作不一致');
 if(action && args.action!==undefined && args.action!==action)throw new IntentError('OPERATION_INTENT_MISMATCH','模型不能更改请求操作');
 const bound={...args,...supplied,...(action?{action}:{})};
 if(ref.type==='session'&&!['create','list','clear'].includes(action ?? ''))bound.sessionId=ref.id;
 if(ref.type==='skill'&&ref.action!=='execute')bound.skillId=ref.id;
 if(ref.type==='collection'&&ref.action!=='form'){if(!supplied.record)throw new IntentError('INVALID_OPERATION_INPUT','采集记录缺少原始输入');bound.record=supplied.record;}
 if(ref.type==='report'&&ref.action==='export'&&!supplied.sql){bound.reportId=ref.id;bound.format=supplied.format ?? 'markdown';}
 if(ref.type==='approval')bound.jobId=ref.id;
 if(ref.type==='workflow'&&['read','list'].includes(ref.action ?? '')){bound.action=ref.action;if(ref.action==='read')bound.jobId=supplied.jobId ?? ref.id;}
 return bound;
}
