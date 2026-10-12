import {analyticsSkill} from '../../shared/analytics-skill';
import type {SkillDefinition} from '@/contracts/skill-definition';
import { buildDomainSkills } from '../../shared/skill-factory';
const dateSchema={type:'string',pattern:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'};
const captureProperties={category:{enum:['蚊','蝇','蟑螂','鼠','蜱','恙螨']},speciesName:{type:'string'},methodName:{type:'string'},asOf:dateSchema,dataWindow:{type:'integer',minimum:1,maximum:120},forecastMonths:{type:'integer',minimum:1,maximum:24}};
export function vectorSkills():SkillDefinition[]{const definitions=buildDomainSkills('vector',{
 skill_population_dynamics:analyticsSkill('population_dynamics','autoregression-seasonal-capture-v1','按采样方法的月捕获量自回归预测',captureProperties),
 skill_density_forecast:analyticsSkill('density_gbdt','gradient-boosting-capture-v1','按采样方法的捕获量 GBDT 预测',captureProperties),
 skill_spatial_early_warning:analyticsSkill('spatial_idw','observed-capture-idw-v1','监测捕获量 IDW 插值（不生成疾病预警）',{category:captureProperties.category,methodName:{type:'string'},asOf:dateSchema,from:dateSchema}),
 skill_resistance_evaluation:analyticsSkill('resistance_prediction','observed-bioassay-records-v1','抗药性实测记录查询（无模型推断）',{speciesName:{type:'string'},pesticideName:{type:'string'},asOf:dateSchema}),
 skill_pathogen_risk:analyticsSkill('pathogen_apriori','pcr-record-pair-association-v1','PCR 检测比例与两项关联规则',{speciesName:{type:'string'},pathogenName:{type:'string'},asOf:dateSchema,from:dateSchema}),
 skill_transmission_risk:analyticsSkill('transmission_risk','observed-transmission-inputs-v1','传播风险输入统计（模型尚未验证）',{diseaseName:{type:'string'},asOf:dateSchema,from:dateSchema}),
 skill_satscan_spatial:analyticsSkill('satscan_cluster','conditional-poisson-circular-scan-v1','近似圆形空间扫描（非完整 SaTScan）',{category:captureProperties.category,methodName:{type:'string'},year:{type:'integer',minimum:1900,maximum:2100},month:{type:'integer',minimum:1,maximum:12},seed:{type:'integer',minimum:0,maximum:2147483647},numSimulations:{type:'integer',minimum:19,maximum:999},pThreshold:{type:'number',exclusiveMinimum:0,maximum:.1},maxClusterRadiusKm:{type:'number',exclusiveMinimum:0,maximum:500}}),skill_species_composition:analyticsSkill('species_clustering','method-separated-kmeans-capture-v1','物种构成、多样性与探索性 K-Means',{category:captureProperties.category,city:{type:'string'},district:{type:'string'},year:{type:'integer',minimum:1900,maximum:2100},asOf:dateSchema,methodName:{type:'string'}})
});
 const backtest=analyticsSkill('vector_backtest','rolling-past-origin-capture-backtest-v1','病媒捕获量滚动回测与季节基线对照',{asOf:dateSchema,methodName:{type:'string'},horizon:{type:'integer',minimum:1,maximum:12},model:{enum:['ar','gbdt']},dataWindow:{type:'integer',minimum:24,maximum:120}});
 backtest.inputSchema={...backtest.inputSchema,required:['asOf']};
 return [...definitions,{id:'skill_vector_backtest',aliases:['vector_backtest'],domain:'vector',requirementIds:[23,30],...backtest}];
}
