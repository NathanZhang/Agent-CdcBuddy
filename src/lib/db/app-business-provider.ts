import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  BizDisposalTicket,
  BizEarlyWarningEvent,
  BizMobileSubmission,
  BizKbStandard,
  BizGeneratedReport,
  BizCustomSkill,
  BizChatSession,
  BizChatMessage,
  ChatSessionFilter,
  DisposalStatus
} from './types';

export class AppBusinessProvider {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    const configuredPath = process.env.APP_BUSINESS_DB_PATH;
    const possiblePaths = [
      configuredPath ? path.resolve(configuredPath) : null,
      path.resolve(process.cwd(), './app_business.db'),
      path.resolve(process.cwd(), '../Agent-CdcBuddy/app_business.db'),
      '/Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy/app_business.db'
    ].filter((candidate): candidate is string => Boolean(candidate));

    let resolvedPath = possiblePaths[0];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        resolvedPath = p;
        break;
      }
    }
    this.dbPath = resolvedPath;
  }

  private getDb(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.dbPath);
    }
    return this.db;
  }

  // ---------------- 1. 处置工单管理 ----------------
  async getDisposalTickets(filter?: { city?: string; status?: DisposalStatus }): Promise<BizDisposalTicket[]> {
    const db = this.getDb();
    let sql = 'SELECT * FROM biz_disposal_tickets WHERE 1=1';
    const params: any[] = [];

    if (filter?.city) {
      sql += ' AND target_city = ?';
      params.push(filter.city);
    }
    if (filter?.status) {
      sql += ' AND disposal_status = ?';
      params.push(filter.status);
    }
    sql += ' ORDER BY created_at DESC';

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      ...r,
      recommended_protocol: typeof r.recommended_protocol === 'string' ? JSON.parse(r.recommended_protocol) : r.recommended_protocol
    }));
  }

  async getDisposalTicketById(ticketId: string): Promise<BizDisposalTicket | null> {
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM biz_disposal_tickets WHERE ticket_id = ?').get(ticketId) as any;
    if (!row) return null;
    return {
      ...row,
      recommended_protocol: typeof row.recommended_protocol === 'string' ? JSON.parse(row.recommended_protocol) : row.recommended_protocol
    };
  }

  async createDisposalTicket(ticket: Omit<BizDisposalTicket, 'created_at' | 'updated_at'>): Promise<BizDisposalTicket> {
    const db = this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newRecord = {
      ...ticket,
      created_at: now,
      updated_at: now
    };

    db.prepare(`
      INSERT INTO biz_disposal_tickets (
        ticket_id, alert_id, target_city, target_district, target_street,
        vector_category, species_name, severity_level, recommended_protocol,
        assigned_team, contact_phone, disposal_status, before_density,
        after_bi_index, disposal_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newRecord.ticket_id,
      newRecord.alert_id || null,
      newRecord.target_city,
      newRecord.target_district,
      newRecord.target_street || null,
      newRecord.vector_category,
      newRecord.species_name,
      newRecord.severity_level,
      JSON.stringify(newRecord.recommended_protocol),
      newRecord.assigned_team,
      newRecord.contact_phone || null,
      newRecord.disposal_status,
      newRecord.before_density || null,
      newRecord.after_bi_index || null,
      newRecord.disposal_notes || null,
      newRecord.created_at,
      newRecord.updated_at
    );

    return newRecord as BizDisposalTicket;
  }

  async updateTicketStatus(
    ticketId: string,
    status: DisposalStatus,
    notes?: string,
    afterBiIndex?: number
  ): Promise<boolean> {
    const db = this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const resolvedAt = status === 'RESOLVED' ? now : null;

    const res = db.prepare(`
      UPDATE biz_disposal_tickets
      SET disposal_status = ?,
          disposal_notes = COALESCE(?, disposal_notes),
          after_bi_index = COALESCE(?, after_bi_index),
          updated_at = ?,
          resolved_at = COALESCE(?, resolved_at)
      WHERE ticket_id = ?
    `).run(status, notes || null, afterBiIndex !== undefined ? afterBiIndex : null, now, resolvedAt, ticketId);

    return res.changes > 0;
  }

  // ---------------- 2. 预警事件与推送日志 ----------------
  async saveEarlyWarningEvent(event: BizEarlyWarningEvent): Promise<void> {
    const db = this.getDb();
    db.prepare(`
      INSERT OR REPLACE INTO biz_early_warning_events (
        event_id, title, level, category, city, district, street,
        latitude, longitude, trigger_reason, current_density, threshold,
        affected_population, recommended_action, push_channels, push_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.event_id,
      event.title,
      event.level,
      event.category,
      event.city,
      event.district,
      event.street || null,
      event.latitude,
      event.longitude,
      event.trigger_reason,
      event.current_density,
      event.threshold,
      event.affected_population || 0,
      event.recommended_action || null,
      event.push_channels || '系统通知,短信网关',
      event.push_status || 'SENT',
      event.created_at
    );
  }

  // ---------------- 3. 移动端现场上报与审核流 ----------------
  async submitMobileRecord(submission: Omit<BizMobileSubmission, 'submission_id' | 'submitted_at' | 'audit_status'>): Promise<BizMobileSubmission> {
    const db = this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const submissionId = `SUB-${Date.now()}`;

    const record: BizMobileSubmission = {
      submission_id: submissionId,
      ...submission,
      audit_status: 'SUBMITTED',
      submitted_at: now
    };

    db.prepare(`
      INSERT INTO biz_mobile_submissions (
        submission_id, user_id, user_name, city, district, street,
        latitude, longitude, image_url_base64, recognized_species, ai_confidence,
        category, species_name, capture_count, weather_temp, weather_humidity,
        habitat_type, method_name, audit_status, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.submission_id,
      record.user_id,
      record.user_name,
      record.city,
      record.district,
      record.street || null,
      record.latitude || null,
      record.longitude || null,
      record.image_url_base64 || null,
      record.recognized_species || null,
      record.ai_confidence || null,
      record.category,
      record.species_name,
      record.capture_count,
      record.weather_temp || null,
      record.weather_humidity || null,
      record.habitat_type || null,
      record.method_name || null,
      record.audit_status,
      record.submitted_at
    );

    return record;
  }

  async getMobileSubmissions(status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED'): Promise<BizMobileSubmission[]> {
    const db = this.getDb();
    let sql = 'SELECT * FROM biz_mobile_submissions WHERE 1=1';
    const params: any[] = [];
    if (status) {
      sql += ' AND audit_status = ?';
      params.push(status);
    }
    sql += ' ORDER BY submitted_at DESC';
    return db.prepare(sql).all(...params) as BizMobileSubmission[];
  }

  // ---------------- 4. 国家标准与消杀知识库查询 ----------------
  async searchStandards(query: string, category?: string): Promise<BizKbStandard[]> {
    const db = this.getDb();
    let sql = 'SELECT * FROM biz_kb_standards WHERE 1=1';
    const params: any[] = [];

    if (category) {
      sql += ' AND category LIKE ?';
      params.push(`%${category}%`);
    }

    if (query) {
      sql += ' AND (title LIKE ? OR content LIKE ? OR keywords LIKE ? OR chapter LIKE ?)';
      params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    }

    sql += ' LIMIT 10';
    return db.prepare(sql).all(...params) as BizKbStandard[];
  }

  // ---------------- 5. 自动生成专题报告归档 ----------------
  async saveReport(report: Omit<BizGeneratedReport, 'created_at'>): Promise<BizGeneratedReport> {
    const db = this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const saved: BizGeneratedReport = {
      ...report,
      created_at: now
    };

    db.prepare(`
      INSERT OR REPLACE INTO biz_generated_reports (
        report_id, title, author, city, district, report_type, summary,
        content_markdown, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      saved.report_id,
      saved.title,
      saved.author,
      saved.city || null,
      saved.district || null,
      saved.report_type,
      saved.summary,
      saved.content_markdown,
      saved.metadata_json || null,
      saved.created_at
    );

    return saved;
  }

  // ---------------- 6. 自定义技能元数据 ----------------
  private ensureCustomSkillsTableSchema() {
    const db = this.getDb();
    try {
      const columns = db.prepare(`PRAGMA table_info(biz_custom_skills)`).all() as Array<{ name: string }>;
      const hasVisibility = columns.some(c => c.name === 'visibility');
      if (!hasVisibility) {
        db.prepare(`ALTER TABLE biz_custom_skills ADD COLUMN visibility TEXT DEFAULT 'private'`).run();
      }
    } catch (e) {
      // 忽略检查异常
    }
  }

  async saveCustomSkill(skill: BizCustomSkill): Promise<void> {
    this.ensureCustomSkillsTableSchema();
    const db = this.getDb();
    const visibility = skill.visibility || 'private';

    // 检查是否已存在同名自定义技能，若存在则更新已有记录，避免同名生成多条重复记录
    const existingByName = db.prepare('SELECT skill_id FROM biz_custom_skills WHERE name = ?').get(skill.name) as { skill_id: string } | undefined;
    const finalSkillId = existingByName ? existingByName.skill_id : skill.skill_id;

    db.prepare(`
      INSERT OR REPLACE INTO biz_custom_skills (
        skill_id, name, description, category, sql_query, chart_type,
        recommended_prompts, visibility, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finalSkillId,
      skill.name,
      skill.description,
      skill.category,
      skill.sql_query,
      skill.chart_type,
      skill.recommended_prompts,
      visibility,
      skill.created_by,
      skill.created_at
    );
  }

  async updateCustomSkill(skillId: string, updates: Partial<BizCustomSkill>): Promise<boolean> {
    this.ensureCustomSkillsTableSchema();
    const db = this.getDb();
    const existing = await this.getCustomSkillById(skillId);
    if (!existing) return false;

    const merged: BizCustomSkill = {
      ...existing,
      ...updates,
      skill_id: skillId
    };

    db.prepare(`
      UPDATE biz_custom_skills
      SET name = ?, description = ?, sql_query = ?, chart_type = ?,
          recommended_prompts = ?, visibility = ?
      WHERE skill_id = ?
    `).run(
      merged.name,
      merged.description,
      merged.sql_query,
      merged.chart_type,
      merged.recommended_prompts,
      merged.visibility || 'private',
      skillId
    );

    return true;
  }

  async deleteCustomSkill(skillId: string): Promise<boolean> {
    this.ensureCustomSkillsTableSchema();
    const db = this.getDb();
    const res = db.prepare('DELETE FROM biz_custom_skills WHERE skill_id = ?').run(skillId);
    return res.changes > 0;
  }

  async getCustomSkillById(skillId: string): Promise<BizCustomSkill | undefined> {
    this.ensureCustomSkillsTableSchema();
    const db = this.getDb();
    return db.prepare('SELECT * FROM biz_custom_skills WHERE skill_id = ?').get(skillId) as BizCustomSkill | undefined;
  }

  async getAllCustomSkills(): Promise<BizCustomSkill[]> {
    this.ensureCustomSkillsTableSchema();
    const db = this.getDb();
    return db.prepare('SELECT * FROM biz_custom_skills ORDER BY created_at DESC').all() as BizCustomSkill[];
  }

  // ---------------- 7. 历史会话与消息真实持久化管理 ----------------
  private ensureChatSessionTables(): void {
    const db = this.getDb();
    db.exec(`
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
      );

      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
      ON biz_chat_sessions(user_id, is_pinned DESC, updated_at DESC);

      CREATE TABLE IF NOT EXISTS biz_chat_messages (
        message_id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        sender VARCHAR(16) NOT NULL,
        text TEXT NOT NULL,
        reasoning_text TEXT,
        reasoning_duration INTEGER,
        skill_used VARCHAR(64),
        generative_view_snapshot TEXT,
        timestamp VARCHAR(32) NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (session_id) REFERENCES biz_chat_sessions(session_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_chat_messages_session_time
      ON biz_chat_messages(session_id, created_at ASC);
    `);

    // 动态平滑迁移：若老表缺少 reasoning 列则自动增加
    try {
      const db = this.getDb();
      const cols = db.prepare(`PRAGMA table_info(biz_chat_messages)`).all() as Array<{ name: string }>;
      const colNames = new Set(cols.map(c => c.name));
      if (!colNames.has('reasoning_text')) {
        db.prepare(`ALTER TABLE biz_chat_messages ADD COLUMN reasoning_text TEXT`).run();
      }
      if (!colNames.has('reasoning_duration')) {
        db.prepare(`ALTER TABLE biz_chat_messages ADD COLUMN reasoning_duration INTEGER`).run();
      }
    } catch (e) {
      // 忽略迁移尝试异常
    }
  }

  /**
   * 分页与关键词检索历史会话列表
   */
  async getChatSessions(filter?: ChatSessionFilter): Promise<BizChatSession[]> {
    this.ensureChatSessionTables();
    const db = this.getDb();

    let sql = 'SELECT * FROM biz_chat_sessions WHERE 1=1';
    const params: any[] = [];

    if (filter?.userId) {
      sql += ' AND user_id = ?';
      params.push(filter.userId);
    }

    if (filter?.keyword && filter.keyword.trim()) {
      sql += ' AND (title LIKE ? OR session_id IN (SELECT session_id FROM biz_chat_messages WHERE text LIKE ?))';
      const kw = `%${filter.keyword.trim()}%`;
      params.push(kw, kw);
    }

    sql += ' ORDER BY is_pinned DESC, updated_at DESC';

    if (filter?.limit) {
      sql += ' LIMIT ?';
      params.push(filter.limit);
      if (filter?.offset) {
        sql += ' OFFSET ?';
        params.push(filter.offset);
      }
    }

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(r => {
      let parsedView = null;
      if (r.last_generative_view) {
        if (typeof r.last_generative_view === 'object') {
          parsedView = r.last_generative_view;
        } else {
          try {
            parsedView = JSON.parse(r.last_generative_view);
          } catch {
            parsedView = null;
          }
        }
      }
      return {
        ...r,
        last_generative_view: parsedView
      };
    });
  }

  /**
   * 获取匹配条件的会话总数
   */
  async getChatSessionCount(filter?: ChatSessionFilter): Promise<number> {
    this.ensureChatSessionTables();
    const db = this.getDb();

    let sql = 'SELECT COUNT(*) as cnt FROM biz_chat_sessions WHERE 1=1';
    const params: any[] = [];

    if (filter?.userId) {
      sql += ' AND user_id = ?';
      params.push(filter.userId);
    }

    if (filter?.keyword && filter.keyword.trim()) {
      sql += ' AND (title LIKE ? OR session_id IN (SELECT session_id FROM biz_chat_messages WHERE text LIKE ?))';
      const kw = `%${filter.keyword.trim()}%`;
      params.push(kw, kw);
    }

    const row = db.prepare(sql).get(...params) as any;
    return row?.cnt || 0;
  }

  /**
   * 获取单条会话元数据
   */
  async getChatSessionById(sessionId: string): Promise<BizChatSession | null> {
    this.ensureChatSessionTables();
    const db = this.getDb();
    const row = db.prepare('SELECT * FROM biz_chat_sessions WHERE session_id = ?').get(sessionId) as any;
    if (!row) return null;

    let parsedView = null;
    if (row.last_generative_view) {
      if (typeof row.last_generative_view === 'object') {
        parsedView = row.last_generative_view;
      } else {
        try {
          parsedView = JSON.parse(row.last_generative_view);
        } catch {
          parsedView = null;
        }
      }
    }

    return {
      ...row,
      last_generative_view: parsedView
    };
  }

  /**
   * 获取某会话下的全部历史消息流（按时间升序）
   */
  async getChatMessages(sessionId: string): Promise<BizChatMessage[]> {
    this.ensureChatSessionTables();
    const db = this.getDb();
    const rows = db.prepare('SELECT * FROM biz_chat_messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as any[];
    return rows.map(r => {
      let parsedSnapshot = null;
      if (r.generative_view_snapshot) {
        if (typeof r.generative_view_snapshot === 'object') {
          parsedSnapshot = r.generative_view_snapshot;
        } else {
          try {
            parsedSnapshot = JSON.parse(r.generative_view_snapshot);
          } catch {
            parsedSnapshot = null;
          }
        }
      }
      return {
        ...r,
        generative_view_snapshot: parsedSnapshot
      };
    });
  }

  /**
   * 创建新会话
   */
  async createChatSession(
    session: Omit<BizChatSession, 'created_at' | 'updated_at' | 'message_count'> & {
      initialMessages?: Omit<BizChatMessage, 'created_at'>[];
    }
  ): Promise<BizChatSession> {
    this.ensureChatSessionTables();
    const db = this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newRecord: BizChatSession = {
      session_id: session.session_id,
      user_id: session.user_id,
      user_name: session.user_name,
      user_role: session.user_role,
      title: session.title,
      last_generative_view: session.last_generative_view || null,
      message_count: session.initialMessages ? session.initialMessages.length : 0,
      is_pinned: session.is_pinned ?? 0,
      created_at: now,
      updated_at: now
    };

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO biz_chat_sessions (
          session_id, user_id, user_name, user_role, title,
          last_generative_view, message_count, is_pinned, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newRecord.session_id,
        newRecord.user_id,
        newRecord.user_name,
        newRecord.user_role,
        newRecord.title,
        newRecord.last_generative_view ? JSON.stringify(newRecord.last_generative_view) : null,
        newRecord.message_count,
        newRecord.is_pinned,
        newRecord.created_at,
        newRecord.updated_at
      );

      if (session.initialMessages && session.initialMessages.length > 0) {
        const stmt = db.prepare(`
          INSERT INTO biz_chat_messages (
            message_id, session_id, sender, text, reasoning_text, reasoning_duration, skill_used,
            generative_view_snapshot, timestamp, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const msg of session.initialMessages) {
          const msgId = msg.message_id || (msg as any).id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          stmt.run(
            msgId,
            newRecord.session_id,
            msg.sender,
            msg.text,
            msg.reasoning_text || (msg as any).reasoningText || null,
            msg.reasoning_duration !== undefined ? msg.reasoning_duration : ((msg as any).reasoningDuration ?? null),
            msg.skill_used || (msg as any).skillUsed || null,
            msg.generative_view_snapshot || (msg as any).generativeViewSnapshot ? JSON.stringify(msg.generative_view_snapshot || (msg as any).generativeViewSnapshot) : null,
            msg.timestamp || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            now
          );
        }
      }
    });

    insertTx();
    return newRecord;
  }

  /**
   * 向会话中追加多条消息并更新会话快照与时间
   */
  async batchAppendChatMessages(
    sessionId: string,
    messages: Omit<BizChatMessage, 'created_at'>[],
    lastGenerativeView?: any,
    suggestedTitle?: string
  ): Promise<boolean> {
    this.ensureChatSessionTables();
    const db = this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const updateTx = db.transaction(() => {
      const msgStmt = db.prepare(`
        INSERT INTO biz_chat_messages (
          message_id, session_id, sender, text, reasoning_text, reasoning_duration, skill_used,
          generative_view_snapshot, timestamp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const msg of messages) {
        const msgId = msg.message_id || (msg as any).id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        msgStmt.run(
          msgId,
          sessionId,
          msg.sender,
          msg.text,
          msg.reasoning_text || (msg as any).reasoningText || null,
          msg.reasoning_duration !== undefined ? msg.reasoning_duration : ((msg as any).reasoningDuration ?? null),
          msg.skill_used || (msg as any).skillUsed || null,
          msg.generative_view_snapshot || (msg as any).generativeViewSnapshot ? JSON.stringify(msg.generative_view_snapshot || (msg as any).generativeViewSnapshot) : null,
          msg.timestamp || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          now
        );
      }

      // 获取当前会话并更新
      const current = db.prepare('SELECT message_count, title FROM biz_chat_sessions WHERE session_id = ?').get(sessionId) as any;
      if (current) {
        const newCount = (current.message_count || 0) + messages.length;
        let finalTitle = current.title;
        // 如果原标题为默认占位且有推荐标题，则更新
        if (suggestedTitle && (current.title === '新研判会话' || current.title.startsWith('新建会话'))) {
          finalTitle = suggestedTitle;
        }

        if (lastGenerativeView !== undefined) {
          db.prepare(`
            UPDATE biz_chat_sessions
            SET message_count = ?, updated_at = ?, last_generative_view = ?, title = ?
            WHERE session_id = ?
          `).run(
            newCount,
            now,
            lastGenerativeView ? JSON.stringify(lastGenerativeView) : null,
            finalTitle,
            sessionId
          );
        } else {
          db.prepare(`
            UPDATE biz_chat_sessions
            SET message_count = ?, updated_at = ?, title = ?
            WHERE session_id = ?
          `).run(
            newCount,
            now,
            finalTitle,
            sessionId
          );
        }
      }
    });

    updateTx();
    return true;
  }

  /**
   * 更新会话信息 (标题, 置顶状态, 工作台视图快照)
   */
  async updateChatSession(
    sessionId: string,
    updates: {
      title?: string;
      is_pinned?: number;
      last_generative_view?: any;
    }
  ): Promise<boolean> {
    this.ensureChatSessionTables();
    const db = this.getDb();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const existing = db.prepare('SELECT * FROM biz_chat_sessions WHERE session_id = ?').get(sessionId) as any;
    if (!existing) return false;

    const newTitle = updates.title !== undefined ? updates.title : existing.title;
    const newPinned = updates.is_pinned !== undefined ? updates.is_pinned : existing.is_pinned;
    const newView = updates.last_generative_view !== undefined
      ? (updates.last_generative_view ? JSON.stringify(updates.last_generative_view) : null)
      : existing.last_generative_view;

    const res = db.prepare(`
      UPDATE biz_chat_sessions
      SET title = ?, is_pinned = ?, last_generative_view = ?, updated_at = ?
      WHERE session_id = ?
    `).run(newTitle, newPinned, newView, now, sessionId);

    return res.changes > 0;
  }

  /**
   * 删除指定会话（级联删除消息）
   */
  async deleteChatSession(sessionId: string): Promise<boolean> {
    this.ensureChatSessionTables();
    const db = this.getDb();
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM biz_chat_messages WHERE session_id = ?').run(sessionId);
      db.prepare('DELETE FROM biz_chat_sessions WHERE session_id = ?').run(sessionId);
    });
    deleteTx();
    return true;
  }

  /**
   * 清空指定用户的所有会话
   */
  async clearUserChatSessions(userId: string): Promise<boolean> {
    this.ensureChatSessionTables();
    const db = this.getDb();
    const clearTx = db.transaction(() => {
      db.prepare(`
        DELETE FROM biz_chat_messages
        WHERE session_id IN (SELECT session_id FROM biz_chat_sessions WHERE user_id = ?)
      `).run(userId);
      db.prepare('DELETE FROM biz_chat_sessions WHERE user_id = ?').run(userId);
    });
    clearTx();
    return true;
  }
}

// 单例导出
let globalBizProvider: AppBusinessProvider | null = null;
export function getAppBusinessProvider(): AppBusinessProvider {
  if (!globalBizProvider) {
    globalBizProvider = new AppBusinessProvider();
  }
  return globalBizProvider;
}

