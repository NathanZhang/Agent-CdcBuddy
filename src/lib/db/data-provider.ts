import {
  DimLocation,
  DimSpecies,
  DimDate,
  DimPathogen,
  DimPesticide,
  FactMonitoring,
  FactPathogenDetection,
  FactInsecticideResistance,
  VectorSummaryStats
} from './types';

export interface TimeSeriesFilter {
  category?: string; // 蚊, 蝇, 蟑螂, 鼠, 蜱, 恙螨
  speciesName?: string;
  city?: string;
  district?: string;
  startDate?: string;
  endDate?: string;
  forecastMonths?: number;
}

export interface ResistanceFilter {
  speciesName?: string;
  pesticideName?: string;
  city?: string;
  year?: number;
}

export interface PathogenFilter {
  pathogenName?: string;
  speciesName?: string;
  city?: string;
  year?: number;
}

export interface EarlyWarningFilter {
  city?: string;
  district?: string;
  severity?: 'all' | 'yellow' | 'orange' | 'red';
  category?: string;
}

export interface DensityTrendPoint {
  date: string;
  historicalValue?: number;
  predictedValue?: number;
  lowerBound?: number;
  upperBound?: number;
  avgTemp?: number;
  avgHumidity?: number;
}

export interface SpeciesCompositionItem {
  speciesName: string;
  latinName: string;
  category: string;
  totalCount: number;
  percentage: number;
  cityBreakdown: { city: string; count: number }[];
}

export interface ResistanceMatrixItem {
  speciesName: string;
  pesticideName: string;
  city: string;
  resistanceLevel: string; // 敏感 / 低抗 / 中抗 / 高抗
  lc50?: number;
  correctedMortality?: number;
  sampleYear: number;
  guidelineRecommendation: string;
}

export interface PathogenRiskItem {
  pathogenName: string;
  speciesName: string;
  city: string;
  district: string;
  testedCount: number;
  positiveCount: number;
  positivityRate: number; // %
  riskLevel: '低风险' | '中风险' | '高风险' | '极高风险';
  associatedDisease: string;
}

export interface EarlyWarningAlertItem {
  alertId: string;
  title: string;
  level: 'yellow' | 'orange' | 'red'; // 一般 / 较重 / 严重
  levelName: string;
  category: string;
  city: string;
  district: string;
  street?: string;
  latitude: number;
  longitude: number;
  triggerReason: string;
  currentDensity: number;
  threshold: number;
  affectedPopulationEstimate: number;
  recommendedAction: string;
  disposalStatus: 'pending' | 'in_progress' | 'resolved';
  triggerTime: string;
}

/**
 * 统一数据库访问抽象层接口 (DAL Interface)
 * 适配 SQLite (本地/Mock开发环境) 以及 PostgreSQL / 人大金仓 KingbaseES (正式生产环境)
 */
export interface IVectorDataProvider {
  getSummaryStats(): Promise<VectorSummaryStats>;
  getLocations(city?: string): Promise<DimLocation[]>;
  getSpeciesList(category?: string): Promise<DimSpecies[]>;
  getPathogensList(): Promise<DimPathogen[]>;
  getPesticidesList(): Promise<DimPesticide[]>;
  
  // 核心业务分析能力 (对应功能清单 23~35 项)
  getDensityTrend(filter: TimeSeriesFilter): Promise<{
    trend: DensityTrendPoint[];
    r2Score: number;
    weatherCorrelation: { tempCorr: number; humidityCorr: number };
    insights: string[];
  }>;

  getSpeciesComposition(filter: { category?: string; city?: string; year?: number }): Promise<{
    items: SpeciesCompositionItem[];
    dominantSpecies: string;
    shannonWienerIndex: number;
  }>;

  getResistanceEvaluation(filter: ResistanceFilter): Promise<{
    items: ResistanceMatrixItem[];
    rotationSuggestions: string[];
  }>;

  getPathogenRiskAnalysis(filter: PathogenFilter): Promise<{
    items: PathogenRiskItem[];
    highRiskLocations: { city: string; district: string; pathogen: string; rate: number }[];
    summaryAdvice: string;
  }>;

  getEarlyWarningAlerts(filter: EarlyWarningFilter): Promise<EarlyWarningAlertItem[]>;

  queryCustomSql(sql: string, params?: any[]): Promise<any[]>;
}
