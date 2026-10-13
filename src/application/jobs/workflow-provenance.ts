import type {DatasetRef} from '@/contracts/dataset';
import type {ExecutionContext} from '@/contracts/execution-context';
import type {AgentTurnResult} from '@/contracts/agent-interaction';
import {resolveDatasetLocation} from '@/infrastructure/db/dataset-manifest';
import {assertDatasetReadable,assertResultSources,DatasetPolicyError,formalRuntime} from '@/infrastructure/db/dataset-policy';
export function turnDatasetRefs(turn:AgentTurnResult):DatasetRef[]{return [...(turn.skillRuns??[]).flatMap(s=>s.result.datasets??[]),...(turn.agui??[]).flatMap(a=>a.result.datasets??[])];}
export function workflowDataset(ctx:ExecutionContext):DatasetRef {
  const location=resolveDatasetLocation(ctx.domain);assertDatasetReadable(location,ctx.deploymentTier);
  const {path:_path,...ref}=location;assertResultSources([ref],ctx.deploymentTier,true);return ref;
}
export function assertJobEvidence(job:any,ctx:ExecutionContext,requireResult=false):void {
  const source=workflowDataset(ctx),stored=JSON.parse(job.input_json??'{}').sourceDataset;
  assertResultSources(stored?[stored]:[],ctx.deploymentTier,true);
  if(JSON.stringify(source)!==JSON.stringify(stored))throw new DatasetPolicyError('WORKFLOW_SOURCE_CHANGED','任务来源已变化，需基于当前真实数据重新执行');
  if(requireResult){
    const result=JSON.parse(job.result_json??'null');
    if(!result)throw new DatasetPolicyError('WORKFLOW_EVIDENCE_REQUIRED','缺少持久化的真实执行证据');
    const refs=turnDatasetRefs(result);assertResultSources(refs,ctx.deploymentTier,true);
    if(refs.some(r=>JSON.stringify(r)!==JSON.stringify(source)))throw new DatasetPolicyError('WORKFLOW_SOURCE_CHANGED','持久化结果与任务真实来源不一致');
  }
}

export function visibleJobEvidence(job:any,ctx:ExecutionContext):boolean {
 if(!formalRuntime(ctx.deploymentTier))return true;
 try{assertJobEvidence(job,ctx,Boolean(job.result_json));return true;}catch{return false;}
}
