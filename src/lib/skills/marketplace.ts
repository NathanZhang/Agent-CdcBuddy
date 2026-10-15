import type {AgentDomain} from '@/contracts/dataset';
import type {VectorSkill} from './types';

export type SkillKind = 'business' | 'general';
export interface MarketplacePolicy {listed:boolean;kind:SkillKind;reason:string;capabilityId?:string;}

/** Execution registration and marketplace discovery are deliberately independent. */
export function marketplacePolicy(skill:{id:string;domain:AgentDomain;availability:string;method:string;visibility?:string}):MarketplacePolicy {
 const general:Record<string,string>={
  'bounded-domain-query-v1':'text2sql-visualization',
  'local-administrative-map-v1':'map-display',
  'verified-map-annotation-v1':'map-annotation',
  'versioned-report-template-v1':'report-templates',
  'shared-arima-forecast-v1':'arima-forecast'
 };
 const capabilityId=general[skill.method];
 const kind:SkillKind=capabilityId?'general':'business';
 const hidden=(reason:string):MarketplacePolicy=>({listed:false,kind,reason});
 if(skill.availability!=='available')return hidden('尚未实现的占位能力，不作为可运行技能上架');
 if(skill.visibility==='internal')return hidden('内部执行能力');
 if(skill.method==='validated-custom-skill-create-v1')return hidden('由创建技能入口提供，避免重复卡片');
 if(['skill_session_manage','skill_catalog_manage','skill_artifact_export','skill_collection_manage','skill_daemon_surveillance','skill_job_manage','skill_approval_decision','skill_retest_submit','skill_inbox_read'].includes(skill.id))return hidden('界面或业务流程内部操作，保留执行能力');
 if(['scientific-artifact-foundation-v1','artifact-scientific-kernels-v1'].includes(skill.method))return hidden('依赖前序工件的底层步骤，由科学分析流程统一编排');
 if(skill.id==='skill_auto_report_gen'&&['foodborne','chronic'].includes(skill.domain))return hidden('与本领域专题报告重复，保留兼容调用');
 if(skill.id==='skill_disposal_workflow')return hidden('与风险分级处置技能使用相同实现，场景统一到同一入口');
 if(skill.id==='skill_food_attribution')return hidden('已报告食品统计由病例查询与动态看板覆盖');
 return {listed:true,kind,reason:capabilityId?'跨智能体复用，数据和权限仍按当前领域隔离':'面向当前智能体的完整业务场景',...(capabilityId?{capabilityId}:{})};
}

export function buildMarketplaceSkills(domain:AgentDomain,capabilities:any[]=[],customSkills:any[]=[]):VectorSkill[]{
 const execute=async()=>{throw new Error('请通过主线Agent执行技能');};
 const standard=capabilities.filter(s=>s.domain===domain&&s.visibility!=='internal'&&s.availability==='available'&&s.marketplace?.listed===true).map(s=>({...s,visibility:'public',execute}));
 const custom=customSkills.filter(s=>s.domain===domain&&typeof(s.id??s.skill_id)==='string').map(s=>{
  const prompts=(Array.isArray(s.recommendedPrompts)?s.recommendedPrompts:typeof s.recommended_prompts==='string'?s.recommended_prompts.split(';'):[]).filter((p:any)=>typeof p==='string'?p.trim():p?.prompt?.trim());
  return {...s,id:s.id??s.skill_id,category:'custom',categoryName:'自定义业务技能',domain,description:s.description||'用户创建的领域分析技能',iconName:'Sparkles',visibility:s.visibility??'private',availability:'available',implementationStatus:'implemented',validationStatus:'unvalidated',marketplace:{listed:true,kind:'business',reason:'用户自定义业务技能'},recommendedPrompts:prompts.length?prompts:[`执行已保存的自定义技能“${s.name}”，展示查询结果及已配置的图表。`],requiredRoles:['PROVINCIAL_ADMIN','CITY_EXPERT','DISTRICT_SURVEILLANCE'],execute} as VectorSkill;
 });
 return [...new Map([...standard,...custom].map(s=>[s.id,s])).values()];
}
