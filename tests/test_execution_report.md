# 疾控病媒生物监测预警智能体 (Agent-CdcBuddy) 自动化测试报告

> **执行时间**：2026-08-08 21:48:42 ~ 2026-08-08 21:48:42  
> **测试结果**：**14/14 全部通过 (100.0%)** | **总耗时**：0.81s  
> **断言通过率**：**290/290 (100%)**  

---

## 一、 功能需求清单测试覆盖矩阵

| 需求序号 | 功能模块名称 | 业务类别 | 测试场景 | 核心技术指标 / 断言验证 | 耗时 | 测试状态 |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| **REQ-23** | 种群动态模型 | 种群动态分析 | 全省蚊媒密度随气温变化的季节消长规律及未来3个月ARIMA时序预测 | r2Score: 0.65, historicalMonths: 40 | 89.65ms | ✅ **PASS** |
| **REQ-24** | 种群识别模型 | 种群动态分析 | 郑州市蚊类优势种群构成比（白纹伊蚊 vs 淡色库蚊）识别与 K-Means 聚类 | dominantSpecies: 淡色(致倦)库蚊, shannonWienerIndex: 1.407 | 397.81ms | ✅ **PASS** |
| **REQ-25** | 抗药性预测模型 | 抗药性评估 | 输入杀虫剂类型与监测点数据，预测病媒生物耐药等级（敏感/中抗/高抗）并推荐消杀用药处方 | evaluatedRecords: 15, topSpecies: 家蝇 | 2.25ms | ✅ **PASS** |
| **REQ-26** | 病原携带风险评估模型 | 病原携带风险 | 整合病媒 PCR 检测结果与宿主分布，通过 Apriori 关联规则挖掘高风险病原组合 | highRiskItemsCount: 34, associationRulesCount: 8 | 188.01ms | ✅ **PASS** |
| **REQ-27** | 动态预警分析 | 动态预警响应 | 多维度预警触发与 IDW 空间插值连续热力图生成，支持地市与区县下钻 | totalAlerts: 30, redAlerts: 1 | 26.24ms | ✅ **PASS** |
| **REQ-28** | 预警推送信息 | 动态预警响应 | 按风险等级自动分类预警，生成通知推送卡片与依据，并持久化写入业务库 | persistedEventId: TEST-ALERT-1786196922, pushStatus: SENT | 25.05ms | ✅ **PASS** |
| **REQ-29** | 处置闭环信息 | 动态预警响应 | 智能生成消杀处置工单、关联三步消杀规程、流转跟踪并通过 BI 复测闭环核销 | ticketId: TICKET-TEST-1786196922, statusTransition: IN_PROGRESS -> RESOLVED | 1.64ms | ✅ **PASS** |
| **REQ-30** | 密度预测模型 | 风险预测评估 | 融合气象数据与地理生境，通过 GBDT 梯度提升回归模型预测未来 1-2 个月密度及因子权重 | city: 郑州市, predictedDensity: 1.37 | 39.85ms | ✅ **PASS** |
| **REQ-31** | 传播风险评估模型 | 风险预测评估 | 构建'病媒密度 × 病原携带率 × 人群暴露指数'关联数学模型，量化传染病传播风险 (0-100) | riskScore: 44.2, riskLevel: 中等传播风险 (Yellow) | 6.26ms | ✅ **PASS** |
| **REQ-32** | 抗药性演化预测 | 风险预测评估 | 基于历史数据与用药频率，贝叶斯/马尔可夫网络预测 1 年内耐药基因频率演化与突变暴发预警 | evolutionYears: ['2020', '2021', '2022', '2023', '2024', '2025', '2026 (预测)', '2027 (预测)'], kdrGeneFrequency: [0.66, 0.55, 0.55, 0.55, 0.55, 0.53, 0.64, 0.74] | 1.03ms | ✅ **PASS** |
| **REQ-33** | 自然语言问答(NLQ) | 智能问答 | CDC 知识库全文检索与标准条文精准匹配（GB/T 标准、物种鉴别、应急消杀阈值） | queriesTested: 4, hitsCount: 4 | 0.28ms | ✅ **PASS** |
| **REQ-34** | 自动生成专题报告 | 专题报告 | 自动提取多维时空数据、生成图表文字综述（四段式报告）并持久化归档至业务库 | reportId: REP-TEST-1786196922, title: 郑州市 2024年病媒生物监测与风险预警专项报告 (测试版) | 2.28ms | ✅ **PASS** |
| **REQ-35** | 移动端智能辅助(API) | 移动端接口 | 移动端 API 仿真：拍照物种 AI 识别、现场记录提交与气象生境数据逻辑质控规则校验 | submissionId: MOB-SUB-1786196922, aiRecognizedSpecies: 白纹伊蚊 | 0.62ms | ✅ **PASS** |
| **EXT-01** | 对话式自定义创建技能 | 自定义技能 | 对话式动态编译 SQL 聚合逻辑、生成专属图表卡片并持久化注册新技能 | customSkillId: skill_custom_1786196922, skillName: 郑州市主要病媒物种捕获TOP5分析 | 25.8ms | ✅ **PASS** |

---

## 二、 逐项功能测试详细日志与断言记录

### 【REQ-23】种群动态模型
- **功能分类**：种群动态分析
- **测试场景**：全省蚊媒密度随气温变化的季节消长规律及未来3个月ARIMA时序预测
- **执行耗时**：`89.65 ms`
- **断言结果**：`13/13`
- **关键输出指标**：
```json
{
  "r2Score": 0.65,
  "historicalMonths": 40,
  "forecastMonths": 3,
  "tempCorrelation": 0.388,
  "humidityCorrelation": 0.122
}
```
- **断言日志详情**：
```text
  [PASS] 返回时序趋势点集且非空
  [PASS] 模型计算拟合优度 R^2 指标
  [PASS] 时间序列自回归模型拟合优度 R² >= 0.60 (actual=0.65, range=[0.6, 1.0])
  [PASS] 历史监测月度样本量充足 (共 40 个月)
  [PASS] 成功预测未来 3 个月波动曲线 (共 3 点)
  [PASS] 预测值 5.25 处于 95% 置信区间 [0.0, 17.31]
  [PASS] 关联预测月份气象温湿度基线
  [PASS] 预测值 6.72 处于 95% 置信区间 [0.0, 19.32]
  [PASS] 关联预测月份气象温湿度基线
  [PASS] 预测值 6.57 处于 95% 置信区间 [0.0, 19.68]
  [PASS] 关联预测月份气象温湿度基线
  [PASS] 气温皮尔逊相关系数处于 [-1, 1] 区间 (actual=0.388, range=[-1.0, 1.0])
  [PASS] 湿度皮尔逊相关系数处于 [-1, 1] 区间 (actual=0.122, range=[-1.0, 1.0])
```

### 【REQ-24】种群识别模型
- **功能分类**：种群动态分析
- **测试场景**：郑州市蚊类优势种群构成比（白纹伊蚊 vs 淡色库蚊）识别与 K-Means 聚类
- **执行耗时**：`397.81 ms`
- **断言结果**：`10/10`
- **关键输出指标**：
```json
{
  "dominantSpecies": "淡色(致倦)库蚊",
  "shannonWienerIndex": 1.407,
  "speciesCount": 13,
  "clustersCount": 3
}
```
- **断言日志详情**：
```text
  [PASS] 物种构成比分析结果非空
  [PASS] 准确识别绝对优势种群
  [PASS] 计算 Shannon-Wiener 物种多样性指数
  [PASS] 物种多样性指数处于合理范围 (actual=1.407, range=[0.1, 5.0])
  [PASS] 所有物种构成比百分比总和为 100% (actual=100.0, expected=100.0 ±1.5)
  [PASS] 成功识别主要蚊类媒介物种构成
  [PASS] K-Means 空间聚类划分簇群
  [PASS] 聚类簇数据结构完整
  [PASS] 聚类簇数据结构完整
  [PASS] 聚类簇数据结构完整
```

### 【REQ-25】抗药性预测模型
- **功能分类**：抗药性评估
- **测试场景**：输入杀虫剂类型与监测点数据，预测病媒生物耐药等级（敏感/中抗/高抗）并推荐消杀用药处方
- **执行耗时**：`2.25 ms`
- **断言结果**：`17/17`
- **关键输出指标**：
```json
{
  "evaluatedRecords": 15,
  "topSpecies": "家蝇",
  "topPesticide": "高效氯氰菊酯",
  "topLevel": "中抗",
  "topConfidence": 0.88,
  "topRecommendation": "【限制频次】限制施用频次，建议复配胡椒基丁醚(PBO)增效剂..."
}
```
- **断言日志详情**：
```text
  [PASS] 查询到抗药性历史生物测定及预测记录
  [PASS] 耐药等级 '中抗' 符合国家分级规范
  [PASS] 预测置信度处于 [0.5, 1.0] (actual=0.88, range=[0.5, 1.0])
  [PASS] 生成具有指导意义的科学消杀轮换处方
  [PASS] 耐药等级 '中抗' 符合国家分级规范
  [PASS] 预测置信度处于 [0.5, 1.0] (actual=0.88, range=[0.5, 1.0])
  [PASS] 生成具有指导意义的科学消杀轮换处方
  [PASS] 耐药等级 '中抗' 符合国家分级规范
  [PASS] 预测置信度处于 [0.5, 1.0] (actual=0.88, range=[0.5, 1.0])
  [PASS] 生成具有指导意义的科学消杀轮换处方
  [PASS] 耐药等级 '中抗' 符合国家分级规范
  [PASS] 预测置信度处于 [0.5, 1.0] (actual=0.88, range=[0.5, 1.0])
  [PASS] 生成具有指导意义的科学消杀轮换处方
  [PASS] 耐药等级 '中抗' 符合国家分级规范
  [PASS] 预测置信度处于 [0.5, 1.0] (actual=0.88, range=[0.5, 1.0])
  [PASS] 生成具有指导意义的科学消杀轮换处方
  [PASS] 生成宏观抗药性轮换建议清单
```

### 【REQ-26】病原携带风险评估模型
- **功能分类**：病原携带风险
- **测试场景**：整合病媒 PCR 检测结果与宿主分布，通过 Apriori 关联规则挖掘高风险病原组合
- **执行耗时**：`188.01 ms`
- **断言结果**：`41/41`
- **关键输出指标**：
```json
{
  "highRiskItemsCount": 34,
  "associationRulesCount": 8,
  "topRiskPair": "淡色库蚊 + 登革病毒",
  "positivityRate": "0.0%",
  "associatedDisease": "登革热 (Dengue Fever)"
}
```
- **断言日志详情**：
```text
  [PASS] 识别高风险媒介与病原组合
  [PASS] Apriori 频繁项集关联挖掘规则生成成功
  [PASS] 包含靶标媒介与病原体信息
  [PASS] PCR 阳性率计算在 [0%, 100%] (actual=0.0, range=[0.0, 100.0])
  [PASS] 精准关联对应的法定传染病
  [PASS] 包含靶标媒介与病原体信息
  [PASS] PCR 阳性率计算在 [0%, 100%] (actual=0.0, range=[0.0, 100.0])
  [PASS] 精准关联对应的法定传染病
  [PASS] 包含靶标媒介与病原体信息
  [PASS] PCR 阳性率计算在 [0%, 100%] (actual=0.0, range=[0.0, 100.0])
  [PASS] 精准关联对应的法定传染病
  [PASS] 包含靶标媒介与病原体信息
  [PASS] PCR 阳性率计算在 [0%, 100%] (actual=0.0, range=[0.0, 100.0])
  [PASS] 精准关联对应的法定传染病
  [PASS] 包含靶标媒介与病原体信息
  [PASS] PCR 阳性率计算在 [0%, 100%] (actual=0.0, range=[0.0, 100.0])
  [PASS] 精准关联对应的法定传染病
  [PASS] Apriori 支持度 Support 满足 [0, 1] (actual=0.0016, range=[0.0, 1.0])
  [PASS] Apriori 置信度 Confidence 满足 [0, 1] (actual=0.0041, range=[0.0, 1.0])
  [PASS] Apriori 提升度 Lift >= 0
  [PASS] Apriori 支持度 Support 满足 [0, 1] (actual=0.0012, range=[0.0, 1.0])
  [PASS] Apriori 置信度 Confidence 满足 [0, 1] (actual=0.003, range=[0.0, 1.0])
  [PASS] Apriori 提升度 Lift >= 0
  [PASS] Apriori 支持度 Support 满足 [0, 1] (actual=0.0016, range=[0.0, 1.0])
  [PASS] Apriori 置信度 Confidence 满足 [0, 1] (actual=0.003, range=[0.0, 1.0])
  [PASS] Apriori 提升度 Lift >= 0
  [PASS] Apriori 支持度 Support 满足 [0, 1] (actual=0.0012, range=[0.0, 1.0])
  [PASS] Apriori 置信度 Confidence 满足 [0, 1] (actual=0.0022, range=[0.0, 1.0])
  [PASS] Apriori 提升度 Lift >= 0
  [PASS] Apriori 支持度 Support 满足 [0, 1] (actual=0.0012, range=[0.0, 1.0])
  [PASS] Apriori 置信度 Confidence 满足 [0, 1] (actual=0.0022, range=[0.0, 1.0])
  [PASS] Apriori 提升度 Lift >= 0
  [PASS] Apriori 支持度 Support 满足 [0, 1] (actual=0.0008, range=[0.0, 1.0])
  [PASS] Apriori 置信度 Confidence 满足 [0, 1] (actual=0.002, range=[0.0, 1.0])
  [PASS] Apriori 提升度 Lift >= 0
  [PASS] Apriori 支持度 Support 满足 [0, 1] (actual=0.0006, range=[0.0, 1.0])
  [PASS] Apriori 置信度 Confidence 满足 [0, 1] (actual=0.0015, range=[0.0, 1.0])
  [PASS] Apriori 提升度 Lift >= 0
  [PASS] Apriori 支持度 Support 满足 [0, 1] (actual=0.0008, range=[0.0, 1.0])
  [PASS] Apriori 置信度 Confidence 满足 [0, 1] (actual=0.0015, range=[0.0, 1.0])
  [PASS] Apriori 提升度 Lift >= 0
```

### 【REQ-27】动态预警分析
- **功能分类**：动态预警响应
- **测试场景**：多维度预警触发与 IDW 空间插值连续热力图生成，支持地市与区县下钻
- **执行耗时**：`26.24 ms`
- **断言结果**：`142/142`
- **关键输出指标**：
```json
{
  "totalAlerts": 30,
  "redAlerts": 1,
  "orangeAlerts": 22,
  "yellowAlerts": 7,
  "gridDensityPoints": 324
}
```
- **断言日志详情**：
```text
  [PASS] 包含预警触发事件集合
  [PASS] IDW 空间插值网格点阵计算成功
  [PASS] 预警等级 'red' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'orange' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'yellow' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'yellow' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'yellow' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'yellow' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'yellow' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'yellow' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 预警等级 'yellow' 属于红/橙/黄三级分类
  [PASS] 当前密度达到或超过预警触发阈值
  [PASS] 预警点包含精确 GIS 经纬度坐标
  [PASS] 估算预警受影响暴露人口
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
  [PASS] 网格点包含坐标与插值密度
  [PASS] 插值密度非负
```

### 【REQ-28】预警推送信息
- **功能分类**：动态预警响应
- **测试场景**：按风险等级自动分类预警，生成通知推送卡片与依据，并持久化写入业务库
- **执行耗时**：`25.05 ms`
- **断言结果**：`5/5`
- **关键输出指标**：
```json
{
  "persistedEventId": "TEST-ALERT-1786196922",
  "pushStatus": "SENT",
  "channels": "系统通知,短信网关,移动端APP推送"
}
```
- **断言日志详情**：
```text
  [PASS] 成功捕获全省超标预警事件
  [PASS] 预警事件成功持久化到业务数据库
  [PASS] 预警等级为严重 (red)
  [PASS] 推送状态为已发送 (SENT)
  [PASS] 包含移动端多渠道分发配置
```

### 【REQ-29】处置闭环信息
- **功能分类**：动态预警响应
- **测试场景**：智能生成消杀处置工单、关联三步消杀规程、流转跟踪并通过 BI 复测闭环核销
- **执行耗时**：`1.64 ms`
- **断言结果**：`5/5`
- **关键输出指标**：
```json
{
  "ticketId": "TICKET-TEST-1786196922",
  "statusTransition": "IN_PROGRESS -> RESOLVED",
  "beforeDensity": 86.0,
  "afterBiIndex": 3.8,
  "isBiCompliant": true
}
```
- **断言日志详情**：
```text
  [PASS] 工单创建并处于处理中状态 (IN_PROGRESS)
  [PASS] 指派专业消杀队伍
  [PASS] 工单已成功核销闭环 (RESOLVED)
  [PASS] 复测布雷图指数 BI=3.8 达标 (< 5.0)
  [PASS] 记录精确核销归档时间戳
```

### 【REQ-30】密度预测模型
- **功能分类**：风险预测评估
- **测试场景**：融合气象数据与地理生境，通过 GBDT 梯度提升回归模型预测未来 1-2 个月密度及因子权重
- **执行耗时**：`39.85 ms`
- **断言结果**：`7/7`
- **关键输出指标**：
```json
{
  "city": "郑州市",
  "predictedDensity": 1.37,
  "topDriver": "旬平均气温 (25~32℃ 驱动因子) (81.9%)",
  "factorsEvaluated": 4
}
```
- **断言日志详情**：
```text
  [PASS] 返回预测目标城市
  [PASS] GBDT 模型输出预测密度值
  [PASS] 输出气象与生境特征重要性权重
  [PASS] GBDT 特征重要性权重总和归一化为 1.0 (100%) (actual=1.0, expected=1.0 ±0.05)
  [PASS] 特征重要性包含气温驱动因子
  [PASS] 特征重要性包含水分/降水驱动因子
  [PASS] 生成专家级研判综述
```

### 【REQ-31】传播风险评估模型
- **功能分类**：风险预测评估
- **测试场景**：构建'病媒密度 × 病原携带率 × 人群暴露指数'关联数学模型，量化传染病传播风险 (0-100)
- **执行耗时**：`6.26 ms`
- **断言结果**：`12/12`
- **关键输出指标**：
```json
{
  "riskScore": 44.2,
  "riskLevel": "中等传播风险 (Yellow)",
  "vectorDensityIndex": 20.0,
  "pathogenPrevalenceIndex": 21.6,
  "populationExposureIndex": 92.0,
  "climateSuitabilityIndex": 82.0
}
```
- **断言日志详情**：
```text
  [PASS] 计算综合传播风险指数
  [PASS] 综合风险评分处于 [0, 100] 标度 (actual=44.2, range=[0.0, 100.0])
  [PASS] 输出传播风险等级分级
  [PASS] 包含病媒密度分项评分
  [PASS] 包含病原携带率分项评分
  [PASS] 包含人群暴露分项评分
  [PASS] 包含气候适宜度分项评分
  [PASS] 分项指标 vectorDensityIndex 评分处于 [0, 100] (actual=20.0, range=[0.0, 100.0])
  [PASS] 分项指标 pathogenPrevalenceIndex 评分处于 [0, 100] (actual=21.6, range=[0.0, 100.0])
  [PASS] 分项指标 populationExposureIndex 评分处于 [0, 100] (actual=92.0, range=[0.0, 100.0])
  [PASS] 分项指标 climateSuitabilityIndex 评分处于 [0, 100] (actual=82.0, range=[0.0, 100.0])
  [PASS] 输出量化模型综合评估综述
```

### 【REQ-32】抗药性演化预测
- **功能分类**：风险预测评估
- **测试场景**：基于历史数据与用药频率，贝叶斯/马尔可夫网络预测 1 年内耐药基因频率演化与突变暴发预警
- **执行耗时**：`1.03 ms`
- **断言结果**：`20/20`
- **关键输出指标**：
```json
{
  "evolutionYears": [
    "2020",
    "2021",
    "2022",
    "2023",
    "2024",
    "2025",
    "2026 (预测)",
    "2027 (预测)"
  ],
  "kdrGeneFrequency": [
    0.66,
    0.55,
    0.55,
    0.55,
    0.55,
    0.53,
    0.64,
    0.74
  ],
  "resistanceRatio": [
    26.5,
    17.5,
    17.5,
    17.5,
    17.5,
    16.8,
    36.7,
    52.7
  ],
  "latestFreq": "74.0%",
  "warningAlert": "马尔可夫选择动力学模型预警：受连年拟除虫菊酯使用影响，预计在 2026..."
}
```
- **断言日志详情**：
```text
  [PASS] 计算当前与预测耐药等位基因频率序列
  [PASS] 生成演化年份时序
  [PASS] 计算抗药性抗性倍数演变
  [PASS] KDR 抗性基因频率 0.66 处于 [0.0, 1.0] (actual=0.66, range=[0.0, 1.0])
  [PASS] KDR 抗性基因频率 0.55 处于 [0.0, 1.0] (actual=0.55, range=[0.0, 1.0])
  [PASS] KDR 抗性基因频率 0.55 处于 [0.0, 1.0] (actual=0.55, range=[0.0, 1.0])
  [PASS] KDR 抗性基因频率 0.55 处于 [0.0, 1.0] (actual=0.55, range=[0.0, 1.0])
  [PASS] KDR 抗性基因频率 0.55 处于 [0.0, 1.0] (actual=0.55, range=[0.0, 1.0])
  [PASS] KDR 抗性基因频率 0.53 处于 [0.0, 1.0] (actual=0.53, range=[0.0, 1.0])
  [PASS] KDR 抗性基因频率 0.64 处于 [0.0, 1.0] (actual=0.64, range=[0.0, 1.0])
  [PASS] KDR 抗性基因频率 0.74 处于 [0.0, 1.0] (actual=0.74, range=[0.0, 1.0])
  [PASS] 抗性倍数 26.5 >= 1.0
  [PASS] 抗性倍数 17.5 >= 1.0
  [PASS] 抗性倍数 17.5 >= 1.0
  [PASS] 抗性倍数 17.5 >= 1.0
  [PASS] 抗性倍数 17.5 >= 1.0
  [PASS] 抗性倍数 16.8 >= 1.0
  [PASS] 抗性倍数 36.7 >= 1.0
  [PASS] 抗性倍数 52.7 >= 1.0
  [PASS] 生成耐药基因暴发与轮换预警建议
```

### 【REQ-33】自然语言问答(NLQ)
- **功能分类**：智能问答
- **测试场景**：CDC 知识库全文检索与标准条文精准匹配（GB/T 标准、物种鉴别、应急消杀阈值）
- **执行耗时**：`0.28 ms`
- **断言结果**：`5/5`
- **关键输出指标**：
```json
{
  "queriesTested": 4,
  "hitsCount": 4,
  "avgResponseTimeMs": "< 5ms (本地精准语义检索)"
}
```
- **断言日志详情**：
```text
  [PASS] 知识库检索 '布雷图指数' 成功召回对应标准 GB/T 23797-2020 (命中: GB/T 23797-2020 《病媒生物密度监测方法 蚊类》)
  [PASS] 知识库检索 '登革热媒介' 成功召回对应标准 WS/T 467-2014 (命中: WS/T 467-2014 《登革热媒介伊蚊应急控制指南》)
  [PASS] 知识库检索 '蝇类' 成功召回对应标准 GB/T 23798-2020 (命中: GB/T 23798-2020 《病媒生物密度监测方法 蝇类》)
  [PASS] 知识库检索 '鼠类' 成功召回对应标准 GB/T 23796-2020 (命中: GB/T 23796-2020 《病媒生物密度监测方法 鼠类》)
  [PASS] 知识库多词检索全部命中 (命中率 4/4)
```

### 【REQ-34】自动生成专题报告
- **功能分类**：专题报告
- **测试场景**：自动提取多维时空数据、生成图表文字综述（四段式报告）并持久化归档至业务库
- **执行耗时**：`2.28 ms`
- **断言结果**：`3/3`
- **关键输出指标**：
```json
{
  "reportId": "REP-TEST-1786196922",
  "title": "郑州市 2024年病媒生物监测与风险预警专项报告 (测试版)",
  "totalMonitoringRecordsIntegrated": 48530,
  "totalPathogenTestsIntegrated": 7336,
  "sectionCount": 4
}
```
- **断言日志详情**：
```text
  [PASS] 成功拉取大盘全量监测事实数据 (48530 条)
  [PASS] 专项报告成功生成并归档写入数据库
  [PASS] 报告正文富文本 Markdown 内容完整生成
```

### 【REQ-35】移动端智能辅助(API)
- **功能分类**：移动端接口
- **测试场景**：移动端 API 仿真：拍照物种 AI 识别、现场记录提交与气象生境数据逻辑质控规则校验
- **执行耗时**：`0.62 ms`
- **断言结果**：`6/6`
- **关键输出指标**：
```json
{
  "submissionId": "MOB-SUB-1786196922",
  "aiRecognizedSpecies": "白纹伊蚊",
  "aiConfidence": "98.4%",
  "qcRulesPassed": true,
  "auditStatus": "PENDING_REVIEW"
}
```
- **断言日志详情**：
```text
  [PASS] 低温异常规则生效：气温 8.0℃ 下捕获 45 只成蚊被成功拦截告警
  [PASS] 正常数据通过质控规则 (气温 28.5℃, 数量 25)
  [PASS] 移动端采集记录成功提交入库
  [PASS] AI 视觉识别物种一致
  [PASS] AI 识别置信度达标 (98.4%) (actual=98.4, expected=98.4 ±0.1)
  [PASS] 进入市级质控审核流 (PENDING_REVIEW)
```

### 【EXT-01】对话式自定义创建技能
- **功能分类**：自定义技能
- **测试场景**：对话式动态编译 SQL 聚合逻辑、生成专属图表卡片并持久化注册新技能
- **执行耗时**：`25.8 ms`
- **断言结果**：`4/4`
- **关键输出指标**：
```json
{
  "customSkillId": "skill_custom_1786196922",
  "skillName": "郑州市主要病媒物种捕获TOP5分析",
  "chartType": "bar",
  "previewTopSpecies": "淡色(致倦)库蚊 (5587 只)"
}
```
- **断言日志详情**：
```text
  [PASS] 自定义动态 SQL 语句在底层大盘库编译执行成功
  [PASS] 计算出有效物种聚合捕获总量
  [PASS] 动态自定义新技能成功注册入库
  [PASS] 配置图表呈现类型为柱状图 (bar)
```
