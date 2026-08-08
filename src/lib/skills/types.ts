import { ReactNode } from 'react';
import { UserRole } from '../rbac/types';

export type SkillCategory = 
  | 'population'   // 种群动态分析 (No. 23, 24)
  | 'resistance'   // 抗药性评估 (No. 25, 32)
  | 'pathogen'     // 病原携带风险 (No. 26)
  | 'warning'      // 动态预警响应与闭环 (No. 27, 28, 29)
  | 'forecast'     // 中长期风险预测 (No. 30, 31)
  | 'nlq'          // 自然语言问答 (No. 33)
  | 'report'       // 专题报告生成 (No. 34)
  | 'mobile'       // 移动端辅助与API (No. 35)
  | 'custom';      // 用户对话式自定义技能

export interface SkillContext {
  userRole: UserRole;
  userJurisdiction: { province: string; city?: string; district?: string };
  conversationId?: string;
}

export interface SkillParameterSchema {
  type: string;
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: any;
  }>;
  required?: string[];
}

export interface VectorSkill {
  id: string;
  name: string;
  category: SkillCategory;
  categoryName: string;
  requirementNo?: string;
  description: string;
  iconName: string;
  badgeColor?: string;
  recommendedPrompts: string[];
  requiredRoles: UserRole[];
  parametersSchema: SkillParameterSchema;
  execute: (args: Record<string, any>, context?: SkillContext) => Promise<any>;
}

export interface MetaCustomSkillData {
  id: string;
  name: string;
  description: string;
  category: 'custom';
  sqlQuery: string;
  chartType: 'trend' | 'bar' | 'pie' | 'map' | 'table';
  recommendedPrompts: string[];
  createdAt: string;
  createdBy: string;
}
