CREATE TABLE biz_report_templates (
 template_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, organization_id TEXT NOT NULL, domain TEXT NOT NULL,
 name TEXT NOT NULL, version INTEGER NOT NULL, definition_json TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX idx_report_templates_owner ON biz_report_templates(user_id,organization_id,domain);
CREATE TABLE biz_environment_tasks (
 task_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,organization_id TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL,
 sample_code TEXT NOT NULL,task_type TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('PENDING','COMPLETED')),
 created_at INTEGER NOT NULL,completed_at INTEGER,
 UNIQUE(user_id,organization_id,sample_code)
);
CREATE TABLE biz_environment_samples (
 sample_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,organization_id TEXT NOT NULL,client_key TEXT NOT NULL,
 task_id TEXT REFERENCES biz_environment_tasks(task_id),city TEXT NOT NULL,district TEXT NOT NULL,sample_code TEXT NOT NULL,
 sampled_at TEXT NOT NULL,indicator TEXT NOT NULL,value REAL NOT NULL,unit TEXT NOT NULL,
 photo_data_url TEXT,photo_sha256 TEXT,payload_sha256 TEXT NOT NULL,submitted_at INTEGER NOT NULL,
 UNIQUE(user_id,organization_id,client_key)
);
