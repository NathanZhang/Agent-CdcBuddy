export type UserRole = 
  | 'PROVINCIAL_ADMIN'       // 省级疾控管理员 (全省数据权限，预警终审，消杀调度)
  | 'CITY_EXPERT'            // 市级疾控专家 (地级市数据权限，抗药性与病原体研判)
  | 'DISTRICT_SURVEILLANCE'  // 区县监测人员 (区县现场填报，数据校验，辖区预警核销)
  | 'PUBLIC_VIEWER';         // 公众与访客 (脱敏态势大屏，科普问答)

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  roleTitle: string;
  department: string;
  jurisdictionProvince: string;
  jurisdictionCity?: string;
  jurisdictionDistrict?: string;
  avatar: string;
  allowedSkillIds: string[];
}

export const PRESET_ROLES: Record<UserRole, UserProfile> = {
  PROVINCIAL_ADMIN: {
    id: 'user-001',
    name: '张主任 (省疾控消杀所所长)',
    role: 'PROVINCIAL_ADMIN',
    roleTitle: '省级管理员',
    department: '河南省疾病预防控制中心 · 消毒与媒介生物控制所',
    jurisdictionProvince: '河南省',
    avatar: '👨‍⚕️',
    allowedSkillIds: ['*'] // 全部权限
  },
  CITY_EXPERT: {
    id: 'user-002',
    name: '李研究员 (郑州市疾控专家)',
    role: 'CITY_EXPERT',
    roleTitle: '市级专家',
    department: '郑州市疾病预防控制中心 · 监测预警科',
    jurisdictionProvince: '河南省',
    jurisdictionCity: '郑州市',
    avatar: '👩‍🔬',
    allowedSkillIds: [
      'skill_population_dynamics',
      'skill_species_composition',
      'skill_resistance_evaluation',
      'skill_pathogen_risk',
      'skill_spatial_early_warning',
      'skill_density_forecast',
      'skill_transmission_risk',
      'skill_vector_nlq',
      'skill_auto_report_gen',
      'skill_meta_custom_builder',
      'skill_monitoring_data_table'
    ]
  },
  DISTRICT_SURVEILLANCE: {
    id: 'user-003',
    name: '王工 (金水区现场监测员)',
    role: 'DISTRICT_SURVEILLANCE',
    roleTitle: '区县监测员',
    department: '金水区疾病预防控制中心 · 现场消杀中队',
    jurisdictionProvince: '河南省',
    jurisdictionCity: '郑州市',
    jurisdictionDistrict: '金水区',
    avatar: '🧑‍💻',
    allowedSkillIds: [
      'skill_population_dynamics',
      'skill_spatial_early_warning',
      'skill_alert_push_dispatch',
      'skill_disposal_workflow',
      'skill_mobile_assistant_api',
      'skill_vector_nlq',
      'skill_monitoring_data_table'
    ]
  },
  PUBLIC_VIEWER: {
    id: 'user-004',
    name: '访客模式 (公众科普视图)',
    role: 'PUBLIC_VIEWER',
    roleTitle: '公众访客',
    department: '公众健康服务平台',
    jurisdictionProvince: '河南省',
    avatar: '👤',
    allowedSkillIds: [
      'skill_spatial_early_warning',
      'skill_vector_nlq',
      'skill_monitoring_data_table'
    ]
  }
};
