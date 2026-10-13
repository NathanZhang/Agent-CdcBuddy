CREATE TABLE IF NOT EXISTS biz_session_intents (
 session_id TEXT NOT NULL,user_id TEXT NOT NULL,organization_id TEXT NOT NULL,domain TEXT NOT NULL,revision INTEGER NOT NULL,state_json TEXT NOT NULL,pending_json TEXT,
 PRIMARY KEY(session_id,user_id,organization_id,domain)
);
CREATE TABLE IF NOT EXISTS biz_map_scenes (
 session_id TEXT NOT NULL,user_id TEXT NOT NULL,organization_id TEXT NOT NULL,domain TEXT NOT NULL,revision INTEGER NOT NULL,scene_json TEXT NOT NULL,
 PRIMARY KEY(session_id,user_id,organization_id,domain)
);
