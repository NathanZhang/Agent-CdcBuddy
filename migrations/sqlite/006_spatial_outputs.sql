CREATE TABLE IF NOT EXISTS biz_spatial_outputs (
 run_id TEXT NOT NULL,call_id TEXT NOT NULL,output_id TEXT NOT NULL,user_id TEXT NOT NULL,organization_id TEXT NOT NULL,domain TEXT NOT NULL,
 scope_json TEXT NOT NULL,output_json TEXT NOT NULL,created_at INTEGER NOT NULL,
 PRIMARY KEY(run_id,call_id,output_id)
);
