CREATE TABLE biz_species_recognitions (
 recognition_id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 organization_id TEXT NOT NULL,
 domain TEXT NOT NULL CHECK(domain='vector'),
 image_sha256 TEXT NOT NULL,
 model TEXT NOT NULL,
 result_json TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX idx_species_recognition_owner ON biz_species_recognitions(user_id,organization_id,expires_at);

ALTER TABLE biz_mobile_submissions ADD COLUMN recognition_id TEXT REFERENCES biz_species_recognitions(recognition_id);
