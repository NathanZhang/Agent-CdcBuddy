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
