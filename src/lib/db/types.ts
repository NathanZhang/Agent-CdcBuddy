export interface DimLocation {
  location_id: string;
  district_code?: string;
  province: string;
  city: string;
  district: string;
  street?: string;
  address?: string;
  latitude: number;
  longitude: number;
}

export interface DimDate {
  date_id: string;
  year: number;
  month: number;
  day: number;
  season: string;
}

export interface DimSpecies {
  species_id: string;
  category: string; // 蚊, 蝇, 蟑螂, 鼠, 蜱, 恙螨
  species_name: string; // e.g. 白纹伊蚊, 淡色库蚊
  latin_name: string;
}

export interface DimMethod {
  method_id: string;
  method_name: string;
}

export interface DimEnvironment {
  environment_id: string;
  environment_type: string;
}

export interface DimPathogen {
  pathogen_id: string;
  pathogen_name: string;
}

export interface DimPesticide {
  pesticide_id: string;
  pesticide_name: string;
  english_name?: string;
}

export interface FactMonitoring {
  monitoring_id: string;
  date_id: string;
  location_id: string;
  species_id: string;
  method_id: string;
  environment_id: string;
  audit_id: string;
  capture_count: number;
  female_count?: number;
  male_count?: number;
  undetermined_count?: number;
  larvae_count?: number;
  nymph_count?: number;
  adult_count?: number;
  weather_temp?: number;
  weather_humidity?: number;
  weather_wind?: string;
  weather_condition?: string;
  sampling_unit?: number;
  remarks?: string;
  source_file?: string;
}

export interface FactPathogenDetection {
  detection_id: string;
  monitoring_id?: string;
  location_id: string;
  date_id: string;
  species_id: string;
  pathogen_id: string;
  pcr_result: '阳性' | '阴性';
  cq_value?: number;
  tested_count?: number;
  positive_groups?: number;
  total_groups?: number;
  detection_method: string;
  remarks?: string;
  source_file?: string;
}

export interface FactInsecticideResistance {
  resistance_id: string;
  species_id: string;
  pesticide_id: string;
  location_id: string;
  date_id: string;
  lc50?: number;
  lc50_ci?: string;
  lc95?: number;
  lc95_ci?: string;
  slope_b?: number;
  control_mortality?: number;
  corrected_mortality?: number;
  resistance_level?: '敏感' | '低抗' | '中抗' | '高抗';
  test_temp?: number;
  test_humidity?: number;
  source_file?: string;
}

export interface VectorSummaryStats {
  totalMonitoringRecords: number;
  totalPathogenTests: number;
  totalResistanceTests: number;
  coveredCities: number;
  coveredDistricts: number;
  activeAlertsCount: number;
  latestMonitoringDate: string;
  topSpecies: { category: string; species_name: string; count: number }[];
}

// ---------------- 独立业务数据库应用实体类型 ----------------
export type DisposalStatus = 'PENDING' | 'IN_PROGRESS' | 'EVALUATING' | 'RESOLVED';

export interface BizDisposalTicket {
  ticket_id: string;
  alert_id?: string;
  target_city: string;
  target_district: string;
  target_street?: string;
  vector_category: string;
  species_name: string;
  severity_level: 'yellow' | 'orange' | 'red';
  recommended_protocol: { step: number; title: string; content: string }[];
  assigned_team: string;
  contact_phone?: string;
  disposal_status: DisposalStatus;
  before_density?: number;
  after_bi_index?: number;
  disposal_notes?: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface BizEarlyWarningEvent {
  event_id: string;
  title: string;
  level: 'yellow' | 'orange' | 'red';
  category: string;
  city: string;
  district: string;
  street?: string;
  latitude: number;
  longitude: number;
  trigger_reason: string;
  current_density: number;
  threshold: number;
  affected_population?: number;
  recommended_action?: string;
  push_channels?: string;
  push_status?: string;
  created_at: string;
}

export interface BizMobileSubmission {
  submission_id: string;
  user_id: string;
  user_name: string;
  city: string;
  district: string;
  street?: string;
  latitude?: number;
  longitude?: number;
  image_url_base64?: string;
  recognized_species?: string;
  ai_confidence?: number;
  category: string;
  species_name: string;
  capture_count: number;
  weather_temp?: number;
  weather_humidity?: number;
  habitat_type?: string;
  method_name?: string;
  audit_status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  auditor_name?: string;
  audit_comment?: string;
  submitted_at: string;
  audited_at?: string;
}

export interface BizKbStandard {
  doc_id: string;
  standard_no: string;
  title: string;
  category: string;
  chapter: string;
  content: string;
  keywords: string;
  reference_url?: string;
}

export interface BizGeneratedReport {
  report_id: string;
  title: string;
  author: string;
  city?: string;
  district?: string;
  report_type: string;
  summary: string;
  content_markdown: string;
  metadata_json?: string;
  created_at: string;
}

export interface BizCustomSkill {
  skill_id: string;
  name: string;
  description: string;
  category: string;
  sql_query: string;
  chart_type: string;
  recommended_prompts: string;
  visibility?: 'private' | 'public';
  created_by: string;
  created_at: string;
}

// ---------------- 历史会话与消息持久化实体类型 ----------------
export interface BizChatSession {
  session_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  title: string;
  last_generative_view?: string | any;
  message_count: number;
  is_pinned: number; // 0 或 1
  created_at: string;
  updated_at: string;
}

export interface BizChatMessage {
  message_id: string;
  session_id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  reasoning_text?: string;
  reasoning_duration?: number;
  skill_used?: string;
  generative_view_snapshot?: string | any;
  timestamp: string;
  created_at: string;
}

export interface ChatSessionFilter {
  userId?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}
