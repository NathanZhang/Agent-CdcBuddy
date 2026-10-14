CREATE TABLE biz_science_runs (
 run_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT NOT NULL,
 domain TEXT NOT NULL, source_role TEXT NOT NULL, principal_json TEXT NOT NULL,
 scope_json TEXT NOT NULL, dataset_refs_json TEXT NOT NULL, plan_json TEXT NOT NULL, plan_hash TEXT NOT NULL,
 request_key TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCEL_REQUESTED','CANCELLED')),
 lease_token TEXT, lease_until INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 error TEXT, UNIQUE(user_id,organization_id,domain,request_key)
);
CREATE TABLE biz_science_nodes (
 run_id TEXT NOT NULL REFERENCES biz_science_runs(run_id), node_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('PENDING','RUNNING','RETRY_WAIT','SUCCEEDED','SKIPPED','FAILED','CANCELLED')),
 attempts INTEGER NOT NULL DEFAULT 0, retries INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL DEFAULT 0, output_json TEXT, error TEXT,
 started_at INTEGER, finished_at INTEGER, PRIMARY KEY(run_id,node_id)
);
CREATE TABLE biz_science_events (
 event_id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, node_id TEXT,
 type TEXT NOT NULL, details_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX biz_science_claim ON biz_science_runs(status,lease_until,created_at);
