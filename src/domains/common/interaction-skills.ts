import {workflowDataset} from '@/application/jobs/workflow-provenance';
import {assertResultSources} from '@/infrastructure/db/dataset-policy';
import {loadDatasetManifest} from '@/infrastructure/db/dataset-manifest';
import {authorizeHistoryView,publicHistoryBase} from '@/application/agent/history-authorization';
import {approveStructuredIntent} from '@/application/agent/structured-intent';
import {authorizeScope} from '@/infrastructure/auth/authorization';
import {readAuthorizedQuerySource} from '@/application/geo/query-source-store';
import { projectAguiView } from '@/contracts/agui-view';
import { randomUUID } from 'node:crypto';
import type { AgentDomain } from '@/contracts/dataset';
import type { ExecutionContext } from '@/contracts/execution-context';
import type { SkillDefinition,SkillExecution } from '@/contracts/skill-definition';
import { getAppBusinessProvider } from '@/lib/db/app-business-provider';
import { getDomainRepository } from '@/infrastructure/db/domain-repository';
import { getRecordedTurn,saveArtifact,withBusinessDb } from '@/infrastructure/db/business-store';
import { scopeFromArgs } from '@/domains/shared/skill-factory';
import { uiOperation } from '@/application/agent/ui-operation';
const str={type:'string',minLength:1,maxLength:200};
function sessionView(session:any,messages:any[]=[],ctx?:ExecutionContext){
 const roleChanged=!!ctx&&session.user_role!==ctx.principal.role;let denied=false;const view=(value:any)=>{if(!value)return null;if(roleChanged){denied=true;return publicHistoryBase(value);}try{return ctx?authorizeHistoryView(value,ctx):value;}catch{denied=true;return publicHistoryBase(value);}};const last=view(session.last_generative_view);const projected=messages.map(m=>{const snapshot=view(m.generative_view_snapshot);const hidden=m.sender==='agent'&&(roleChanged||denied);return {id:m.message_id,sender:m.sender,text:hidden?'历史业务结果当前无法授权，请在当前权限下重新执行。':m.text,timestamp:m.timestamp,skillUsed:m.skill_used,reasoningText:hidden?undefined:m.reasoning_text,reasoningDuration:hidden?undefined:m.reasoning_duration,generativeViewSnapshot:snapshot};});
 return {sessionId:session.session_id,userId:session.user_id,userName:session.user_name,userRole:session.user_role,messageCount:session.message_count,lastGenerativeViewType:last?.type??null,title:roleChanged?'历史会话（权限已变更）':session.title,isPinned:session.is_pinned===1,createdAt:session.created_at,updatedAt:session.updated_at,messages:projected,lastGenerativeView:last};
}
async function ownedSession(id:string,ctx:ExecutionContext){const session=await getAppBusinessProvider().getChatSessionById(id);if(session && (session.user_id!==ctx.principal.userId || (session.domain ?? 'vector')!==ctx.domain))throw new Error('Session owner/domain access denied');return session;}
async function sessionExecute(args:any,ctx:ExecutionContext):Promise<SkillExecution>{
 const provider=getAppBusinessProvider();const action=args.action;
 if(action==='append'){
  const recorded=getRecordedTurn(args.sourceRunId,ctx);
  if(uiOperation(recorded.interaction)||recorded.interaction.kind==='session')throw new Error('UI management is not a conversation turn');
  const explicitId=recorded.interaction.sessionRef?.id ?? (recorded.interaction.resourceRef?.type==='session'&&recorded.interaction.resourceRef.action==='conversation'?recorded.interaction.resourceRef.id:undefined);
  const sessionId=explicitId ?? recorded.result.session?.id ?? `sess_${args.sourceRunId}`;
  if(args.sessionId&&args.sessionId!==sessionId)throw new Error('Run does not belong to the target session');
  let session=await ownedSession(sessionId,ctx);
  if(!session&&explicitId)throw new Error('Target session no longer exists');
  if((!session||!session.message_count)&&['FAILED','CANCELLED'].includes(recorded.result.status))return {status:'NO_DATA',payload:null,datasets:[]};
  const snapshot=projectAguiView(recorded.result),timestamp=new Date().toISOString();
  const title=recorded.result.sessionTitle ?? '新研判会话';
  const messages=[{message_id:`${args.sourceRunId}-user`,session_id:sessionId,sender:'user' as const,text:recorded.interaction.userInput,timestamp},{message_id:`${args.sourceRunId}-assistant`,session_id:sessionId,sender:'agent' as const,text:recorded.result.replyText,reasoning_text:recorded.result.reasoningText,reasoning_duration:recorded.result.reasoningDuration,timestamp,skill_used:recorded.result.skillRuns.findLast(run=>run.skillId!=='skill_session_journal')?.skillName,generative_view_snapshot:snapshot}];
  if(!session){session=await provider.createChatSession({session_id:sessionId,user_id:ctx.principal.userId,user_name:ctx.principal.userId,user_role:ctx.principal.role,domain:ctx.domain,title,last_generative_view:snapshot,is_pinned:0,initialMessages:messages},{reuseExisting:true});}
  else{await provider.batchAppendChatMessages(sessionId,messages,snapshot,recorded.result.sessionTitle);session=(await ownedSession(sessionId,ctx))!;}
  return {status:'SUCCESS',payload:{type:'SESSION_RESULT',action,sessionId,persistedRunId:args.sourceRunId,title:session.title},datasets:[]};
 }
 if(action==='create'){const session=await provider.createChatSession({session_id:`sess_${randomUUID()}`,user_id:ctx.principal.userId,user_name:ctx.principal.userId,user_role:ctx.principal.role,domain:ctx.domain,title:args.title ?? '新研判会话',last_generative_view:null,is_pinned:0});return {status:'SUCCESS',payload:{type:'SESSION_RESULT',action,session:sessionView(session,[],ctx)},datasets:[]};}
 if(action==='list'){const sessions=await provider.getChatSessions({userId:ctx.principal.userId,domain:ctx.domain,keyword:args.keyword,limit:args.limit ?? 50,offset:args.offset ?? 0});const total=await provider.getChatSessionCount({userId:ctx.principal.userId,domain:ctx.domain,keyword:args.keyword});return {status:'SUCCESS',payload:{type:'SESSION_RESULT',action,sessions:sessions.map(s=>sessionView(s,[],ctx)),total},datasets:[]};}
 if(action==='clear'){await provider.clearUserChatSessions(ctx.principal.userId,ctx.domain);return {status:'SUCCESS',payload:{type:'SESSION_RESULT',action,cleared:true},datasets:[]};}
 const session=await ownedSession(args.sessionId,ctx);if(!session)return {status:'NO_DATA',payload:null,datasets:[]};
 if(action==='read')return {status:'SUCCESS',payload:{type:'SESSION_RESULT',action,session:sessionView(session,await provider.getChatMessages(args.sessionId),ctx)},datasets:[]};
 if(action==='delete'){await provider.deleteChatSession(args.sessionId);return {status:'SUCCESS',payload:{type:'SESSION_RESULT',action,sessionId:args.sessionId,deleted:true},datasets:[]};}
 if(action==='update'){if(args.title===undefined&&args.isPinned===undefined)throw new Error('No session metadata changes');await provider.updateChatSession(args.sessionId,{title:args.title,is_pinned:args.isPinned===undefined?undefined:args.isPinned?1:0});return {status:'SUCCESS',payload:{type:'SESSION_RESULT',action,session:sessionView(await ownedSession(args.sessionId,ctx),[],ctx)},datasets:[]};}
 throw new Error('Unknown session operation');
}
const samplingSchema={type:'object',additionalProperties:false,required:['city','district','category','speciesName','captureCount'],properties:{city:str,district:str,category:str,speciesName:str,captureCount:{type:'integer',minimum:0},weatherTemp:{type:'number',minimum:-80,maximum:70},weatherHumidity:{type:'number',minimum:0,maximum:100},latitude:{type:'number',minimum:-90,maximum:90},longitude:{type:'number',minimum:-180,maximum:180},street:str,habitatType:str,methodName:str}};
async function collectionExecute(args:any,ctx:ExecutionContext):Promise<SkillExecution>{
 if(args.action==='form')return {status:'SUCCESS',payload:{type:'COLLECTION_FORM',inputSchema:samplingSchema,defaults:{city:ctx.principal.jurisdiction.city,district:ctx.principal.jurisdiction.district}},datasets:[]};
 if(args.action==='submit')workflowDataset(ctx);
 const record=args.record;approveStructuredIntent(record,{...ctx,approvedIntent:undefined},'other');authorizeScope(record,ctx);
 const rules=[{id:'low-temperature-high-count',passed:!(record.weatherTemp!==undefined&&record.weatherTemp<10&&record.captureCount>30)},{id:'extreme-temperature-high-count',passed:!(record.weatherTemp!==undefined&&record.weatherTemp>42&&record.captureCount>60)},{id:'indoor-high-count',passed:!(record.habitatType==='高层办公室'&&record.speciesName.includes('白纹伊蚊')&&record.captureCount>50)}];
 const evaluation={rules,totalRulesCount:rules.length,passedRulesCount:rules.filter(r=>r.passed).length,warnings:rules.filter(r=>!r.passed).map(r=>r.id)};
 if(args.action==='validate'||evaluation.warnings.length)return {status:evaluation.warnings.length?'REVIEW_REQUIRED':'SUCCESS',payload:{type:'COLLECTION_RESULT',action:'validate',evaluation},datasets:[],qualityFlags:['heuristic-qc-rules-not-species-recognition']};
 const saved=await getAppBusinessProvider().submitMobileRecord({user_id:ctx.principal.userId,user_name:ctx.principal.userId,city:record.city,district:record.district,street:record.street,category:record.category,species_name:record.speciesName,capture_count:record.captureCount,weather_temp:record.weatherTemp,weather_humidity:record.weatherHumidity,latitude:record.latitude,longitude:record.longitude,habitat_type:record.habitatType,method_name:record.methodName});
 return {status:'SUCCESS',payload:{type:'COLLECTION_RESULT',action:'submit',record:saved,evaluation,syncToSpatialMap:false},datasets:[],qualityFlags:['awaiting-review','not-added-to-observed-dataset']};
}
async function catalogExecute(args:any,ctx:ExecutionContext):Promise<SkillExecution>{
 const provider=getAppBusinessProvider();
 if(args.action==='list'){const custom=await provider.getAllCustomSkills(ctx.domain);const {listSkillDefinitions}=await import('@/application/skills/skill-service');const standard=listSkillDefinitions(ctx.domain).map(({execute,...metadata})=>metadata);return {status:'SUCCESS',payload:{type:'SKILL_CATALOG',action:'list',standardSkills:standard,customSkills:custom.filter(s=>s.visibility==='public'||s.created_by===ctx.principal.userId)},datasets:[]};}
 const skill=await provider.getCustomSkillById(args.skillId);if(!skill)return {status:'NO_DATA',payload:null,datasets:[]};if(skill.domain!==ctx.domain||skill.created_by!==ctx.principal.userId)throw new Error('Custom skill owner/domain access denied');
 if(args.action==='delete'){await provider.deleteCustomSkill(args.skillId);return {status:'SUCCESS',payload:{type:'SKILL_CATALOG',action:'delete',skillId:args.skillId,deleted:true},datasets:[]};}
 if(args.sqlQuery)getDomainRepository(ctx.domain).query(args.sqlQuery,[],scopeFromArgs({},ctx));
 await provider.updateCustomSkill(args.skillId,{name:args.name,description:args.description,sql_query:args.sqlQuery,chart_type:args.chartType,visibility:args.visibility,recommended_prompts:Array.isArray(args.recommendedPrompts)?args.recommendedPrompts.join(';'):args.recommendedPrompts});
 return {status:'SUCCESS',payload:{type:'SKILL_CATALOG',action:'update',skill:await provider.getCustomSkillById(args.skillId)},datasets:[]};
}
async function artifactExecute(args:any,ctx:ExecutionContext):Promise<SkillExecution>{
 const sourceRequired=!!ctx.approvedIntent;
 let provenance:import('@/contracts/dataset').DatasetRef[]|undefined;let content:Buffer,source:any,fileName=args.fileName ?? '监测导出',mimeType:string;const original=args.sourceRunId&&args.sourceCallId?readAuthorizedQuerySource(args.sourceRunId,args.sourceCallId,ctx):undefined;const scope=scopeFromArgs(args,original?{...ctx,approvedIntent:original.approved}:ctx);
 if(args.format==='csv'){
  if(sourceRequired&&!original)throw new Error('QUERY_SOURCE_REQUIRED: 当前会话导出必须引用选中的实际查询结果');
  if(original&&original.payload.sql!==args.sql)throw new Error('QUERY_SOURCE_MISMATCH');
  const rows=original?original.payload.data:getDomainRepository(ctx.domain).query(args.sql,[],scope);if(original)provenance=original.datasets;if(!rows.length)return {status:'NO_DATA',payload:null};provenance??=loadDatasetManifest().filter(d=>d.domain===ctx.domain);assertResultSources(provenance,ctx.deploymentTier);const isMock=provenance.some(d=>d.origin==='mock');const columns=Object.keys(rows[0]);let originColumn='__cdc_data_origin';while(columns.includes(originColumn))originColumn+='_' ;if(isMock)columns.push(originColumn);
  const escape=(value:unknown)=>{let text=String(value ?? '');if(typeof value==='string'&&/^[=+\-@\t\r]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;};
  content=Buffer.from('\uFEFF'+[columns.map(escape).join(','),...rows.map((row:Record<string,unknown>)=>columns.map(c=>escape(isMock&&c===originColumn?'mock':row[c])).join(','))].join('\r\n'));source={sql:args.sql,scope:original?original.approved.effectiveDataScope:scope,rowCount:rows.length,...(original?{sourceRunId:args.sourceRunId,sourceCallId:args.sourceCallId,scopeFingerprint:original.approved.fingerprint}: {})};fileName+='.csv';mimeType='text/csv; charset=utf-8';
 }else{
  const report=withBusinessDb(db=>db.prepare('SELECT * FROM biz_generated_reports WHERE report_id=?').get(args.reportId)) as any;if(!report)return {status:'NO_DATA',payload:null};
  const metadata=JSON.parse(report.metadata_json ?? '{}');provenance=metadata.datasets ?? [];assertResultSources(provenance,ctx.deploymentTier);if(report.author!==ctx.principal.userId||metadata.domain!==ctx.domain)throw new Error('Report owner/domain access denied');if((scope.city&&report.city!==scope.city)||(scope.district&&report.district!==scope.district))throw new Error('Report geographic access denied');
  content=Buffer.from(`${(provenance??[]).some(d=>d.origin==='mock')?'> 模拟数据（Mock），仅供演示。\n\n':''}# ${report.title}\n\n${report.summary}\n\n${report.content_markdown}`);source={reportId:report.report_id,metadata};fileName+='.md';mimeType='text/markdown; charset=utf-8';
 }
 provenance??=loadDatasetManifest().filter(d=>d.domain===ctx.domain);assertResultSources(provenance,ctx.deploymentTier);source={...source,datasets:provenance,purpose:provenance.some(d=>d.origin==='mock')?'simulation':'source'};if(provenance.some(d=>d.origin==='mock'))fileName='模拟数据-'+fileName;
 return {status:'SUCCESS',payload:{type:'ARTIFACT_DOWNLOAD',...saveArtifact({fileName,mimeType,content,source,city:scope.city,district:scope.district},ctx)},...(provenance?{datasets:provenance}:{})};
}
export function interactionSkills(domain:AgentDomain):SkillDefinition[]{
 const make=(id:string,name:string,inputSchema:any,type:string,execute:SkillDefinition['execute'],operations:SkillDefinition['allowedOperations']):SkillDefinition=>({id,name,aliases:[],domain,description:name,requirementIds:[],availability:'available',method:id+'-v1',inputSchema,outputSchema:{type:'object',required:['type'],properties:{type:{enum:type.split('|')}}},allowedOperations:operations,execute});
 return [
  make('skill_session_manage','用户对话会话管理（不是领域监测数据查询）',{type:'object',additionalProperties:false,required:['action'],properties:{action:{enum:['create','list','read','update','delete','clear']},sessionId:str,title:str,isPinned:{type:'boolean'},keyword:{type:'string',maxLength:200},limit:{type:'integer',minimum:1,maximum:100},offset:{type:'integer',minimum:0}},allOf:[{if:{properties:{action:{enum:['read','update','delete']}}},then:{required:['sessionId']}}]},'SESSION_RESULT',sessionExecute,['read','write']),
  {...make('skill_session_journal','内部会话运行记录',{type:'object',additionalProperties:false,required:['sourceRunId'],properties:{sessionId:str,sourceRunId:str}},'SESSION_RESULT',(args,ctx)=>sessionExecute({...args,action:'append'},ctx),['write']),visibility:'internal' as const},
  make('skill_collection_manage','现场采集质控与提交（人工物种录入）',{type:'object',additionalProperties:false,required:['action'],properties:{action:{enum:['form','validate','submit']},record:samplingSchema},allOf:[{if:{properties:{action:{enum:['validate','submit']}}},then:{required:['record']}}]},'COLLECTION_RESULT|COLLECTION_FORM',collectionExecute,['read','write']),
  make('skill_catalog_manage','技能列表、编辑与删除',{type:'object',additionalProperties:false,required:['action'],properties:{action:{enum:['list','update','delete']},skillId:str,name:str,description:{type:'string',maxLength:2000},sqlQuery:{type:'string',maxLength:20000},chartType:{enum:['table','trend','bar','pie','map']},visibility:{enum:['public','private']},recommendedPrompts:{type:'array',items:str}},allOf:[{if:{properties:{action:{enum:['update','delete']}}},then:{required:['skillId']}}]},'SKILL_CATALOG',catalogExecute,['read','write']),
  make('skill_artifact_export','导出真实查询 CSV 或已归档报告 Markdown',{type:'object',additionalProperties:false,required:['format'],properties:{format:{enum:['csv','markdown']},sql:{type:'string',minLength:1,maxLength:20000},reportId:str,fileName:str,sourceRunId:str,sourceCallId:str,city:str,district:str,from:{type:'string'},to:{type:'string'}},allOf:[{if:{properties:{format:{const:'csv'}}},then:{required:['sql']}},{if:{properties:{format:{const:'markdown'}}},then:{required:['reportId']}}]},'ARTIFACT_DOWNLOAD',artifactExecute,['read','export'])
 ].filter(skill=>skill.id!=='skill_collection_manage' || domain==='vector');
}
