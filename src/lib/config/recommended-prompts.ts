import scenarios from '../../../config/requirement-scenarios.json';
import type {AgentDomain} from '@/contracts/dataset';
export interface RecommendedPrompt {
 title:string;
 prompt:string;
 requirementId?:number;
 acceptance?:string;
 limitation?:string;
 deferred?:boolean;
}
export interface RequirementScenario extends RecommendedPrompt {
 requirementId:number;
 domain:AgentDomain;
 group:string;
 skillIds:string[];
 acceptance:string;
 limitation:string;
 deferred:boolean;
}
/** Single catalog: one scene per original requirement, independent of skill count. */
export const REQUIREMENT_SCENARIOS=scenarios as RequirementScenario[];
export function requirementPrompts(domain:AgentDomain){return REQUIREMENT_SCENARIOS.filter(s=>s.domain===domain);}
export function requirementCategories(domain:AgentDomain){
 const groups=new Map<string,RequirementScenario[]>();
 for(const scene of requirementPrompts(domain))groups.set(scene.group,[...(groups.get(scene.group)??[]),scene]);
 return [...groups].map(([title,prompts])=>({title,prompts,color:'bg-sky-50/50 dark:bg-slate-900 border-sky-200 dark:border-slate-700',iconName:'ClipboardCheck',iconColor:'text-sky-600 dark:text-sky-400'}));
}
export const SKILL_RECOMMENDATIONS:Record<string,RecommendedPrompt[]>={};
for(const scene of REQUIREMENT_SCENARIOS)for(const id of scene.skillIds)(SKILL_RECOMMENDATIONS[id]??=[]).push(scene);
export function recommendationsForSkill(domain:AgentDomain,id:string){return requirementPrompts(domain).filter(s=>s.skillIds.includes(id));}
