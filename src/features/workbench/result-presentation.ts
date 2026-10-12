export const fieldLabels:Record<string,string>={status:'执行状态',asOf:'分析截止日期',start:'起始时间',end:'末次观测时间',periods:'有效观测月数',city:'地市',effortRecords:'有投入分母的记录数',samplingUnitRatio:'捕获 / 登记投入（含义未验证）',nonnegativeConstraintApplied:'已应用非负约束',factorWeights:'实际模型特征权重',groups:'分组结果',methodName:'采样方法',trainingWindow:'训练时间窗',history:'历史观测',forecasts:'预测',period:'月份',value:'数值',captureCount:'捕获总数',sampleCount:'样本量',trainingR2:'训练拟合 R²',trainingRmse:'训练 RMSE',unit:'单位',items:'结果明细',monitoringPoints:'监测点',grid:'IDW 网格',clusters:'空间簇',associationRules:'关联规则',qualityFlags:'方法限制',riskScore:'传播评分',pathogenPositiveRate:'PCR 记录阳性比例 (%)'};
export const qualityLabels:Record<string,string>={'monitoring-history-too-stale':'末次观测距截止点超过12个月，停止生成预测。','missing-months-recursively-extrapolated':'末次观测与截止点之间有缺测月份，模型递归外推后才生成未来月份预测；这些外推值不作为观测记录。','capture-count-not-standard-density':'统计单位是每条记录的捕获量，尚不能代表标准密度。','training-fit-is-not-backtest':'训练拟合指标不能证明未来预测效果。','sampling-effort-unavailable':'部分记录缺少有效采样投入分母。','sampling-unit-semantics-not-validated':'采样投入字段的计量含义仍需专业确认。','partial-method-coverage':'部分采样方法的数据不足，未生成预测。','gaps-in-monitoring-calendar':'监测月份有缺口。','insufficient-contiguous-training-pairs':'连续训练月份不足。','validated-transmission-model-unavailable':'尚无经过验证的传播风险模型。','population-exposure-unavailable':'缺少人口暴露数据。','pcr-record-positivity-not-individual-prevalence':'PCR 记录阳性比例不等于个体感染率。','recorded-classification-not-ml-prediction':'此为数据库记录的生测分类，不是模型预测。','no-validated-rotation-recommendation':'尚无经过验证的用药轮换建议。','approximate-circular-scan-not-full-satscan':'仅实现近似圆形扫描，尚未完成完整 SaTScan。','record-exposure-not-standard-sampling-effort':'空间扫描以记录数作暴露分母，尚不能代表标准采样投入。','exploratory-clusters-not-risk-classes':'聚类仅用于探索，簇编号不代表风险等级。','interpolation-not-disease-risk':'捕获量插值不代表疾病传播风险。','no-interpolation-uncertainty-evaluation':'插值不确定性尚未评估。','pair-associations-not-causal-or-disease-risk':'关联规则不代表因果关系或疾病风险。','not-full-apriori-itemset-search':'仅实现两项关联搜索，尚未完成完整 Apriori。'};

Object.assign(fieldLabels, {
 label:'分组 / 点位',endDate:'末次观测日期',lc50Records:'有 LC50 的记录数',positiveCases:'阳性病例数',pathogenRecorded:'登记病原检出数',coliformDetected:'大肠菌群检出数',observedDays:'观测天数',samplingUnit:'登记采样投入',
 eventTitle:'事件名称',startTime:'开始时间',endTime:'结束时间',hospitalizedCount:'住院病例数',confirmedPathogen:'登记病原',disposalStatus:'处置状态',caseId:'病例编号',age:'年龄',gender:'性别',visitDate:'就诊日期',symptomOnsetTime:'发病时间',diningPlaceType:'进食场所类型',suspectedFood:'登记可疑食品',isPathogenPositive:'病原阳性标记',
 turbidity:'浊度（NTU）',sampleType:'水样类型',freeChlorine:'游离余氯',totalColiforms:'总大肠菌群',isStandardMet:'登记达标标记',norovirusLoad:'诺如病毒载量',pediatricRespOutpatient:'儿科呼吸道门诊量',pm25:'PM2.5（μg/m³）',deathCertId:'证明书编号',underlyingCause:'根本死因',icd10Code:'ICD 编码',qcStatus:'登记质控状态',
 speciesName:'物种名称',latinName:'拉丁学名',category:'类别',totalCount:'捕获总数',count:'数量',percentage:'占比',cityBreakdown:'地市分布',dominantSpecies:'优势物种',shannonWienerIndex:'多样性指数 H′',
 district:'区县',date:'日期',dateId:'监测日期',month:'月份',year:'年份',total:'合计',name:'名称',n:'记录数',recordCount:'记录数',totalRecords:'记录总数',
 clusterId:'簇编号',clusterName:'聚类名称',samplePointCount:'采样点数',coveredCities:'覆盖地市',meanCapture:'平均捕获量',members:'成员明细',
 lat:'纬度',lon:'经度',latitude:'纬度',longitude:'经度',method:'分析方法',metrics:'评估指标',trainingWindow:'训练时间窗',
 lower:'下限',upper:'上限',observed:'实测值',predicted:'预测值',baseline:'基线',model:'模型',mae:'平均绝对误差',rmse:'均方根误差',r2:'决定系数 R²',r2Score:'决定系数 R²',
 locationId:'地点编号',speciesId:'物种编号',methodId:'方法编号',sampleId:'样本编号',monitoringId:'监测编号',
 pathogenName:'病原体名称',pathogen:'病原体',positiveCount:'阳性数量',testedCount:'检测数量',positivityRate:'阳性比例',pesticideName:'药剂名称',resistanceLevel:'抗药性等级',
 weatherTemp:'温度',weatherHumidity:'相对湿度',temperature:'温度',humidity:'相对湿度',density:'密度',
 nodes:'样本节点',edges:'关联关系',source:'来源',target:'目标',distance:'距离',alleleDistance:'等位基因距离',threshold:'阈值',
 plantId:'厂站编号',plantName:'厂站名称',observedDates:'有效观测天数',optimalLagWindow:'最佳滞后窗口',lagCorrelationTrend:'滞后相关分析',lagDays:'滞后天数',pairedDates:'配对天数',pearsonCorrelation:'皮尔逊相关系数',significanceP:'显著性 P 值',reverseTracingSources:'溯源候选',
 totalSamples:'样本总数',sections:'监测断面',sectionName:'断面名称',waterPb:'水体铅浓度',waterCd:'水体镉浓度',soilCd:'土壤镉浓度',cropPb:'作物铅浓度',spatialAutocorrelation:'空间自相关',globalMoransI:'全局莫兰指数',permutationP:'置换检验 P 值',permutations:'置换次数',seed:'随机种子',weightNormalization:'权重归一化',weightSource:'权重来源',
 totalDeaths:'死亡记录数',observedMonthlyDeaths:'月度死亡记录',deaths:'死亡记录数',dbscanSpatialClusters:'空间聚类',rareMortalityClustersDetected:'罕见死因聚集候选',rareClusterCount:'候选簇数',
 totalInjuriesMonitored:'伤害记录数',injuryTypeComposition:'伤害类型构成',recordedCauseComposition:'登记原因构成',clusterIncidentsDetected:'候选聚集事件',decisionTreeAttribution:'决策树归因',
 caseCount:'病例数',reviewRequired:'需要复核',message:'说明',reason:'原因',warnings:'复核提示',passedRulesCount:'通过规则数',totalRulesCount:'规则总数',
 jobs:'任务列表',jobId:'任务编号',ticketId:'工单编号',createdAt:'创建时间',updatedAt:'更新时间',result:'结果',payload:'结果内容',error:'错误信息',code:'编码',definition:'指标定义',evaluationKind:'评估方式',datasetIds:'数据集编号',
 foodName:'食品名称',foodCategory:'食品类别',foodType:'食品类型',injuryType:'伤害类型',injuryCauseFactor:'登记原因',injuryPlace:'发生场所',deathDate:'死亡日期',monitoringDate:'监测日期',
 trainingR2:'训练拟合 R²',trainingRmse:'训练均方根误差',support:'支持度',confidence:'置信度',lift:'提升度',antecedent:'前项',consequent:'后项',
});

const statuses:Record<string,string>={IDLE:'等待指令',SUCCESS:'分析完成',NO_DATA:'暂无数据',INSUFFICIENT_DATA:'数据不足',FAILED:'执行失败',REVIEW_REQUIRED:'待专业复核',CANCELLED:'已取消',RUNNING:'执行中',WAITING_REVIEW:'等待审批',OPEN:'待处理',COMPLETED:'已完成',PENDING:'待处理',APPROVED:'已通过',REJECTED:'已拒绝'};
const methods:Record<string,string>={
 'method-separated-kmeans-capture-v1':'按采样方法分组的物种统计与探索性聚类',
 'autoregression-seasonal-capture-v1':'月捕获量自回归预测', 'gradient-boosting-capture-v1':'捕获量梯度提升预测（GBDT）',
 'observed-capture-idw-v1':'监测捕获量反距离加权插值（IDW）','observed-bioassay-records-v1':'生物测定实测记录',
 'pcr-record-pair-association-v1':'PCR 检测记录与两项关联分析','observed-transmission-inputs-v1':'传播风险输入统计',
 'conditional-poisson-circular-scan-v1':'条件泊松近似圆形空间扫描', 'rolling-past-origin-capture-backtest-v1':'捕获量滚动回测与季节基线对照',
 'allele-distance-single-link-v1':'等位基因距离与单链接聚类','food-exposure-window-candidates-v1':'食品共同暴露时间窗分析','recorded-food-case-summary-v1':'食品与已报告病例统计',
 'observed-water-summary-v1':'实测水质统计','calendar-aligned-pearson-v1':'按日历对齐的滞后相关分析','descriptive-metals-moran-v1':'重金属描述统计与空间自相关',
 'death-certificate-rule-candidates-v1':'死亡证明书规则复核','district-centroid-dbscan-v1':'区县中心点空间聚类','injury-observed-counts-v1':'伤害记录描述统计','icd10-dictionary-candidate-v1':'疾病编码字典候选检索',
};
const units:Record<string,string>={'captures/record':'捕获量 / 记录',observed:'实测数据',mock:'模拟数据',computed:'已计算',unvalidated:'未经验证',synthetic:'合成数据评估','real-backtest':'真实数据回测',none:'未归一化','user-supplied-unvalidated-topology':'用户提供（拓扑未经验证）'};
export const domainLabels:Record<string,string>={vector:'病媒生物',foodborne:'食源性疾病',env:'环境健康',chronic:'慢病与死因'};
const camelKey=(key:string)=>key.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase());
export function fieldLabel(key:string):string {return fieldLabels[key] ?? fieldLabels[camelKey(key)] ?? (/[\u4e00-\u9fff]/.test(key)?key:`扩展字段（${key}）`);}
export function statusLabel(status:string):string {return statuses[status] ?? `状态：${status}`;}
export function methodLabel(method:string):string {return methods[method] ?? (/[\u4e00-\u9fff]/.test(method)?method:'分析方法（详见技术信息）');}
export function qualityLabel(flag:string):string {return qualityLabels[flag] ?? (/[\u4e00-\u9fff]/.test(flag)?flag:`待核实的方法限制（${flag}）`);}
export function formatValue(value:unknown,key=''):string {
 if(value===null||value===undefined||value==='')return '未提供 / 未评估';
 if(typeof value==='boolean')return value?'是':'否';
 if(typeof value==='number'){
  if(!Number.isFinite(value))return '未提供 / 未评估';
  const normalized=camelKey(key);
  if(['percentage','positivityRate','pathogenPositiveRate'].includes(normalized))return `${value.toFixed(2)}%`;
  // Preserve meaningful small scientific values instead of rounding them to zero.
  if(value!==0&&Math.abs(value)<0.0001)return value.toExponential(2);
  return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:Number.isInteger(value)?0:4}).format(value);
 }
 if(typeof value==='string'){
  if(camelKey(key)==='status'||camelKey(key)==='auditStatus')return statusLabel(value);
  if(key==='method')return methodLabel(value);
  return ['unit','origin','evaluationKind','weightNormalization','weightSource'].includes(camelKey(key))?(units[value]??value):value;
 }
 return JSON.stringify(value);
}

Object.assign(qualityLabels, {
 'select-one-sampling-method':'存在多种采样方法，请指定一种方法后再插值。',
 'method-specific-errors-not-pooled':'误差按地市与采样方法分别计算，未混合汇总。',
 'capture-forecast-does-not-validate-standard-density-requirement':'捕获量预测不能证明满足标准密度预测要求。',
 'exploratory-lag-selection-unadjusted-p':'滞后窗口为探索性筛选，P 值未经多重比较校正。',
 'hospital-linkage-unvalidated':'与医院病例的关联尚未经验证。','missing-dates-not-imputed':'缺测日期未进行填补。',
 'no-pipeline-topology-no-source-lock':'缺少管网拓扑，无法确定污染来源。','no-validated-river-topology':'河流拓扑尚未经验证。',
 'no-causal-transfer-inference':'结果不支持因果传递推断。','no-health-risk-estimate':'未进行健康风险估算。',
 'centroids-not-individual-death-locations':'位置为区县中心点，不是个人死亡地点。','clusters-not-risk-or-causality':'聚类不代表风险等级或因果关系。',
 'rare-disease-code-candidate-requires-review':'罕见死因编码候选需专业复核。','no-arima-no-population-rate':'未运行时间序列预测，也未计算人口发生率。',
 'recorded-causes-not-causal-estimates':'登记原因不能作为因果估计。','no-trained-decision-tree':'尚无训练完成的决策树。',
 '24-hour-candidates-require-review':'24 小时内聚集候选需进一步复核。',
});

Object.assign(qualityLabels, {
 'no-unexposed-controls-no-causal-attribution':'缺少未暴露对照，不能进行因果归因。','reported-food-not-confirmed-source':'已报告食品不等于已确认感染来源。',
 'random-forest-unavailable':'随机森林模型尚不可用。','kriging-unavailable':'克里金插值尚不可用。','clinical-review-required':'需专业人员复核。','accuracy-unvalidated':'准确率尚未经验证。',
 'rules-require-human-review':'规则命中结果需人工复核。','no-labelled-benchmark-no-accuracy':'缺少带标签基准，无法评估准确率。','sample-limited-no-automatic-interception':'样本有限，不自动拦截记录。',
 'place-type-not-venue-identity':'场所类型不能确定具体场所身份。','candidate-not-confirmed-outbreak':'候选聚集不代表已确认暴发。','no-satscan-or-relative-risk-baseline':'未运行空间扫描，也未建立相对风险基线。',
 'incompatible-allele-schema':'等位基因分型结构不兼容。','single-link-not-outbreak-confirmation':'单链接聚类不能确认暴发。','typing-schema-unvalidated':'分型结构尚未经验证。','sample-limited':'当前分析样本有限。',
});
Object.assign(fieldLabels, {
 totalCases:'病例总数',foodRiskRanking:'食品关联病例统计',oddsRatio:'比值比',attributableRiskPercent:'归因风险百分比',dynamicClusters:'候选聚集',
 totalCertificatesChecked:'已检查证明书数',validCertificatesCount:'未触发规则的证明书数',conflictCasesCount:'待复核证明书数',qcMetrics:'质控指标',errorDetectionRate:'错误检出率',logicalAccuracyRate:'逻辑准确率',qcRulesAppliedCount:'质控规则数',flaggedConflictCases:'待复核记录',
 homologousGroupsCount:'同源候选组数',riskLevel:'风险等级',breakdown:'分项结果',measuredAverageCapture:'实测平均捕获量',captureGroups:'捕获量分组',transactionCount:'检测记录数',summaryAdvice:'综合建议',highRiskLocations:'风险地点候选',
 availableMethods:'可选采样方法',alerts:'预警记录',window:'观测时间窗',id:'编号',street:'街道',statistics:'统计概况',totalMonitoringSites:'监测点总数',totalObservedCaptures:'实测捕获总数',highRiskCities:'高风险地市候选',
 horizon:'预测步数',evaluatedPairs:'有效评估对数',datasetId:'数据集编号',origin:'数据来源',
});
