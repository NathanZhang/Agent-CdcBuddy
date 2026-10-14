import type {AgentDomain} from '@/contracts/dataset';
import type {SkillDefinition} from '@/contracts/skill-definition';
import {analyticsSkill} from './analytics-skill';
import {adaptRegionRows} from '@/application/geo/spatial-adapters';
import {executeMapDisplay} from '@/application/geo/map-service';
import {composeMap} from '@/application/geo/map-composer';
/** Small domain actions share the runner and strict schema; no second execution framework. */
const mapping:Record<AgentDomain,[string,string,string[]][]>= {
 vector:[['skill_population_dynamics','种群 ARIMA/LSTM 预测',['population']],['skill_density_forecast','气象融合密度 GBDT',['density']],['skill_resistance_evaluation','抗药性随机森林预测',['resistance']],['skill_transmission_risk','密度 PCR 人群暴露关联',['transmission']],['skill_resistance_evolution','条件贝叶斯抗性演化',['evolution']]],
 foodborne:[['skill_foodborne_cluster_detect','动态阈值与共同暴露聚集',['clusters']],['skill_foodborne_risk_forecast','食源性气象 LSTM 与扩散评估',['forecast']],['skill_molecular_trace','基因与供应链证据图谱',['trace']],['skill_foodborne_dashboard','动态监测与区域明细',['dashboard']]],
 env:[['skill_env_standardize','数据单位标化与插值审计',['clean']],['skill_water_safety_eval','饮用水 RF 评估与 LSTM 趋势',['water_risk','water_trend']],['skill_sewage_source','污水空间聚类与管网溯源',['sewage_source']],['skill_env_venue','场所健康映射与六维评级',['venue_risk','venue_grade']],['skill_air_climate_health_risk','人群暴露与72小时热浪预测',['exposure','heat']],['skill_river_basin_pollution_chain','跨介质相关与生态空间自相关',['cross_media','river_health']],['skill_env_scenario_simulation','显式参数环境干预推演',['scenario']]],
 chronic:[['skill_death_cert_qc','规则与异常检测质量校验',['quality']],['skill_mortality_cluster_rare','死亡 ARIMA、DBSCAN 与罕见死因监测',['mortality','rare']],['skill_chronic_risk_forecast','随访风险 GBDT 与并发症关联',['risk','complications']],['skill_chronic_screening_roi','肿瘤风险排序与筛查成本效果',['screening']],['skill_injury_attribution_tree','伤害聚类、决策树与聚集事件',['injury_clusters','injury_tree','injury_events']]]
};
const descriptions:Record<string,string>={
 skill_injury_attribution_tree:'analysis=injury_clusters实际执行K-Means，返回类型、年龄、时间、场所特征簇；injury_tree执行防护装备等特征的决策树与留出验证；injury_events执行同场所同类型24小时内至少5例的滚动聚集检测，返回事件、病例ID与原因线索。上述能力均已实现，不能只查询原始明细替代。',
 skill_mortality_cluster_rare:'analysis=mortality执行死亡时序ARIMA、区县死亡率与DBSCAN；rare执行罕见死因滚动聚集识别并返回病例依据，默认窗口24小时，查询历史范围不等于窗口。',
 skill_env_venue:'analysis=venue_risk返回水质/微气候与健康症状关联、岭回归及验证；venue_grade按已配置六维等权规则计算总分和A/B/C评级，返回每个场所的分项、总分、等级和规则版本，无需另写SQL计算。',
 skill_molecular_trace:'实际计算cgMLST距离、候选簇，并在molecular.networkGraph.nodes返回分离株明细，caseLinks返回病例明细，exposureDetails返回食品暴露明细，同时返回批次与供应商边、暴露攻击率和相对风险。数据充分时一次调用即可完成基因、病例、食品与供应链证据展示，无需事实表间JOIN。',
 skill_foodborne_dashboard:'一次返回区域病例分布地图、时间趋势、食品构成、聚集事件和病例明细。drilldownCity=郑州市可同时附该地市下钻明细表；省级地图范围不变，无需额外病例点图层。按批准范围读取，已有全部看板与明细输出时无需重复查询。',
 skill_chronic_screening_roi:'针对肿瘤随访队列计算高风险清单，同时汇总肿瘤登记候选和区县人口；返回实际筛查人数、检出率、成本、假设避免治疗费用和收益成本比、留出验证。已包含地域和人口明细，无需额外SQL。avoidedCostFraction是明确标注的假设参数，默认0.25，不能把假设收益当作真实节省。',
 skill_river_basin_pollution_chain:'analysis=cross_media计算水体、土壤、作物污染物Pearson相关及富集情况；river_health计算实际邻接权重的Moran I和生态健康关联，返回断面明细及邻接边。',
 skill_air_climate_health_risk:'analysis=exposure计算活动加权人群空气暴露及LSTM趋势；heat计算热浪与死亡率的GBDT和未来72小时预测、脆弱人群预警及验证。返回实际模型输出，无需另行查询才能显示。'
};
const reqs:Record<string,number[]>={skill_env_standardize:[43],skill_sewage_source:[47],skill_env_venue:[48,49],skill_foodborne_dashboard:[40],skill_resistance_evolution:[32]};
export function assessmentSkills(domain:AgentDomain):SkillDefinition[]{return mapping[domain].map(([id,name,actions])=>{
 const base=analyticsSkill(domain+'_assessment',id==='skill_foodborne_dashboard'?'foodborne-dashboard-assessment-v1':domain+'-validated-assessment-v1',name,{analysis:{enum:actions},category:{enum:['蚊','蝇','蟑螂','鼠','蜱','恙螨']},dataWindow:{type:'integer',minimum:1,maximum:120},pathogenId:{type:'string'},drilldownCity:{type:'string',description:'看板内部下钻明细表的地市，保留原始省级分布；只在已授权返回数据中选择，不改变查询范围'},diseaseName:{type:'string',description:'已批准疾病名称；环境流域宽表仅支持肝癌发病率'},clusterId:{type:'string'},sampleLimit:{type:'integer',minimum:2,maximum:100},from:{type:'string'},to:{type:'string'},asOf:{type:'string'},methodName:{type:'string'},speciesName:{type:'string'},pesticideName:{type:'string'},forecastMonths:{type:'integer',minimum:1,maximum:12},applications:{type:'integer',minimum:0,maximum:3},minCases:{type:'integer',minimum:2,maximum:100},windowHours:{type:'integer',minimum:1,maximum:168,description:'滚动聚集判定窗口（小时），默认24小时；与查询历史起止日期不同，不要用整段查询天数换算。'},threshold:{type:'integer',minimum:0,maximum:100},avoidedCostFraction:{type:'number',minimum:0,maximum:1,description:'假设可避免治疗成本比例，默认0.25；仅用于情景收益成本比，非实际节省'},riskThreshold:{type:'number',minimum:0,maximum:1},reductionPercentage:{type:'number',minimum:0,maximum:100},sourceShare:{type:'number',minimum:0,maximum:1},healthBeta:{type:'number',minimum:0,maximum:.1}},domain);
 return {id,domain,aliases:[],requirementIds:reqs[id]??[],...base,...(descriptions[id]?{description:descriptions[id]}:{}),execute:async(args,ctx)=>{
  const result=await base.execute({...args,analysis:args.analysis??actions[0]},ctx);
  if(id==='skill_foodborne_dashboard'&&result.status==='SUCCESS'){
   const payload=result.payload as any;
   const output=adaptRegionRows(payload.data.cities,{valueKey:'cases',unit:'例',labelKey:'city'},{runId:ctx.runId,callId:ctx.callId??ctx.runId,skillId:id,method:base.method!,datasetRefs:result.datasets??[],scopeFingerprint:ctx.approvedIntent!.fingerprint,sourceCRS:'EPSG:4490'});
   payload.spatialOutputs=[output];
   const regionCodes=[...new Set(output.geometry.features.map(f=>String(f.properties?.regionCode)))];
   if(regionCodes.length){const map=await executeMapDisplay({regionCodes:regionCodes.length>10?['410000']:regionCodes,boundaryLevels:['city']},ctx);payload.data.mapComposition=composeMap(map.payload!,[{id:'case-distribution',outputRef:{runId:ctx.runId,callId:output.source.callId,outputId:output.outputId},scopeFingerprint:output.source.scopeFingerprint,rendering:'area'}],[output],{authorizedRunIds:[ctx.runId],cameraPolicy:'fitDisplayRegion'});}
  }
  return result;
 }} as SkillDefinition;
});}
