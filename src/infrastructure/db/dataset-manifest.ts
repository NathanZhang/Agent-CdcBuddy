import fs from 'node:fs';
import path from 'node:path';
import { AGENT_DOMAINS, type DatasetRef } from '@/contracts/dataset';

export interface DatasetLocation extends DatasetRef { path: string }

export function readDatasetLocations(input?: unknown): DatasetLocation[] {
  const source: unknown = input ?? JSON.parse(fs.readFileSync(process.env.DATASET_MANIFEST_PATH ?? path.join(process.cwd(), 'config/datasets.json'), 'utf8'));
  if (!Array.isArray(source) || source.length === 0) throw new Error('Dataset manifest must be a nonempty array');
  const ids = new Set<string>();
  return source.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid dataset');
    const item = raw as Record<string, unknown>;
    for (const key of ['id', 'version', 'asOf', 'schemaVersion', 'path']) {
      if (typeof item[key] !== 'string' || !(item[key] as string).trim()) throw new Error(`Invalid dataset ${key}`);
    }
    if (!AGENT_DOMAINS.includes(item.domain as DatasetRef['domain'])) throw new Error('Invalid dataset domain');
    if (item.origin !== 'observed' && item.origin !== 'mock') throw new Error('Invalid dataset origin');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.asOf as string) || !Number.isFinite(Date.parse(item.asOf as string))) throw new Error('Invalid dataset asOf');
    if (ids.has(item.id as string)) throw new Error(`Duplicate dataset id: ${item.id}`);
    ids.add(item.id as string);
    return { id: item.id as string, domain: item.domain as DatasetRef['domain'], origin: item.origin, version: item.version as string, asOf: item.asOf as string, schemaVersion: item.schemaVersion as string, path: item.path as string };
  });
}

export function loadDatasetManifest(input?: unknown): DatasetRef[] {
  return readDatasetLocations(input).map(({ path: _path, ...ref }) => ref);
}
