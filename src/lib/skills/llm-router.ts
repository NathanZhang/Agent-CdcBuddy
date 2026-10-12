import { listSkillDefinitions } from '@/application/skills/skill-service';
import { getServerDomain } from '@/application/config/runtime-profile';
/** Server catalog only. Intents execute through runAgentTurn, never through a separate router. */
export function getSiliconFlowSkillTools(){return listSkillDefinitions(getServerDomain()).map(skill=>({type:'function',function:{name:skill.id,description:`${skill.name} (${skill.availability}): ${skill.description ?? ''}`,parameters:skill.inputSchema}}));}
