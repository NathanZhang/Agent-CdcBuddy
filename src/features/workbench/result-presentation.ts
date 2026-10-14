export const fieldLabels:Record<string,string>={status:'执行状态',asOf:'分析截止日期',start:'起始时间',end:'末次观测时间',periods:'有效观测月数',city:'地市',effortRecords:'有投入分母的记录数',samplingUnitRatio:'捕获 / 登记投入（含义未验证）',nonnegativeConstraintApplied:'已应用非负约束',factorWeights:'实际模型特征权重',groups:'分组结果',methodName:'采样方法',trainingWindow:'训练时间窗',history:'历史观测',forecasts:'预测',period:'月份',value:'数值',captureCount:'捕获总数',sampleCount:'样本量',trainingR2:'训练拟合 R²',trainingRmse:'训练 RMSE',unit:'单位',items:'结果明细',monitoringPoints:'监测点',grid:'IDW 网格',clusters:'空间簇',associationRules:'关联规则',qualityFlags:'方法限制',riskScore:'传播评分',pathogenPositiveRate:'PCR 记录阳性比例 (%)'};
export const qualityLabels:Record<string,string>={'dataset-specific-validation-not-external-validation':'模型指标来自当前数据集的留出验证，不代表外部验证或临床效果。','engineering-workflow-not-validated-risk-policy':'任务、审批与复测流程可追踪；风险阈值仍需专业审核。','monitoring-history-too-stale':'末次观测距截止点超过12个月，停止生成预测。','missing-months-recursively-extrapolated':'末次观测与截止点之间有缺测月份，模型递归外推后才生成未来月份预测；这些外推值不作为观测记录。','capture-count-not-standard-density':'统计单位是每条记录的捕获量，尚不能代表标准密度。','training-fit-is-not-backtest':'训练拟合指标不能证明未来预测效果。','sampling-effort-unavailable':'部分记录缺少有效采样投入分母。','sampling-unit-semantics-not-validated':'采样投入字段的计量含义仍需专业确认。','partial-method-coverage':'部分采样方法的数据不足，未生成预测。','gaps-in-monitoring-calendar':'监测月份有缺口。','insufficient-contiguous-training-pairs':'连续训练月份不足。','validated-transmission-model-unavailable':'尚无经过验证的传播风险模型。','population-exposure-unavailable':'缺少人口暴露数据。','pcr-record-positivity-not-individual-prevalence':'PCR 记录阳性比例不等于个体感染率。','recorded-classification-not-ml-prediction':'此为数据库记录的生测分类，不是模型预测。','no-validated-rotation-recommendation':'尚无经过验证的用药轮换建议。','approximate-circular-scan-not-full-satscan':'仅实现近似圆形扫描，尚未完成完整 SaTScan。','record-exposure-not-standard-sampling-effort':'空间扫描以记录数作暴露分母，尚不能代表标准采样投入。','exploratory-clusters-not-risk-classes':'聚类仅用于探索，簇编号不代表风险等级。','interpolation-not-disease-risk':'捕获量插值不代表疾病传播风险。','no-interpolation-uncertainty-evaluation':'插值不确定性尚未评估。','pair-associations-not-causal-or-disease-risk':'关联规则不代表因果关系或疾病风险。','not-full-apriori-itemset-search':'仅实现两项关联搜索，尚未完成完整 Apriori。'};

Object.assign(fieldLabels, {
 highRiskList:'高风险筛查清单',regionalRegistry:'肿瘤登记与人口分布',registeredCandidates:'登记候选人数',screened:'实际筛查人数',detected:'检出人数',detectionRate:'检出比例',screeningCostYuan:'筛查总成本（元）',costPerDetectedCaseYuan:'每例检出成本（元）',estimatedTreatmentCostYuan:'检出对象登记治疗费用（元）',avoidedCostFraction:'假设可避免费用比例',assumedBenefitYuan:'假设避免费用（元）',benefitCostRatio:'假设收益成本比',eventProbability:'随访事件概率',clearanceRule:'预警解除规则',clearBelow:'解除阈值',minRetestHours:'最短复测间隔（小时）',retestMeasurement:'复测测量口径',approval:'专业审批',tickets:'处置工单',retests:'复测证据',notifications:'通知投递状态',archiveStatus:'报告归档状态',presentationStatus:'展示状态',
 speciesCount:'物种数量',cityCount:'覆盖地市数',clusterCount:'聚类数量',
 LC50:'LC50',lc50:'LC50',correctedMortality:'校正死亡率',
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
 'death-certificate-rule-candidates-v1':'死亡证明书规则复核','district-centroid-dbscan-v1':'区县中心点空间聚类','injury-observed-counts-v1':'伤害记录描述统计','icd10-dictionary-candidate-v1':'疾病编码字典候选检索','icd10-iris-mortality-v2':'证明书解析与 Iris/MUSE ICD-10 规则接入',
};
const units:Record<string,string>={'captures/record':'捕获量 / 记录',observed:'实测数据',mock:'模拟数据',computed:'已计算',unvalidated:'未经验证',synthetic:'合成数据评估','real-backtest':'真实数据回测',none:'未归一化','user-supplied-unvalidated-topology':'用户提供（拓扑未经验证）'};
export const domainLabels:Record<string,string>={vector:'病媒生物',foodborne:'食源性疾病',env:'环境健康',chronic:'慢病与死因'};
const camelKey=(key:string)=>key.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase());
export function fieldLabel(key:string):string {return fieldLabels[key] ?? fieldLabels[camelKey(key)] ?? (/[\u4e00-\u9fff]/.test(key)?key:`扩展字段（${key}）`);}
export function statusLabel(status:string):string {return (status==='SUBMITTED'?'待审核':statuses[status]) ?? `状态：${status}`;}
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

Object.assign(fieldLabels,{totalSamples:'本次统计记录数',matchedSamples:'范围内总记录数',matchedStations:'范围内独立站点数',returnedSamples:'本次返回记录数',sampleLimit:'返回记录上限',truncated:'结果已截断',validValueCounts:'各指标有效样本数',complianceKnownSamples:'达标状态已知样本数',totalStationsSampled:'本次独立站点数',overallComplianceRate:'已知状态样本达标率',passRate:'已知状态样本达标率 (%)',healthRiskSummary:'库内风险值统计（未重算）',carcinogenicRiskAverage:'已登记致癌风险均值',nonCarcinogenicHqAverage:'已登记危害商均值',maxCarcinogenicRiskCR:'已登记致癌风险最大值',maxHazardQuotientHQ:'已登记危害商最大值',leadVal:'铅有效样本数',cadmiumVal:'镉有效样本数',arsenicVal:'砷有效样本数',chloroformVal:'三氯甲烷有效样本数',carcinogenicRisk:'致癌风险有效样本数',hazardQuotient:'危害商有效样本数'});

Object.assign(qualityLabels,{'recorded-risk-values-not-recomputed':'仅统计已登记风险值，未重新计算健康风险。','risk-policy-unvalidated':'风险分级政策尚未验证。','sample-limit-applied':'仅统计本次返回的有限样本，请核对总匹配记录数。','missing-measurement-values':'存在缺失或无效指标，各均值按有效样本计算。','invalid-measurement-values-excluded':'已剔除非有限或负的指标值。','legacy-visualization-unconfigured':'旧技能尚未配置图表字段，本次显示明细表。'});

Object.assign(fieldLabels,{artifactRef:'科学工件引用',artifactId:'工件编号',contentHash:'内容校验值',scopeFingerprint:'批准范围标识',measurementDefinition:'测量定义',frequency:'时间频率',objectKeys:'分析对象键',dependencies:'上游工件',expiresAt:'有效期截止',preview:'有限数据预览',locationKey:'稳定地点标识',sourceLocationId:'来源地点主键',visitId:'已审核访次标识',effortValue:'访次投入',effortUnit:'投入单位',legacySamplingUnit:'原始投入字段（含义未确认）',matchedRecords:'匹配记录总数',returnedRecords:'工件记录数',complete:'来源是否完整',memberCount:'成员地点数',rowCount:'矩阵行数',rowKeys:'矩阵地点键',columns:'特征列及单位',values:'矩阵数值',seriesCount:'序列数',totalPeriods:'日历期数',recordId:'来源监测记录编号'});
Object.assign(qualityLabels,{'legacy-visit-unresolved':'旧记录尚未确认采样访次，不按日期与地点猜测合并。','legacy-effort-semantics-unvalidated':'旧投入字段未确认单位，不用于标准密度分母。','source-truncated':'来源超过记录预算，下游科学计算拒绝不完整来源。','invalid-capture-measurements':'存在无效捕获值。','missing-feature-values':'特征缺失，模型消费前需要处理。','missing-periods-or-effort-not-imputed':'缺测或投入不足保留为空，没有补零。','partial-calendar-periods':'首尾周或月只覆盖部分日期。','human-reviewed-effort-not-professional-density-validation':'投入由人工审核登记；专业密度定义仍需业务验收。'});

Object.assign(fieldLabels,{acceptance:'验收核对点',limitation:'适用范围与限制',steps:'执行步骤',skillId:'处理功能',args:'执行条件',validation:'留出验证',trainEnd:'训练截止',testEnd:'验证截止',trainRows:'训练样本数',testRows:'验证样本数',accuracy:'准确率',mape:'平均绝对百分比误差',training:'训练信息',features:'输入特征',assumptions:'计算假设',models:'模型结果',riskLevel:'风险等级',expectedCases:'预期病例数',expectedPer100k:'每十万人预期病例数',mobilityProxy:'人口流动代理指标',spreadIndex:'传播指数',stations:'监测站点',cities:'城市汇总',districts:'区县汇总',trend:'时间趋势',foodTop10:'食品类别前十',events:'事件明细',details:'记录明细',filters:'筛选范围',refreshedAt:'刷新时间',caseLinks:'病例关联',associations:'暴露关联',causeGraph:'死因链关系校验',supportedEdges:'已支持关系',unsupportedEdges:'待复核关系',rootPosition:'候选根本死因位置',ruleVersion:'规则版本',selectionSupported:'规则是否支持候选',knowledge:'知识条目',interventions:'干预建议',historicalMatches:'历史案例',thresholdSignal:'阈值预警',trendSignal:'趋势预警',linkedSignal:'联动预警',compositeIndex:'综合指数',recipientLevels:'接收层级',job:'核查任务'});

Object.assign(fieldLabels,{cases:'病例数',icd10_category:'死因分类',ypll:'潜在减寿年数',arsenicMgL:'砷浓度（mg/L）',complianceFraction:'达标比例',captures:'捕获量'});

Object.assign(fieldLabels,{criterion:'核查触发指标'});

Object.assign(fieldLabels,{parsedCertificate:'原文解析',categoryCandidates:'三位类目候选',candidateCodes:'候选类目',candidates:'候选来源',sourceRow:'原表行号',sourceSheet:'原工作表',sourceFile:'源文件',sourceSha256:'源文件校验值',sourceEdition:'源表版本',sourceChapter:'原表章节',categoryCount:'类目条数',granularity:'编码粒度',assertion:'诊断表述',position:'证明书位置',sourceField:'原文字段',sourceStart:'原文起始位置',originalInput:'原始输入',inputSha256:'输入校验值',explicitCodes:'原文中的编码',terminalCodeValidated:'细分编码是否验证',durations:'病程',rows:'解析行',engineResult:'Iris执行结果',selectionStatus:'引擎状态',inputIssues:'待核对信息',reportedEdges:'原文填报关系',provenance:'版本和来源',expectedCodingVersion:'要求的编码版本',dictionaryVersion:'机构字典版本',rulesVersion:'决策表版本',review:'人工复核',required:'是否必需',autoFinalized:'是否自动定案',ruleTraceAvailable:'是否有规则日志',ruleTraceNote:'规则日志说明',codedLines:'Iris编码行',workLot:'Iris工作批次',classification:'分类体系',categoryKnown:'类目是否存在',requiresReview:'需要复核',demographics:'证明书补充信息',entryMode:'输入模式',ident:'Iris原始结果'});
Object.assign(qualityLabels,{'category-table-not-terminal-codes':'用户提供的是三位类目表，不能据此补造四位或六位编码。','iris-engine-not-configured':'尚未配置获授权的 Iris 5/MUSE 引擎及完整决策表；未生成根本死因候选。'});
