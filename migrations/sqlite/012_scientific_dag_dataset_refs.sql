-- Existing runs have no recorded dataset provenance; keep it unknown so the
-- worker's dataset-version check rejects replay against an unverified source.
ALTER TABLE biz_science_runs ADD COLUMN dataset_refs_json TEXT NOT NULL DEFAULT '[]';
