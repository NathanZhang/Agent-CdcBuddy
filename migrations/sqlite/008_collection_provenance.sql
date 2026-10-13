-- Legacy submissions intentionally remain unverified; never infer an observed
-- origin from their date, filename or the currently selected dataset.
CREATE TABLE IF NOT EXISTS biz_collection_evidence (
  submission_id TEXT PRIMARY KEY REFERENCES biz_mobile_submissions(submission_id),
  dataset_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
