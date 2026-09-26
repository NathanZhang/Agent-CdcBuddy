# Agent-CdcBuddy (疾控全域四智能体综合监测预警平台)

> **面向国家、省、市、县四级疾病预防控制中心（CDC）的新一代全域多智能体协同监测预警平台。基于通用大语言模型、LangGraph 状态机编排与 CopilotKit 交互框架，构建覆盖“病媒生物、食源性疾病、环境健康、死因慢病与伤害”四大领域的全链条智能闭环。**

[![Next.js](https://img.shields.io/badge/Next.js-15.1.7-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat&logo=react)](https://react.dev/)
[![CopilotKit](https://img.shields.io/badge/CopilotKit-1.4.0-6366F1?style=flat)](https://copilotkit.ai/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2+-FF6F00?style=flat)](https://langchain-ai.github.io/langgraph/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?style=flat&logo=pytorch)](https://pytorch.org/)
[![Tests](https://img.shields.io/badge/Tests-44%2F44%20Passing-brightgreen?style=flat)](tests/reports/all_agents_test_report.md)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

---

## 🌟 平台全景与四智能体架构

Agent-CdcBuddy 严格依据疾控专业规范与国家标准，打通**“多源采集 ➔ 智能质控 ➔ 常驻巡检 ➔ 统计推断与深度学习 ➔ 动态预警 ➔ 处置闭环 ➔ 决策专报”**全流程，全面覆盖 **54 项疾控专业核心功能**（对照国家需求 No. 23 ~ No. 76）：

```
                       ┌─────────────────────────────────────────────────────────┐
                       │               Agent-CdcBuddy 智能协同中枢                 │
                       │           (LangGraph / CopilotKit / 统一网关编排)         │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
          ┌─────────────────────────┬───────────────┴───────────────┬─────────────────────────┐
          ▼                         ▼                               ▼                         ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│  🦟 病媒与宿主    │     │  🍲 食源性疾病    │     │  💧 环境健康风险  │     │  🩺 死因慢病伤害  │
│监测预警智能体     │     │监测预警智能体     │     │监测预警智能体     │     │综合监测智能体     │
│(Vector Agent)     │     │(Foodborne Agent)  │     │(Env Health Agent) │     │(Chronic Agent)    │
│Port: 3001 | No.23~35│   │Port: 3002 | No.36~41│   │Port: 3003 | No.42~58│   │Port: 3004 | No.59~76│
├───────────────────┤     ├───────────────────┤     ├───────────────────┤     ├───────────────────┤
│• 种群消长ARIMA预测│     │• 聚集暴发时空扫描 │     │• 水质RF-Kriging插值│    │• 死亡医学证明质控 │
│• 优势种K-Means聚类│     │• 发病风险扩散预测 │     │• 污水滞后流行病学 │     │• ICD-10 NLP智能编码│
│• LC50毒力回归分析 │     │• cgMLST分子系统树 │     │• 极端气候DLNM响应 │     │• 时空DBSCAN罕见聚集│
│• 贝叶斯耐药基因演化│   │• 食品暴露归因排行 │     │• 四河流域自相关链 │     │• 慢病GBDT风险预测 │
│• SaTScan时空扫描  │     │• 处置工单闭环派发 │     │• 三级动态预警下发 │     │• 简略寿命表4q70评估│
│• 7×24常驻守护巡检 │     │• 暴发流调简报导出 │     │• 水质冲洗处置方案 │     │• 伤害决策树归因分析│
└─────────┬─────────┘     └─────────┬─────────┘     └─────────┬─────────┘     └─────────┬─────────┘
          └─────────────────────────┼───────────────────────────────┴─────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
          ┌───────────────────┐           ┌───────────────────┐
          │  生成式 UI (AG-UI) │           │ Python 科学算法引擎│
          ├───────────────────┤           ├───────────────────┤
          │• 天地图 GIS 空间层│           │• SaTScan 时空圆柱 │
          │• 交互式地理实体徽章│           │• PyTorch 双向 LSTM│
          │• ECharts 时序/雷达│           │• ARIMA / GBDT 回归│
          │• 分子系统发育树图 │           │• cgMLST 最小生成树│
          │• 决策归因树与热力 │           │• DLNM 暴露滞后响应│
          │• 7×24 守护监控卡  │           │• Kriging 空间插值 │
          │• 处置工单复测核销 │           │• Apriori 关联挖掘 │
          │• 决策专报一键导出 │           │• 贝叶斯/马尔可夫演化│
          └───────────────────┘           └───────────────────┘
```

> 📐 **技术架构全景图**：详见 [docs/技术架构图与各层详细设计说明.md](docs/技术架构图与各层详细设计说明.md)，可直接访问 [矢量架构图 SVG](docs/images/architecture.svg) 或 [交互式 HTML 架构图](docs/images/architecture.html)。

---

## 🚀 四智能体业务矩阵与核心能力

### 1. 🦟 病媒生物与宿主动物监测预警智能体 (`vector` | 端口 3001)
- **业务覆盖**：对照需求 No. 23 ~ No. 35，服务于疾控中心媒介生物控制科室。
- **核心算法与能力**：
  - **种群消长预测 (ARIMA / Bi-LSTM)**：对蚊、蝇、鼠、蜚蠊等多生境密度进行 3 个月波动预测（置信区间 95%）。
  - **优势种聚类 (K-Means & Shannon 多样性)**：自动解析群落构成比与空间异质性。
  - **抗药性毒力回归 (Probit)**：测定 LC50/KT50 毒力参数，结合马尔可夫/贝叶斯模型推演耐药突变趋势。
  - **病原关联与 SaTScan 扫描**：结合 PCR 筛查（登革热、乙脑、疟原虫等），使用 Kulldorff 空间-时间扫描统计量（Poisson 模型，999 次蒙特卡洛检验）识别高危聚集区。
  - **7×24 小时后台守护 (Daemon Agent)**：动态注入专家自然语言 Prompt Policy 策略，周期性自动巡检与异常告警。
  - **处置闭环与移动端 API**：自动关联 GB/T 23797 标准生成消杀工单，跟踪 48h 复测核销，提供移动端 AI 拍照识别与数据质控接口。

### 2. 🍲 食源性疾病监测预警智能体 (`foodborne` | 端口 3002)
- **业务覆盖**：对照需求 No. 36 ~ No. 41，服务于食品安全与营养卫生科室。
- **核心算法与能力**：
  - **聚集性病例异常识别 (`outbreak_scanner.py`)**：基于时空聚集度检测与病例密度偏离度算法，实时捕捉食源性暴发苗头。
  - **发病风险与扩散预测 (`risk_forecast.py`)**：融合气象季节温度、历年同期基线与就诊时序，预测未来扩散风险指数。
  - **致病菌分子溯源 (`cgmlst_cluster.py`)**：基于核心基因组多位点序列分型 (cgMLST) 等位基因差异矩阵与最小生成树，构建沙门氏菌、副溶血性弧菌等分子系统发育树与传播链。
  - **食品暴露归因分析 (`food_attribution.py`)**：采用流行病学优势比 (Odds Ratio) 与群体归因分值，精准锁定嫌疑高危食品与餐品来源。
  - **处置工单与报告流转**：自动生成现场调查方案、封存样品建议与流调简报导出。

### 3. 💧 环境健康风险监测预警智能体 (`env` | 端口 3003)
- **业务覆盖**：对照需求 No. 42 ~ No. 58，服务于环境与健康科室。
- **核心算法与能力**：
  - **多介质数据智能录入与标化**：支持生活饮用水、污水、空气、公共场所等多维检测报告智能解析（OCR 录入卡片）。
  - **水质安全空间平滑评估 (`water_rf_kriging.py`)**：结合 Random Forest 与普通克里金空间插值，实时绘制给水管网末梢水质超标风险热力面，推送管网冲洗方案。
  - **污水流行病学时空溯源 (`sewage_lag_tracing.py`)**：分析污水中特定病原载量（如诺如病毒、肠道病毒）与临床门诊病例的时空滞后互相关系数（Cross-Correlation），实现提前 7~14 天的早期预警。
  - **空气质量与极端气候健康响应 (`air_climate_dlnm.py`)**：运用分布式滞后非线性模型 (DLNM) 拟合温度/PM2.5 对心脑血管及呼吸系统疾病发病的超额风险响应曲面。
  - **四河流域跨介质链式空间自相关 (`river_chain_autocorr.py`)**：基于全局/局部 Moran's I 追踪沿河流域断面水质污染向周边人群发病率的链式传递。
  - **环境政策情景推演 (`scenario_simulation.py`)**：模拟极端天气应对或治理减排下的疾病发生率推演。

### 4. 🩺 死因、慢病及伤害综合监测预警智能体 (`chronic` | 端口 3004)
- **业务覆盖**：对照需求 No. 59 ~ No. 76，服务于慢性非传染性疾病防制科室。
- **核心算法与能力**：
  - **死亡医学证明书智能质控 (`death_cert_qc.py`)**：针对死亡逻辑顺序倒置、垃圾代码 (Garbage Codes)、空白缺项开展全自动规则质控与漏报核验。
  - **根本死因推理与 ICD-10 NLP 编码 (`icd10_nlp_inference.py`)**：基于死因链语义解析与国家死因库规则，智能判定根本死因并归类标准 ICD-10 编码。
  - **罕见死因时空聚集监测 (`mortality_cluster_dbscan.py`)**：结合时空 DBSCAN 密度聚类算法发现罕见病/不明原因死亡异常聚集，辅以 ARIMA 死亡率历史拟合与未来预测 ECharts 曲线。
  - **慢病发病预测 (`chronic_risk_gbdt.py`)**：融合高血压、糖尿病危险因素基线及气象气温，基于 GBDT 模型输出高危人群发病概率。
  - **简略寿命表与 4q70 早死概率测算 (`lifetable_4q70_roi.py`)**：根据各年龄组死亡率构建简略寿命表，计算 30~70 岁四类重大慢病早死概率（$4q70$）、潜在减寿年数 (PYLL) 及干预投入产出比 (ROI)。
  - **伤害时空聚类与决策树归因 (`injury_tree_attribution.py`)**：针对跌倒、交通事故、溺水等伤害病例，构建多级决策归因树与高危人群画像。

---

## 🧮 科学算法与深度学习引擎 (`analytics_engine/`)

```text
analytics_engine/
├── engine.py                         # 统一算法调度分发中枢
├── langgraph_app.py                  # LangGraph 状态机与多智能体流转图
├── satscan_lstm_pipeline.py          # SaTScan + LSTM 5步级联科学计算流水线
├── daemon_surveillance.py            # 7×24 小时常驻巡检守护引擎
│
├── [病媒与宿主动物]
│   ├── satscan_cluster.py            # Kulldorff 空间-时间扫描统计量算法
│   ├── lstm_predictor.py             # PyTorch 双向多变量 LSTM 深度预测模型
│   ├── population_dynamics.py        # ARIMA / 季节消长外推预测
│   ├── density_gbdt.py               # GBDT 气象驱动密度回归
│   ├── spatial_interpolation.py      # 普通克里金 (Kriging) 与 IDW 空间插值
│   ├── pathogen_apriori.py           # Apriori 频繁项集关联规则挖掘
│   ├── resistance_ml.py              # Probit 毒力回归与耐药性分级
│   ├── resistance_evolution.py       # 贝叶斯/马尔可夫耐药突变演化模型
│   ├── species_clustering.py         # K-Means 优势种聚类与 Shannon 多样性
│   └── transmission_risk.py          # SEIR 动力学传播风险模型
│
├── foodborne/                        # [食源性疾病]
│   ├── outbreak_scanner.py           # 聚集病例时空聚类扫描与暴发识别
│   ├── risk_forecast.py              # 发病风险与扩散预测模型
│   ├── cgmlst_cluster.py             # cgMLST 核心基因组分子溯源聚类与发育树
│   └── food_attribution.py           # 流行病学优势比食品暴露归因分析
│
├── env/                              # [环境健康风险]
│   ├── water_rf_kriging.py           # 水质管网 Random Forest-Kriging 空间插值
│   ├── sewage_lag_tracing.py         # 污水病原载量时空滞后互相关分析
│   ├── air_climate_dlnm.py           # 分布式滞后非线性模型 (DLNM) 暴露-响应曲面
│   ├── river_chain_autocorr.py       # 四河流域跨介质空间自相关 (Moran's I)
│   └── scenario_simulation.py        # 环境健康政策情景模拟与推演
│
└── chronic/                          # [死因慢病伤害]
    ├── death_cert_qc.py              # 死亡证明书逻辑质控与垃圾代码筛查
    ├── icd10_nlp_inference.py        # 根本死因因果链推理与 ICD-10 编码
    ├── mortality_cluster_dbscan.py   # 时空 DBSCAN 罕见死因聚集探测与 ARIMA
    ├── chronic_risk_gbdt.py          # 慢病高危发病风险 GBDT 预测
    ├── injury_tree_attribution.py    # 伤害病例多维决策树归因分析
    └── lifetable_4q70_roi.py         # 简略寿命表、4q70 早死概率与 ROI 评估
```

---

## 🎨 AG-UI 生成式界面组件矩阵

平台基于 Next.js 15 + React 19 + Tailwind CSS 构建了专业、高保真的 AG-UI 生成式交互组件：

| 领域 | 核心 AG-UI 组件 | 功能与交互说明 |
| :--- | :--- | :--- |
| **通用** | `GenerativeComponentRenderer` | 智能体渲染总线，根据后端技能返回类型动态挂载专业卡片 |
| **通用** | `ThinkingProcessCard` | 纯中文标准化思考链展示，折叠/展开多阶段推理逻辑 |
| **通用** | `ActiveAlertsModal` | 全域分级预警事件弹窗，支持一键下发应急派单 |
| **病媒** | `VectorMapComponent` | 国家天地图 GIS，叠加河南省市县 GeoJSON 矢量边界与真实监测点位热力面 |
| **病媒** | `SatScanSpatialGISMap` | 空间经纬度与时间轴构成的 SaTScan 三维圆柱扫描投影 |
| **病媒** | `DensityTrendChart` | 双轴气象气温关联折线图与 LSTM 90 天置信带预测 |
| **病媒** | `ResistanceMatrixChart` | 拟除虫菊酯、有机磷等杀虫剂耐药热力矩阵图 |
| **病媒** | `PathogenRiskCard` | PCR 阳性率、风险指数仪表盘与 Apriori 关联规则卡片 |
| **病媒** | `SpeciesCompositionChart`| 优势种群构成比南丁格尔玫瑰图与 Shannon 指数 |
| **食源** | `FoodborneClusterRadar` | 食源性病例多维聚类雷达图与暴发时空态势图 |
| **食源** | `MolecularPhylogenyTree` | cgMLST 等位基因分子系统发育树与同源株传播链 |
| **食源** | `FoodRiskRankingChart` | 嫌疑食品暴露归因危险度 (OR) 排行榜 |
| **食源** | `OutbreakEpidemiologyCard`| 流行病学调查摘要、三间分布特征卡与应急处置建议 |
| **环境** | `WaterPipelineGisMap` | 给水管网末梢水质 RF-Kriging 风险热力插值图与冲洗建议 |
| **环境** | `SewageLagCorrelationChart`| 污水病原载量与临床就诊时序滞后曲线图（提前预警窗口） |
| **环境** | `AirClimateHealthRiskCard`| DLNM 极端气温/空气污染滞后非线性响应曲面与超额就诊风险 |
| **环境** | `RiverBasinPollutionChainCard`| 淮河/黄河等四河流域跨介质链式空间自相关传递图 |
| **环境** | `EnvScenarioSimulationCard`| 环境治理/减排政策推演模拟控制面板 |
| **环境** | `EnvOcrEntryCard` | 环境多介质检测报告多模态 OCR 结构化录入卡片 |
| **慢病** | `DeathCertQcCard` | 死亡医学证明书智能质控、逻辑倒置校验与漏报核查卡 |
| **慢病** | `Icd10InferenceCard` | 根本死因因果推断图谱与标准 ICD-10 编码推理卡 |
| **慢病** | `RareMortalityClusterCard`| 时空 DBSCAN 罕见死因聚集预警 + ARIMA 死亡率拟合预测 ECharts 曲线 |
| **慢病** | `ChronicRiskForecastCard` | 慢病高危人群 GBDT 预测风险分布与特征重要性权重 |
| **慢病** | `LifeTable4q70ReportCard` | 简略寿命表生命期望值、4q70 早死概率与防制 ROI 分析 |
| **慢病** | `InjuryAttributionTreeCard`| 伤害致因决策树分类、高危地点与人群画像卡片 |

---

## 🌐 平台关键创新技术特性

### 1. 纯中文思维链与专业领域解读
- **中文推理标准化 (`chinese-reasoning-normalizer.ts`)**：内置过滤器消除英文思考碎片，确保思考过程全中文严谨呈现。
- **AI 领域专家解读生成器 (`interpretation-generator.ts`)**：算法计算结果出炉后，自动触发领域专家解读引擎，生成涵盖“流行病学背景、数据发现、研判结论、干预建议”的标准公文式综述。

### 2. 地理实体空间联动总线 (Geo Event Bus)
- 对话中提及的地理实体（如“郑州市金水区”、“洛阳市涧西区”）会被自动识别并渲染为**可交互的地理徽章**。
- 点击徽章即可触发全局地理事件总线，天地图 GIS 即刻自动平滑漫游、缩放并高亮对应辖区行政边界与点位。

### 3. 会话状态完备持久化与流式推流
- 深度优化了基于 Server-Sent Events (SSE) 的实时流式派发通道 (`stream-dispatch`)，打字机式平滑渲染推理过程与算法进展。
- 完整持久化用户会话，支持历史会话无缝回溯、思考过程恢复与复核。

### 4. 细粒度 RBAC 权限与信创数据库适配
- **四大角色权限矩阵**：省级管理员（全域透视/算法微调/专报发布）、市级专家（辖区研判/预警推送/派发工单）、区县监测员（现场录入/质控核验/复测核销）、公众用户（健康科普与公开预警）。
- **五数据库协同事实底座**：
  - `vector_monitoring.db`：5.6万+ 条病媒生态监测事实表
  - `foodborne_monitoring.db`：食源性病例监测与分子分型事实表
  - `env_monitoring.db`：水质、空气、污水多介质监测事实表
  - `chronic_monitoring.db`：死因证明、慢病随访、伤害监测事实表
  - `app_business.db`：流转工单、分级预警、知识库标准与用户会话库
- **信创环境就绪**：提供统一 DAL 抽象层，一键无缝平滑迁移至 **PostgreSQL 14+** 或 **人大金仓 (KingbaseES V8/V9)**。

---

## 🛠️ 集群运维与快速启动指南

系统通过标准化运维调度脚本 `server.sh` 统一管理多智能体集群：

```text
┌───────────────┬──────────────────────────┬──────────┬──────────────┐
│  智能体标识   │ 业务应用名称             │ 服务端口 │ 构建隔离目录 │
├───────────────┼──────────────────────────┼──────────┼──────────────┤
│ vector        │ 病媒生物监测预警智能体   │ 3001     │ .next_vector │
│ foodborne     │ 食源性疾病监测预警智能体 │ 3002     │ .next_foodborne│
│ env           │ 环境健康风险监测预警智能体│ 3003    │ .next_env    │
│ chronic       │ 死因慢病伤害综合监测智能体│ 3004    │ .next_chronic│
└───────────────┴──────────────────────────┴──────────┴──────────────┘
```

### 1. 环境准备与依赖安装
- **Node.js**：v18.0.0+ (推荐 v20+)
- **Python**：v3.9+ (内置 numpy, scipy, scikit-learn, pandas, torch, langgraph 等)

```bash
git clone https://github.com/NathanZhang/Agent-CdcBuddy.git
cd Agent-CdcBuddy

# 安装前端依赖
npm install

# 安装 Python 科学计算依赖
pip install -r requirements.txt
```

### 2. 环境变量配置
```bash
cp .env.example .env.local
```
编辑 `.env.local`：
```env
# 硅基流动 SiliconFlow 大模型配置 (支持 Qwen 2.5 / Qwen 3.6 等)
SILICONFLOW_API_KEY=sk-your-siliconflow-api-key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=Qwen/Qwen3.6-27B

# 国家天地图 (Tianditu) Key (用于地图空间底图)
NEXT_PUBLIC_TIANDITU_KEY=your_tianditu_browser_key
```

### 3. 一键启动四智能体集群或单领域服务
```bash
# 【常用】一键启动全部 4 个智能体集群开发服务 (端口 3001~3004)
./server.sh start all dev

# 启动单个智能体
./server.sh start vector dev      # 启动病媒生物智能体 (http://localhost:3001)
./server.sh start foodborne dev   # 启动食源性智能体   (http://localhost:3002)
./server.sh start env dev         # 启动环境健康智能体 (http://localhost:3003)
./server.sh start chronic dev     # 启动死因慢病智能体 (http://localhost:3004)

# 生产模式部署运行 (会自动执行构建)
./server.sh start all prod

# 查看集群各智能体运行状态及端口
./server.sh status

# 实时查看指定智能体日志
./server.sh logs vector
./server.sh logs chronic

# 停止指定或全部智能体
./server.sh stop all
```

### 4. Docker 容器化与 Docker Compose 编排
平台支持标准化容器镜像构建与 Docker Compose 一键启动集群：

```bash
# 1. 复制环境变量
cp .env.local .env

# 2. 一键启动四智能体容器集群 (Port: 3001~3004)
docker compose up -d

# 3. 查看容器集群健康状态
docker compose ps
```

> 📖 **完整部署指南**：详见 [docs/系统部署与运维操作手册.md](docs/系统部署与运维操作手册.md)，包含系统依赖、五大数据库初始化、systemd 守护进程、Nginx 反代与信创迁移全流程。


---

## 🧪 自动化测试与科学计算验证

系统拥有严密的无 Mock 自动化测试验证体系，覆盖四大领域的真实数据计算、空间推断与端到端业务流：

```bash
# 执行全域四智能体 44 项测试套件
./server.sh test all
# 或直接运行：
python3 tests/run_all_agent_tests.py

# 执行单个智能体专属测试
./server.sh test vector     # 病媒 19 项用例
./server.sh test foodborne  # 食源 6 项用例
./server.sh test env        # 环境 10 项用例
./server.sh test chronic    # 慢病 9 项用例
```

### 自动化回归测试报告概要

- **测试用例总计**：**44 项**
- **通过率**：**100% 全部通过 (44/44 PASSED)**
- **详细测试报告**：
  - 📋 [CDC 全域四智能体平台自动化测试综合回归报告 (Markdown)](tests/reports/all_agents_test_report.md)
  - 📊 [JSON 格式原始测试数据](tests/reports/all_agents_test_report.json)

---

## 📂 项目工程目录结构

```text
Agent-CdcBuddy/
├── README.md                          # 项目核心总览与使用手册 (本文件)
├── package.json                       # 前端依赖配置与 Next.js 脚本
├── requirements.txt                   # Python 科学计算、深度学习与 LangGraph 依赖
├── server.sh                          # 统一四智能体集群运维脚本 (start|stop|restart|status|test|logs)
├── start.sh / stop.sh                 # 快速启停脚本
├── Dockerfile                         # 跨平台标准容器镜像构建定义
│
├── vector_monitoring.db               # 事实底座 1：病媒生态监测事实库 (5.6万+ 条)
├── foodborne_monitoring.db            # 事实底座 2：食源性疾病与分子分型事实库
├── env_monitoring.db                  # 事实底座 3：水质/空气/污水多介质环境事实库
├── chronic_monitoring.db              # 事实底座 4：死因证明/慢病/伤害综合监测库
├── app_business.db                    # 业务状态库：工单/预警/审核/知识库/会话
│
├── analytics_engine/                  # Python 科学计算、时空推断与深度学习引擎
│   ├── engine.py                      # 统一算法入口
│   ├── langgraph_app.py               # LangGraph 状态图
│   ├── satscan_lstm_pipeline.py       # SaTScan + LSTM 级联流水线
│   ├── daemon_surveillance.py         # 7×24 后台守护巡检
│   ├── foodborne/                     # 食源性疾病算法集 (暴发扫描/cgMLST/食品暴露归因)
│   ├── env/                           # 环境健康算法集 (水质RF-Kriging/污水滞后/DLNM/自相关)
│   └── chronic/                       # 死因慢病算法集 (质控/ICD-10 NLP/时空DBSCAN/寿命表)
│
├── src/                               # Next.js 核心全栈源码
│   ├── app/                           # App Router
│   │   ├── api/agent/dispatch/        # 智能体通用派发接口
│   │   ├── api/agent/stream-dispatch/ # 智能体 SSE 实时流式派发通道
│   │   ├── api/copilotkit/            # CopilotKit Runtime 交互端点
│   │   ├── api/sessions/              # 会话历史与状态恢复 API
│   │   ├── api/skills/                # 动态业务技能 API
│   │   └── page.tsx                   # 疾控多智能体主工作台
│   ├── components/
│   │   ├── ag-ui/                     # 20+ 款 AG-UI 生成式专家图表/地图/工单组件
│   │   ├── common/                    # Markdown 渲染器、思维链卡片等基础组件
│   │   └── layout/                    # 导航栏、推荐卡片、会话抽屉、嵌入式浮窗
│   └── lib/
│       ├── analytics/                 # Node.js 与 Python 科学计算引擎桥梁
│       ├── config/                    # agent-profile 四智能体领域配置与元数据
│       ├── db/                        # 统一 DAL 数据库持久层 (SQLite/PG/人大金仓)
│       ├── geo/                       # 天地图 GIS、GeoJSON 边界与地理实体解析
│       ├── rbac/                      # 细粒度角色权限中枢
│       └── skills/                    # 技能注册中枢、解释器、思维链规范器
│
├── docs/                              # 体系化技术文档中心
│   ├── 需求功能对照清单及使用教程.md
│   ├── 技术架构图与各层详细设计说明.md
│   ├── 疾控全域四智能体综合监测预警平台功能扩展实施方案.md
│   ├── 基于LangGraph的多智能体协同与多步科学计算流水线方案.md
│   ├── 算法引擎与四智能体架构设计规范.md
│   ├── 自动化测试与质量保障指南.md
│   ├── 生产环境PostgreSQL及人大金仓(KingbaseES)迁移指南.md
│   └── images/                        # 技术架构图 (PNG / SVG / HTML)
│
├── plan/                              # 实施路线与用户手册
│   ├── 疾控全域四智能体综合监测预警平台-用户操作手册.md
│   ├── 人工智能-四智能体-功能清单.md
│   └── CdcBuddy_Agent_Technical_Whitepaper.docx
│
├── scripts/                           # 数据库初始化与自动化生成脚本
│   ├── init_business_db.py            # 业务持久化库初始化
│   ├── init_foodborne_mock.py         # 食源性疾病数据模拟底座初始化
│   ├── init_env_mock.py               # 环境健康数据模拟底座初始化
│   ├── init_chronic_mock.py           # 死因慢病数据模拟底座初始化
│   └── generate_architecture_diagram.py # 技术架构图自动化生成脚本
│
└── tests/                             # 自动化测试套件
    ├── run_all_agent_tests.py         # 四智能体全量自动化回归测试入口
    ├── suites/                        # 各智能体领域独立测试套件
    └── reports/                       # 自动化测试报告 (Markdown / JSON)
```

---

## 📚 详细技术与业务文档索引

| 文档名称 | 核心内容概述 | 建议阅读对象 |
| :--- | :--- | :--- |
| 📖 [**用户操作与功能使用手册**](plan/疾控全域四智能体综合监测预警平台-用户操作手册.md) | 全面覆盖 54 个功能点，详解四智能体页面布局、常用推荐卡片、操作 Prompt 与 AG-UI 视窗 | 业务专家 / 疾控人员 / 评测专家 |
| 🛠️ [**系统部署与运维操作手册**](docs/系统部署与运维操作手册.md) | 涵盖环境配置、五大数据库初始化、server.sh 集群运维、Docker/Compose 编排与常见排错 FAQ | 运维工程师 / DevOps / 系统管理员 |
| 🏛️ [**技术架构图与各层详细设计说明**](docs/技术架构图与各层详细设计说明.md) | 包含 2680×1840 高清全景架构图、SVG 源码、交互式 HTML 及 7 层架构设计说明 | 架构师 / 技术决策者 / 研发人员 |
| 🚀 [**四智能体综合平台功能扩展方案**](docs/疾控全域四智能体综合监测预警平台功能扩展实施方案.md) | 食源性疾病、环境健康、死因慢病四大领域扩展全量技术方案与模型规格说明 | 系统分析师 / 研发团队 |
| 🧮 [**算法引擎与四智能体架构设计规范**](docs/算法引擎与四智能体架构设计规范.md) | 详细推导 SaTScan、LSTM、DLNM、cgMLST、DBSCAN 等数学模型与无 Mock 落地规范 | 算法工程师 / 流行病学统计专家 |
| 🧪 [**自动化测试与质量保障指南**](docs/自动化测试与质量保障指南.md) | 44 项测试用例定义、无 Mock 数据验证逻辑与测试回归标准 | 测试工程师 / 质量保障团队 |
| 🏢 [**PostgreSQL及人大金仓迁移指南**](docs/生产环境PostgreSQL及人大金仓(KingbaseES)迁移指南.md) | 国产信创环境适配、双数据库 DDL 建表脚本与生产高可用部署指引 | 运维工程师 / DBA / 信创项目经理 |
| 📱 [**移动端 API 开发指南及调用示例**](docs/移动端API开发指南及调用示例.md) | 现场采样、异常上报、AI 物种识别 RESTful API 规范与联调代码 | 移动端开发者 / 前端工程师 |

---

## 📄 开源协议与声明

本项目基于 [MIT License](LICENSE) 开源发布。  
本项目中涉及的所有演示数据均经过严格的合成与脱敏处理，不包含任何真实患者个人隐私信息，旨在为我国公共卫生与疾病预防控制信息化、智能化建设提供具备前沿工程参考价值的标准技术范式。
