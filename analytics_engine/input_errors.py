"""User-facing input failures. Never include SQL, file paths or tracebacks in results."""
import re

TABLE_LABELS = {
 'fact_vector_exposure':'病媒气象、人群暴露或抗性基因资料', 'fact_monitoring':'病媒监测记录',
 'fact_pathogen_detection':'病原检测记录', 'fact_insecticide_resistance':'抗药性生测记录',
 'fact_foodborne_case':'食源性病例', 'fact_food_forecast_inputs':'食源性气象、人口及流动资料',
 'fact_food_exposure':'食品共同暴露及供应链资料', 'fact_outbreak_event':'食源性事件记录',
 'fact_env_raw_samples':'环境原始采样记录', 'fact_water_monitoring':'饮用水监测记录',
 'dim_env_stations':'环境监测站点资料', 'fact_sewage_monitoring':'污水监测记录',
 'fact_sewage_network':'污水管网拓扑', 'fact_venue_scores':'公共场所评分资料',
 'fact_public_venue_inspection':'公共场所检查记录', 'fact_air_climate_monitoring':'空气与气象监测记录',
 'fact_env_activity':'人群活动与暴露资料', 'fact_env_intervention_inputs':'环境干预情景输入',
 'fact_river_basin_monitoring':'流域监测记录', 'fact_river_adjacency':'河段邻接资料',
 'fact_chronic_followup':'慢病随访记录', 'fact_chronic_cases':'慢病登记记录',
 'dim_districts':'区县人口及地理资料', 'fact_death_registry':'死亡登记记录',
 'fact_injury_surveillance':'伤害监测记录', 'fact_injury_risk_inputs':'伤害防护与环境资料',
}
MESSAGES = {
 'ONE_SAMPLING_METHOD_REQUIRED':'请选择一种采样方法，不能混合不同方法训练同一预测模型。',
 'MATCHED_WEATHER_HISTORY_REQUIRED':'气象融合预测需要至少18个月与监测记录匹配的温度和降雨数据。',
 'SAMPLING_EFFORT_REQUIRED':'监测记录缺少有效采样投入分母，无法计算单位采样投入捕获量。',
 'FORECAST_REQUIRES_18_FINITE_PERIODS':'预测需要至少18个有效时段，且指标不能包含缺失或无效数值。',
 'FORECAST_CALENDAR_REQUIRED':'预测时序存在缺测时段或未覆盖指定截止期，请补齐对应月份或调整时间范围。',
 'WATER_TREND_REQUIRES_18_MONTHS':'饮用水趋势预测需要同一站点至少18个月的有效浊度记录。',
 'FOOD_FORECAST_REQUIRES_18_MATCHED_MONTHS':'食源性预测需要至少18个月病例与气象、人口及流动数据，并覆盖指定截止月份。',
 'CLASSIFIER_REQUIRES_TWO_CLASSES_AND_16_ROWS':'分类模型需要至少16条有效样本，且训练段必须包含至少两类结局。',
 'VENUE_HEALTH_MAPPING_REQUIRES_FOUR_VENUES':'场所健康关联分析需要足够的匹配场所记录，用于分别训练和验证。',
 'SEWAGE_STATION_COORDINATES_REQUIRED':'污水空间分析缺少匹配站点的经纬度，请补齐站点位置。',
 'MATCHED_ACTIVITY_AIR_DATA_REQUIRED':'未找到同日期匹配的人群活动与空气监测数据。',
 'RIVER_ADJACENCY_REQUIRED':'缺少所选河段之间的有效邻接关系，无法计算空间关联。',
 'SIGNAL_INPUTS_REQUIRED':'当前范围内没有可用于预警判断的有效监测数据。',
 'EXPOSURE_OR_GENOTYPE_DATA_REQUIRED':'当前范围内缺少人群暴露或抗性基因检测资料。',
 'INVALID_EXOGENOUS_HISTORY':'协变量存在缺失、无效数值，或与预测目标的时段不一致。',
 'NO_VALID_SIMILAR_SAMPLE_FOR_IMPUTATION':'同类指标中没有有效参照样本，无法进行插值补全。',
 'VALID_VISITOR_DENOMINATOR_REQUIRED':'场所健康关联需要有效的到访人数分母，不能为零或负数。',
 'UNKNOWN_UNIT_CONVERSION':'采样单位尚无已配置的换算关系，请核对单位或补充换算规则。',
}

class InputDataError(ValueError):
 def __init__(self, code, reason):
  super().__init__(reason); self.code=code; self.reason=reason

def input_failure(error):
 """Return only known input failures; unexpected program errors must still fail."""
 message=str(error)
 if isinstance(error, InputDataError): code,reason=error.code,error.reason
 elif message in MESSAGES: code,reason=message,MESSAGES[message]
 elif (match:=re.search(r'no such table:\s*(?:main\.)?([\w]+)',message)):
  name=match[1]; code='MISSING_INPUT_TABLE'
  reason='当前数据源缺少'+TABLE_LABELS.get(name,'本项分析所需的数据表')+'，请补充对应资料，或显式切换到Mock验收模式。'
 elif 'no such column:' in message or 'has no column named' in message or 'cannot join using column' in message:
  code,reason='MISSING_INPUT_COLUMN','当前数据源缺少本项分析必需的字段，请核对数据结构并补齐字段。'
 else:return None
 return {'status':'INSUFFICIENT_DATA','reason':reason,'inputCode':code,'qualityFlags':['model-inputs-missing-no-fabricated-estimate']}

def public_error(message):
 if re.search(r'\bSELECT\b|no such (?:table|column)|Execution failed on sql|Traceback|sqlite',str(message),re.I):
  return '数据读取失败，请检查当前数据源及所需字段；详细诊断请查看服务端日志。'
 return str(message)
