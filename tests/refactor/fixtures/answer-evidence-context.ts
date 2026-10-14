/** Deterministic synthetic rows for evidence contracts, never efficacy evidence. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { observedWorkflowFixture } from './observed-workflow-context';

export function answerEvidenceFixture(directory: string): () => void {
  const restore = observedWorkflowFixture(directory);
  const manifest = process.env.DATASET_MANIFEST_PATH!;
  const rows = JSON.parse(readFileSync(manifest, 'utf8'));
  // Queries use mock provenance. Only the isolated report-policy test below
  // explicitly selects the observed branch of the contract.
  for (const row of rows) if (row.domain === 'vector') row.origin = 'mock';
  writeFileSync(manifest, JSON.stringify(rows));
  const db = new Database(join(directory, 'observed-contract.db'));
  try {
    db.exec(`INSERT INTO dim_species VALUES('fly','蝇','家蝇','Musca domestica');
      INSERT INTO dim_pesticide VALUES('p','溴氰菊酯','test');
      INSERT INTO dim_date VALUES('2024-07-15',2024,7,15,'夏'),('2024-08-15',2024,8,15,'夏');
      INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,capture_count,sampling_unit)
        VALUES('july','2024-07-15','l','s','m',10,1),('august','2024-08-15','l','s','m',15,1);`);
    const insert = db.prepare(`INSERT INTO fact_insecticide_resistance
      (resistance_id,species_id,pesticide_id,location_id,date_id,lc50,corrected_mortality,resistance_level,source_file)
      VALUES(?,'fly','p','l','2024-06-15',?,NULL,NULL,'answer-evidence-contract-fixture')`);
    db.transaction(() => {
      for (let i = 0; i < 73; i++) insert.run(`fly-${i}`, i < 33 ? 0.5 : null);
    })();
  } finally {
    db.close();
  }
  return restore;
}
