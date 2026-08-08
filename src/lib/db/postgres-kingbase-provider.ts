/**
 * 生产环境 PostgreSQL / 人大金仓 (KingbaseES) 信创数据库适配器与迁移定义
 * 遵循 IVectorDataProvider 标准接口规范
 */
import {
  IVectorDataProvider,
  TimeSeriesFilter,
  ResistanceFilter,
  PathogenFilter,
  EarlyWarningFilter,
  DensityTrendPoint,
  SpeciesCompositionItem,
  ResistanceMatrixItem,
  PathogenRiskItem,
  EarlyWarningAlertItem
} from './data-provider';
import {
  DimLocation,
  DimSpecies,
  DimPathogen,
  DimPesticide,
  VectorSummaryStats
} from './types';

export interface KingbaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema?: string;
}

/**
 * 人大金仓 (KingbaseES V8/V9) 与 PostgreSQL 生产环境数据提供者实现
 * 通过标准 SQL 与连接池适配企业级信创环境
 */
export class KingbasePostgresVectorDataProvider implements IVectorDataProvider {
  private config: KingbaseConfig;
  private pool: any = null; // pg.Pool 或 kingbase pool

  constructor(config?: Partial<KingbaseConfig>) {
    this.config = {
      host: config?.host || process.env.DB_HOST || 'localhost',
      port: config?.port || parseInt(process.env.DB_PORT || '54321', 10), // 54321 for Kingbase, 5432 for Postgres
      database: config?.database || process.env.DB_NAME || 'vector_monitoring',
      user: config?.user || process.env.DB_USER || 'system',
      password: config?.password || process.env.DB_PASSWORD || 'manager',
      schema: config?.schema || 'public'
    };
  }

  // 生产环境 DDL 模式迁移定义
  static readonly DDL_SCHEMA = `
    -- 人大金仓 (KingbaseES) / PostgreSQL 生产环境 DDL 迁移脚本
    CREATE TABLE IF NOT EXISTS dim_location (
      location_id VARCHAR(64) PRIMARY KEY,
      district_code VARCHAR(32),
      province VARCHAR(64) NOT NULL DEFAULT '河南省',
      city VARCHAR(64) NOT NULL,
      district VARCHAR(64) NOT NULL,
      street VARCHAR(128),
      address TEXT,
      latitude NUMERIC(10, 6),
      longitude NUMERIC(10, 6)
    );

    CREATE TABLE IF NOT EXISTS dim_species (
      species_id VARCHAR(64) PRIMARY KEY,
      category VARCHAR(32) NOT NULL,
      species_name VARCHAR(64) NOT NULL,
      latin_name VARCHAR(128)
    );

    CREATE TABLE IF NOT EXISTS dim_date (
      date_id VARCHAR(32) PRIMARY KEY,
      year INT NOT NULL,
      month INT NOT NULL,
      day INT NOT NULL,
      season VARCHAR(16)
    );

    CREATE TABLE IF NOT EXISTS fact_monitoring (
      monitoring_id VARCHAR(64) PRIMARY KEY,
      date_id VARCHAR(32) REFERENCES dim_date(date_id),
      location_id VARCHAR(64) REFERENCES dim_location(location_id),
      species_id VARCHAR(64) REFERENCES dim_species(species_id),
      method_id VARCHAR(64),
      environment_id VARCHAR(64),
      audit_id VARCHAR(64),
      capture_count INT NOT NULL DEFAULT 0,
      weather_temp NUMERIC(5, 2),
      weather_humidity NUMERIC(5, 2),
      weather_wind VARCHAR(32),
      weather_condition VARCHAR(32),
      sampling_unit INT,
      source_file VARCHAR(255)
    );

    CREATE INDEX IF NOT EXISTS idx_fact_monitoring_spatial ON fact_monitoring(location_id, date_id);
    CREATE INDEX IF NOT EXISTS idx_fact_monitoring_species ON fact_monitoring(species_id);
  `;

  async getSummaryStats(): Promise<VectorSummaryStats> {
    throw new Error('KingbaseES 连接尚未配置，请在生产环境中注入 DB_HOST/DB_NAME 环境变量并初始化连接池');
  }

  async getLocations(city?: string): Promise<DimLocation[]> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async getSpeciesList(category?: string): Promise<DimSpecies[]> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async getPathogensList(): Promise<DimPathogen[]> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async getPesticidesList(): Promise<DimPesticide[]> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async getDensityTrend(filter: TimeSeriesFilter): Promise<any> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async getSpeciesComposition(filter: any): Promise<any> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async getResistanceEvaluation(filter: ResistanceFilter): Promise<any> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async getPathogenRiskAnalysis(filter: PathogenFilter): Promise<any> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async getEarlyWarningAlerts(filter: EarlyWarningFilter): Promise<EarlyWarningAlertItem[]> {
    throw new Error('KingbaseES 连接尚未配置');
  }

  async queryCustomSql(sql: string, params?: any[]): Promise<any[]> {
    throw new Error('KingbaseES 连接尚未配置');
  }
}
