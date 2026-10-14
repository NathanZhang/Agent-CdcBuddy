CREATE TABLE biz_sampling_events (
 event_id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, dataset_version TEXT NOT NULL,
 organization_id TEXT NOT NULL, source_event_key TEXT NOT NULL, location_key TEXT NOT NULL,
 method_id TEXT NOT NULL, sampled_on TEXT NOT NULL, effort_value REAL NOT NULL CHECK(effort_value>0),
 effort_unit TEXT NOT NULL, evidence TEXT NOT NULL, record_hashes_json TEXT NOT NULL,
 reviewed_by TEXT NOT NULL, created_at INTEGER NOT NULL,
 UNIQUE(dataset_id,dataset_version,organization_id,source_event_key)
);
CREATE TABLE biz_sampling_event_records (
 dataset_id TEXT NOT NULL, dataset_version TEXT NOT NULL, organization_id TEXT NOT NULL,
 monitoring_id TEXT NOT NULL, event_id TEXT NOT NULL REFERENCES biz_sampling_events(event_id),
 PRIMARY KEY(dataset_id,dataset_version,organization_id,monitoring_id)
);
CREATE TABLE biz_scientific_artifacts (
 artifact_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT NOT NULL, domain TEXT NOT NULL,
 source_role TEXT NOT NULL, scope_json TEXT NOT NULL, artifact_json TEXT NOT NULL,
 content_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX scientific_artifact_owner ON biz_scientific_artifacts(user_id,organization_id,domain);
