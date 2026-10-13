CREATE TABLE IF NOT EXISTS biz_query_sources (
 run_id TEXT NOT NULL,call_id TEXT NOT NULL,user_id TEXT NOT NULL,organization_id TEXT NOT NULL,domain TEXT NOT NULL,
 scope_json TEXT NOT NULL,payload_json TEXT NOT NULL,dataset_json TEXT NOT NULL,created_at INTEGER NOT NULL,
 PRIMARY KEY(run_id,call_id)
);
