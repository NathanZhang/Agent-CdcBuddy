import type { AgentInteraction } from '@/contracts/agent-interaction';
export interface FunctionalAction {type:string;id?:string;args?:Record<string,unknown>;prompt?:string;}
const kinds:Record<string,AgentInteraction['kind']>={skill:'skill',map:'resource',collection:'collection',report:'resource',session:'session',approval:'workflow',workflow:'workflow',catalog:'resource'};
export function adaptFunctionalInteraction(action:FunctionalAction):AgentInteraction{
 const [resource,operation]=action.type.split('.');if(!kinds[resource]||!operation)throw new Error('Unknown functional interaction');
 const args=action.args ?? {};
 const labels:Record<string,string>={'skill.execute':'执行所选技能','skill.delete':'删除所选技能','skill.update':'更新所选技能','catalog.list':'查看技能列表','map.drilldown':'查看所选区域监测数据','collection.form':'打开现场采集表单','collection.submit':'提交现场采集记录','collection.validate':'检查现场采集记录','report.generate':'生成监测报告','report.export':'导出所选监测数据或报告','session.create':'开启新研判会话','session.read':'读取历史会话','session.list':'查看历史会话列表','session.rename':'修改会话标题','session.update':'更新会话信息','session.delete':'删除所选会话','session.clear':'清空当前领域的个人会话','session.append':'记录已执行的会话运行','approval.decide':'提交审批决定','workflow.configure':'更新后台巡检配置'};
 return {interactionId:crypto.randomUUID(),kind:kinds[resource],userInput:action.prompt ?? `${labels[action.type] ?? '执行所选业务操作'}。`,resourceRef:{type:resource,id:action.id ?? action.type,action:operation},attachments:[{type:'operation-input',args}]};
}
