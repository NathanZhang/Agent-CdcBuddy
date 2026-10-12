CREATE TABLE IF NOT EXISTS biz_users(user_id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,principal_json TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS biz_auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,csrf_token TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS biz_login_attempts(username TEXT PRIMARY KEY,attempts INTEGER NOT NULL,window_start INTEGER NOT NULL);
