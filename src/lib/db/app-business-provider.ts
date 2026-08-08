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
  DisposalStatus
} from './types';

export class AppBusinessProvider {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    const possiblePaths = [
      path.resolve(process.cwd(), './app_business.db'),
      path.resolve(process.cwd(), '../Agent-CdcBuddy/app_business.db'),
      '/Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy/app_business.db'
    ];

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
  async saveCustomSkill(skill: BizCustomSkill): Promise<void> {
    const db = this.getDb();
    db.prepare(`
      INSERT OR REPLACE INTO biz_custom_skills (
        skill_id, name, description, category, sql_query, chart_type,
        recommended_prompts, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      skill.skill_id,
      skill.name,
      skill.description,
      skill.category,
      skill.sql_query,
      skill.chart_type,
      skill.recommended_prompts,
      skill.created_by,
      skill.created_at
    );
  }

  async getAllCustomSkills(): Promise<BizCustomSkill[]> {
    const db = this.getDb();
    return db.prepare('SELECT * FROM biz_custom_skills ORDER BY created_at DESC').all() as BizCustomSkill[];
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
