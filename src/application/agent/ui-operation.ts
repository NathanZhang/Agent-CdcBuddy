import type { AgentInteraction } from '@/contracts/agent-interaction';

/** Explicit UI operations need no language interpretation or conversation turn. */
export function uiOperation(input: AgentInteraction): {skillId: string; mode: 'background' | 'session' | 'view'} | undefined {
  if (input.kind === 'conversation') return;
  const ref = input.resourceRef;
  if (!ref || !(input.attachments ?? []).some((a:any) => a?.type === 'operation-input')) return;
  if (ref.type === 'session' && ['create','read','list','rename','update','delete','clear'].includes(ref.action ?? '')) {
    return {skillId:'skill_session_manage', mode:['create','read'].includes(ref.action!) ? 'session' : 'background'};
  }
  if ((ref.type === 'catalog' && ref.action === 'list') || (ref.type === 'skill' && ['update','delete'].includes(ref.action ?? ''))) {
    return {skillId:'skill_catalog_manage', mode:'background'};
  }
  if (ref.type === 'collection') {
    return {skillId:'skill_collection_manage', mode:'view'};
  }
  if (ref.type === 'approval' && ref.action === 'decide') return {skillId:'skill_approval_decision', mode:'view'};
  if (ref.type === 'workflow') {
    const skillId:Record<string,string>={read:'skill_job_manage',list:'skill_job_manage',configure:'skill_daemon_surveillance',retest:'skill_retest_submit'};
    if (skillId[ref.action ?? '']) return {skillId:skillId[ref.action!], mode:'view'};
  }
  if (ref.type === 'report' && ref.action === 'export') return {skillId:'skill_artifact_export', mode:'background'};
}
