-- Schema only. No demonstration data or fabricated SENT/RESOLVED seeds.
CREATE TABLE IF NOT EXISTS biz_disposal_tickets (
        ticket_id TEXT PRIMARY KEY,
        alert_id TEXT,
        target_city TEXT NOT NULL,
        target_district TEXT NOT NULL,
        target_street TEXT,
        vector_category TEXT NOT NULL,
        species_name TEXT NOT NULL,
        severity_level TEXT NOT NULL,
        recommended_protocol TEXT NOT NULL,
        assigned_team TEXT NOT NULL,
        contact_phone TEXT,
        disposal_status TEXT NOT NULL DEFAULT 'PENDING',
        before_density REAL,
        after_bi_index REAL,
        disposal_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT
    );
CREATE TABLE IF NOT EXISTS biz_early_warning_events (
        event_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        street TEXT,
        latitude REAL,
        longitude REAL,
        trigger_reason TEXT NOT NULL,
        current_density REAL NOT NULL,
        threshold REAL NOT NULL,
        affected_population INTEGER,
        recommended_action TEXT,
        push_channels TEXT,
        push_status TEXT DEFAULT 'SENT',
        created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS biz_mobile_submissions (
        submission_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        street TEXT,
        latitude REAL,
        longitude REAL,
        image_url_base64 TEXT,
        recognized_species TEXT,
        ai_confidence REAL,
        category TEXT NOT NULL,
        species_name TEXT NOT NULL,
        capture_count INTEGER NOT NULL,
        weather_temp REAL,
        weather_humidity REAL,
        habitat_type TEXT,
        method_name TEXT,
        audit_status TEXT NOT NULL DEFAULT 'SUBMITTED',
        auditor_name TEXT,
        audit_comment TEXT,
        submitted_at TEXT NOT NULL,
        audited_at TEXT
    );
CREATE TABLE IF NOT EXISTS biz_kb_standards (
        doc_id TEXT PRIMARY KEY,
        standard_no TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        chapter TEXT NOT NULL,
        content TEXT NOT NULL,
        keywords TEXT NOT NULL,
        reference_url TEXT
    );
CREATE TABLE IF NOT EXISTS biz_generated_reports (
        report_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        city TEXT,
        district TEXT,
        report_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        content_markdown TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL
    );
CREATE TABLE IF NOT EXISTS biz_custom_skills (
        skill_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        sql_query TEXT NOT NULL,
        chart_type TEXT NOT NULL,
        recommended_prompts TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
    , visibility TEXT DEFAULT 'private', domain VARCHAR(32) DEFAULT 'vector');
CREATE TABLE IF NOT EXISTS biz_chat_sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(64) NOT NULL,
        user_role VARCHAR(64) NOT NULL,
        title VARCHAR(256) NOT NULL,
        last_generative_view TEXT,
        message_count INTEGER DEFAULT 0,
        is_pinned INTEGER DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      , domain VARCHAR(32) DEFAULT 'vector');
CREATE TABLE IF NOT EXISTS biz_chat_messages (
        message_id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        sender VARCHAR(16) NOT NULL,
        text TEXT NOT NULL,
        skill_used VARCHAR(64),
        generative_view_snapshot TEXT,
        timestamp VARCHAR(32) NOT NULL,
        created_at DATETIME NOT NULL, reasoning_text TEXT, reasoning_duration INTEGER,
        FOREIGN KEY (session_id) REFERENCES biz_chat_sessions(session_id) ON DELETE CASCADE
      );
