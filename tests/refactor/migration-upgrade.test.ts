import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { migrateDatabase, verifyMigrations } from '@/infrastructure/db/migrations';

it('upgrades the originally applied scientific DAG migration without changing history or saved data', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cdc-migration-upgrade-'));
  const file = join(dir, 'business.db');
  try {
    const db = new Database(file);
    db.exec('CREATE TABLE _cdc_migrations(version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)');
    const migrationDir = join(process.cwd(), 'migrations/sqlite');
    for (const version of readdirSync(migrationDir).filter(name => /^\d+_.+\.sql$/.test(name) && name < '012_').sort()) {
      const sql = readFileSync(join(migrationDir, version), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      if (version === '011_scientific_dag.sql') {
        expect(checksum).toBe('d7601b02847a6131d34afad67be80dc9e2fd97fdabd01a965fabb21269661ce1');
      }
      db.exec(sql);
      db.prepare('INSERT INTO _cdc_migrations VALUES(?,?,?)').run(version, checksum, 123);
    }
    db.exec(`INSERT INTO biz_science_runs(run_id,user_id,organization_id,domain,source_role,principal_json,scope_json,plan_json,plan_hash,request_key,status,created_at,updated_at)
      VALUES('saved-run','user','org','vector','ADMIN','{}','{}','{}','hash','request','QUEUED',123,123);
      INSERT INTO biz_science_nodes(run_id,node_id,status,output_json) VALUES('saved-run','node','SUCCEEDED','{"saved":true}');
      INSERT INTO biz_science_events(run_id,type,details_json,created_at) VALUES('saved-run','QUEUED','{}',123);`);
    const history = db.prepare('SELECT * FROM _cdc_migrations ORDER BY version').all();
    const run = db.prepare('SELECT * FROM biz_science_runs').get();
    const nodes = db.prepare('SELECT * FROM biz_science_nodes').all();
    const events = db.prepare('SELECT * FROM biz_science_events').all();
    db.close();

    expect(() => verifyMigrations(file)).toThrow('Business migrations not applied');
    expect(migrateDatabase(file)).toEqual({ applied: 3 });
    expect(migrateDatabase(file)).toEqual({ applied: 0 });
    expect(verifyMigrations(file)).toBe(true);
    const upgraded = new Database(file, { readonly: true });
    try {
      expect(upgraded.prepare("SELECT * FROM _cdc_migrations WHERE version < '012_' ORDER BY version").all()).toEqual(history);
      expect(upgraded.prepare('SELECT * FROM biz_science_runs').get()).toEqual({ ...run as object, dataset_refs_json: '[]' });
      expect(upgraded.prepare('SELECT * FROM biz_science_nodes').all()).toEqual(nodes);
      expect(upgraded.prepare('SELECT * FROM biz_science_events').all()).toEqual(events);
    } finally {
      upgraded.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
