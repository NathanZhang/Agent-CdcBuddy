import type {SkillDefinition} from '@/contracts/skill-definition';
import {artifactRefSchema,type ArtifactRef} from '@/contracts/scientific-artifact';
import {sciencePlanSchema,scienceParameterSchemas,validateScienceParameters} from '@/contracts/scientific-dag';
import {AuthorizationError} from '@/infrastructure/auth/authorization';
import {compileSciencePlan} from '@/application/science/dag-compiler';
import {submitSciencePlan,scienceRunStatus,cancelScienceRun,resumeScienceRun} from '@/application/science/dag-service';
import {operationInputs,executeScienceOperation,type ScienceOperation} from '@/application/science/operations';
import {readScientificArtifact,artifactSummary} from '@/application/science/artifact-store';
const text={type:'string',minLength:1},date={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},windowSchema={type:'object',additionalProperties:false,required:['from','to'],properties:{from:date,to:date}};
export function scientificDagSkills():SkillDefinition[]{
 const make=(id:string,name:string,inputSchema:Record<string,any>,execute:SkillDefinition['execute'],allowedOperations:SkillDefinition['allowedOperations']=['read']):SkillDefinition=>({id,name,aliases:id==='skill_composable_workflow'?['skill_scientific_dag']:[],domain:'vector',requirementIds:[],description:name+(id==='skill_composable_workflow'?'；submit 返回 data.runId 即科学任务ID，提交成功后即可答复。read/cancel/resume 必须逐字使用工具返回的 data.runId，不能使用主Agent的分析runId、requestKey或猜测ID；科学任务不属于 skill_job_manage。':'')+'；持久科学工件按用户、组织、角色、数据版本及批准范围校验。LSTM 缺少已训练权重与合格真实来源回测时不可用。',availability:'available',method:id==='skill_composable_workflow'?'persistent-scientific-dag-v1':'artifact-scientific-kernels-v1',allowedOperations,inputSchema,outputSchema:{type:'object',required:['type','title','data'],properties:{type:{const:'ANALYTICS_RESULT'},title:text,data:{type:'object'}}},execute:async(args,ctx)=>{try{return await execute(args,ctx);}catch(error){if(error instanceof Error&&error.message.startsWith('FORBIDDEN_'))throw new AuthorizationError(error.message.split(':')[0],error.message);throw error;}}});
 const kernel=(operation:ScienceOperation,id:string,name:string)=>make(id,name,{type:'object',additionalProperties:false,required:['inputs','params'],properties:{inputs:{type:'object',additionalProperties:false,required:Object.keys(operationInputs[operation]),properties:Object.fromEntries(Object.keys(operationInputs[operation]).map(key=>[key,artifactRefSchema]))},params:scienceParameterSchemas[operation],window:windowSchema}},async(args,ctx)=>{
  validateScienceParameters(operation,args.params);const ref=Object.values(args.inputs)[0] as ArtifactRef;const source=readScientificArtifact(ref,ctx,{kind:ref.kind});const artifact=await executeScienceOperation(operation,args.inputs,args.params,args.window??source.timeWindow,ctx);
  return {status:artifact.qualityFlags.some(f=>['missing-feature-values','missing-periods-or-effort-not-imputed','partial-calendar-periods'].includes(f))?'INSUFFICIENT_DATA':'SUCCESS',payload:{type:'ANALYTICS_RESULT',title:name,data:artifactSummary(artifact)},datasets:artifact.ref.datasetRefs,qualityFlags:artifact.qualityFlags};
 });
 return [
  make('skill_composable_workflow','编译、提交和控制持久科学 DAG',{type:'object',additionalProperties:false,required:['action'],properties:{action:{enum:['compile','submit','read','cancel','resume']},plan:sciencePlanSchema,requestKey:{type:'string',minLength:1,maxLength:200},runId:text},allOf:[{if:{properties:{action:{enum:['compile','submit']}}},then:{required:['plan']}},{if:{properties:{action:{const:'submit'}}},then:{required:['requestKey']}},{if:{properties:{action:{enum:['read','cancel','resume']}}},then:{required:['runId']}}]},async(args,ctx)=>{
   const data=args.action==='compile'?{plan:compileSciencePlan(args.plan,ctx)}:args.action==='submit'?submitSciencePlan(args.plan,args.requestKey,ctx):args.action==='read'?scienceRunStatus(args.runId,ctx):args.action==='cancel'?cancelScienceRun(args.runId,ctx):resumeScienceRun(args.runId,ctx);
   return {status:'SUCCESS',payload:{type:'ANALYTICS_RESULT',title:'持久科学 DAG',data}};
  },['read','write']),
  kernel('scan','skill_scientific_scan','按测量工件执行近似圆形条件泊松扫描'),
  kernel('scan-select','skill_scan_member_select','从扫描工件固定成员选择'),
  kernel('kmeans','skill_scientific_kmeans','按特征矩阵执行探索性 K-Means'),
  kernel('cluster-select','skill_cluster_member_select','从聚类工件固定成员选择')
 ];
}
