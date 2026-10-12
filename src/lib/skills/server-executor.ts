import { randomUUID } from 'node:crypto';
import { executeSkill } from '@/application/skills/skill-service';
import { getServerDomain } from '@/application/config/runtime-profile';
import type { ExecutionContext,DeploymentTier } from '@/contracts/execution-context';
export function createDevelopmentContext(domain=getServerDomain()):ExecutionContext{
  const deploymentTier=(process.env.DEPLOYMENT_TIER ?? 'local') as DeploymentTier;
  if(!['local','demo','pilot'].includes(deploymentTier))throw new Error('Invalid deployment tier');
  if(deploymentTier==='pilot')throw new Error('Authenticated server principal required');
  return {runId:randomUUID(),domain,deploymentTier,principal:{userId:'local-development',role:'PROVINCIAL_ADMIN',organizationId:'local-development',domainGrants:[domain],jurisdiction:{},mode:'dev',permissions:{manageIdentity:true,professionalReview:true}}};
}
/** Compatibility payload adapter. HTTP business callers migrate to Agent turns in T5/T6. */
export async function executeSkillServer(skillId:string,args:Record<string,any>,ctx:ExecutionContext=createDevelopmentContext()):Promise<Record<string,any>>{
  const result=await executeSkill(skillId,args,ctx);
  if(result.status==='FAILED')throw new Error(result.error?.message ?? 'Skill failed');
  const payload=result.payload && typeof result.payload==='object'?result.payload:{};
  return {...payload,status:result.status,payload:result.status==='NO_DATA'?null:result.payload,datasets:result.datasets,method:result.method,qualityFlags:result.qualityFlags};
}
