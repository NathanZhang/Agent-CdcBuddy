import {spatialCapabilityFor} from '@/application/geo/spatial-capabilities';
import { listSkillDefinitions } from '@/application/skills/skill-service';
import {publicSkillMetadata} from '@/application/skills/capability-metadata';
import { AGENT_DOMAINS, type AgentDomain } from '@/contracts/dataset';
import { loadDatasetManifest } from '@/infrastructure/db/dataset-manifest';
export function getServerDomain(): AgentDomain {
  const domain = process.env.AGENT_DOMAIN ?? process.env.NEXT_PUBLIC_AGENT_DOMAIN ?? 'vector';
  if (!AGENT_DOMAINS.includes(domain as AgentDomain)) throw new Error('Invalid configured agent domain');
  return domain as AgentDomain;
}
export function getRuntimeProfile(domain: AgentDomain = getServerDomain()) {
  if (!AGENT_DOMAINS.includes(domain)) throw new Error('Unknown agent domain');
  const datasets = loadDatasetManifest().filter(d=>d.domain===domain);
  if (datasets.length === 0) throw new Error('Domain has no configured dataset');
  return {domain,datasets,capabilities:listSkillDefinitions(domain).map(s=>({...publicSkillMetadata(s),spatial:spatialCapabilityFor(s)}))};
}
