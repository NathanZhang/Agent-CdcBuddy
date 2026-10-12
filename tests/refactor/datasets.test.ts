import {readFileSync} from 'node:fs';
import { describe, it, expect } from 'vitest';
import { loadDatasetManifest } from '../../src/infrastructure/db/dataset-manifest';
import fixture from '../fixtures/dataset-manifests.json';

describe('dataset provenance', () => {
  it('labels each domain from explicit provenance, without exposing paths', () => {
    const refs = loadDatasetManifest(JSON.parse(readFileSync(new URL('../../config/datasets.json',import.meta.url),'utf8')));
    expect(Object.fromEntries(refs.map(d => [d.domain, d.origin]))).toEqual({vector:'observed',foodborne:'mock',env:'mock',chronic:'mock'});
    expect(refs.every(d => !('path' in d))).toBe(true);
  });
  it('rejects a manifest with missing provenance instead of inferring real data', () => {
    expect(() => loadDatasetManifest(fixture.missingOrigin)).toThrow(/origin/i);
  });
  it('rejects duplicate IDs and unknown domains', () => {
    expect(() => loadDatasetManifest(fixture.duplicateId)).toThrow(/duplicate/i);
    expect(() => loadDatasetManifest(fixture.unknownDomain)).toThrow(/domain/i);
  });
});
