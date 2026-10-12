export const AGENT_DOMAINS = ['vector', 'foodborne', 'env', 'chronic'] as const;
export type AgentDomain = typeof AGENT_DOMAINS[number];
export type DataOrigin = 'observed' | 'mock';
export interface DatasetRef {
  id: string;
  domain: AgentDomain;
  origin: DataOrigin;
  version: string;
  asOf: string;
  schemaVersion: string;
}
