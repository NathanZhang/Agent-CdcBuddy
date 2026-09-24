# 疾控全域四智能体综合监测预警平台功能扩展实施方案

> **文件标识**：CDC-AGENT-EXPANSION-V2.0  
> **编写日期**：2026-09-24  
> **基线系统**：Agent-CdcBuddy（已落地病媒生物与宿主动物监测预警智能体）  
> **参考标准**：[人工智能-四智能体-功能清单.md](file:///Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy/plan/人工智能-四智能体-功能清单.md)  
> **扩展领域**：（三）食源性疾病、（四）环境健康、（五）死因、慢病及伤害

---

## 目录
1. [总体架构与设计原则](#一总体架构与设计原则)
2. [统一界面框架与场景化驱动机制 (UI & AG-UI)](#二统一界面框架与场景化驱动机制)
3. [三、四、五三大领域功能逐项落地设计](#三三大扩展领域功能逐项落地设计)
   - [1.（三）食源性疾病监测预警智能体](#1-食源性疾病监测预警智能体功能清单-36-41)
   - [2.（四）环境相关风险因素监测预警智能体](#2-环境相关风险因素监测预警智能体功能清单-42-58)
   - [3.（五）死因、慢病及伤害综合监测预警智能体](#3-死因慢病及伤害综合监测预警智能体功能清单-59-76)
4. [全域 Mock 数据底座设计规范 (`Agent-CdcBuddy-DataMock`)](#四全域-mock-数据底座设计规范)
5. [科学计算算法中台扩展设计 (`analytics_engine`)](#五科学计算算法中台扩展设计)
6. [多端口独立运行与 URL 路由部署方案](#六多端口独立运行与-url-路由部署方案)
7. [实施推进路线图与验证里程碑](#七实施推进路线图与验证里程碑)
8. [自动化测试套件扩展标准与质量保障（继承病媒成果）](#八自动化测试套件扩展标准与质量保障继承病媒成果)
9. [专家审阅与确认事项](#九专家审阅与确认事项)

---

## 一、总体架构与设计原则

根据要求，本方案采用 **“核心共性框架 + 领域配置驱动 + 插件化 AG-UI + 独立多实例部署”** 的总体架构策略。

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        统一应用外壳 / 界面基座 (Next.js 15 + React 19)                    │
│   • 统一响应式布局 (Navbar + 双栏自适应画布)        • 统一流式 LLM 交互与 CopilotKit     │
│   • 统一会话抽屉 (SessionHistory) 与状态回溯        • 统一 RBAC 角色权限与元技能扩展      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ 通过 AGENT_DOMAIN 环境变量加载 Profile 配置
       ┌────────────────────────┬───────────┴───────────┬────────────────────────┐
       ▼                        ▼                       ▼                        ▼
┌──────────────┐         ┌──────────────┐        ┌──────────────┐         ┌──────────────┐
│ 🦟 病媒生物   │         │ 🍲 食源性疾病 │        │ 💧 环境健康   │         │ 🫀 死因慢病   │
│   智能体     │         │   智能体     │        │   智能体     │         │   智能体     │
├──────────────┤         ├──────────────┤        ├──────────────┤         ├──────────────┤
│ 端口: 3001   │         │ 端口: 3002   │        │ 端口: 3003   │         │ 端口: 3004   │
│ 路由: /vector│         │ 路由: /food  │        │ 路由: /env   │         │ 路由: /death │
├──────────────┤         ├──────────────┤        ├──────────────┤         ├──────────────┤
│ 专属Prompt集 │         │ 专属Prompt集 │        │ 专属Prompt集 │         │ 专属Prompt集 │
│ 专属AG-UI组件│         │ 专属AG-UI组件│        │ 专属AG-UI组件│         │ 专属AG-UI组件│
│ 专属Skills库 │         │ 专属Skills库 │        │ 专属Skills库 │         │ 专属Skills库 │
│ 专属Mock底座 │         │ 专属Mock底座 │        │ 专属Mock底座 │         │ 专属Mock底座 │
└──────┬───────┘         └──────┬───────┘        └──────┬───────┘         └──────┬───────┘
       │                        │                       │                        │
       └────────────────────────┼───────────────────────┼────────────────────────┘
                                ▼                       ▼
                 ┌─────────────────────────────┐ ┌─────────────────────────────┐
                 │     统一科学计算算法中台     │ │     统一双库持久化与DAL层   │
                 │   (analytics_engine/core)   │ │  • 事实分析库 (SQLite/PG)   │
                 │ • SaTScan 时空圆柱扫描统计量 │ │  • 业务闭环库 (app_business)│
                 │ • PyTorch 双向多变量 LSTM    │ │  • 统一数据治理与质控评分   │
                 │ • GBDT / XGBoost 风险回归   │ │  • Text2SQL 语义解析引擎    │
                 └─────────────────────────────┘ └─────────────────────────────┘
```

### 四大核心原则：
1. **统一架构，场景定制**：所有智能体共用同一套底层代码库，界面框架、聊天流式通信机制、Text2SQL 解析器、通用算法引擎（LSTM、SaTScan、GBDT、克里金插值等）100% 复用，仅通过场景配置文件（`AgentProfile`）区分业务特征、提示词模板及专用生成式卡片。
2. **Mock 先行，业务闭环**：在正式数据接入前，基于已有 `Agent-CdcBuddy-DataMock` 全面生成覆盖河南省 18 地市与 126 区县的时空 Mock 数据集，确保功能清单中的所有算法模型与可视化组件均能进行真实全链路演练与效果验证。
3. **服务解耦，互不干扰**：四个智能体作为四个独立的 Node.js / Docker 进程运行在不同端口（3001 ~ 3004），分别持有独立的业务数据库（工单状态、预警核销等），并通过 Nginx 网关对外暴露独立 URL，实现故障隔离、独立重启与弹性运维。
4. **测试成果保留与规范继承**：完整保留并保护病媒生物智能体已建设完备的自动化测试成果（包括 `tests/automated_test_suite.py`、`comprehensive_evaluation_test.py`、`test_chat_sessions_real.ts` 以及生成的 `test_execution_report.md/.json`），将该自动化测试框架（指标断言、真实底座库查询、耗时度量、双格式报告输出）确立为全平台统一质保标准。后续扩展的食源性、环境健康、死因慢病三个智能体，均严格按照此标准编写并扩展专属自动化测试套件。

---

## 二、统一界面框架与场景化驱动机制

### 1. 场景配置驱动模型 (`AgentProfile`)
在 `src/lib/config/agent-profile.ts` 中定义四智能体的静态配置文件：

```typescript
export type AgentDomainType = 'vector' | 'foodborne' | 'env' | 'chronic';

export interface AgentProfile {
  domain: AgentDomainType;
  name: string;
  badgeTitle: string;
  themeColor: 'teal' | 'orange' | 'cyan' | 'rose';
  defaultPort: number;
  routePrefix: string;
  datasetDbName: string;
  businessDbName: string;
  systemPrompt: string;
  recommendations: Array<{
    category: string;
    items: string[];
  }>;
  initialGenerativeView: Record<string, any>;
  skillIds: string[];
}
```

#### 四智能体属性对照表：
| 配置项 | （二）病媒与宿主生物 | （三）食源性疾病 | （四）环境相关风险 | （五）死因慢病伤害 |
| :--- | :--- | :--- | :--- | :--- |
| **Domain 标识** | `vector` | `foodborne` | `env` | `chronic` |
| **应用名称** | 病媒生物与宿主动物监测预警 | 食源性疾病监测预警 | 环境健康监测预警 | 死因、慢病及伤害综合监测 |
| **主题主色调** | 疾控青绿 (`teal`) | 活力橙红 (`orange`) | 深邃海蓝 (`cyan`) | 沉稳紫红 (`rose`) |
| **标准服务端口** | `3001` (或 3000) | `3002` | `3003` | `3004` |
| **推荐网关路径** | `/vector/` | `/food/` | `/env/` | `/death/` |
| **分析事实底座** | `vector_monitoring.db` | `foodborne_monitoring.db` | `env_monitoring.db` | `chronic_monitoring.db` |
| **业务闭环底座** | `app_business_vector.db` | `app_business_food.db` | `app_business_env.db` | `app_business_chronic.db`|

### 2. AG-UI 生成式界面组件渲染升级
`GenerativeComponentRenderer.tsx` 保持统一接口规范，基于组件注册表（Registry Pattern）动态加载场景组件：

```
src/components/ag-ui/
├── core/                               # 跨领域通用基座组件
│   ├── GenerativeComponentRenderer.tsx # 统一渲染路由器
│   ├── BaseGISMapComponent.tsx         # 国家天地图底图封装 (支持热力/网格/气泡多图层)
│   ├── BaseForecastTrendChart.tsx      # 双轴时序外推与置信区间带
│   ├── BaseDisposalWorkflowCard.tsx    # 48小时处置工单闭环卡
│   ├── BaseReportViewer.tsx            # PDF/Markdown 研判专报一键导出
│   └── BaseDataTableModal.tsx          # Text2SQL 数据明细钻取表格
├── domain-vector/                      # 病媒专属组件 (已完成)
│   ├── VectorMapComponent.tsx
│   ├── ResistanceMatrixChart.tsx
│   └── TransmissionRiskGauge.tsx
├── domain-foodborne/                   # 食源性专属组件 (新增)
│   ├── FoodborneClusterRadar.tsx       # 时空聚集性预警雷达
│   ├── MolecularPhylogenyTree.tsx      # 致病菌分子同源进化树/传播拓扑
│   ├── FoodRiskRankingChart.tsx        # 高风险嫌疑食品 TOP10 归因图
│   └── OutbreakEpidemiologyCard.tsx    # 聚集性疫情处置与溯源指引卡
├── domain-env/                         # 环境健康专属组件 (新增)
│   ├── WaterPipelineGISMap.tsx         # 供水管网与水质超标扩散热力图
│   ├── DLNMExposureChart.tsx           # 极端气温/雾霾滞后健康效应曲线
│   ├── SewageTracingGraph.tsx          # 污水管网病原空间聚类溯源图
│   └── PublicPlaceRatingRadar.tsx      # 公共场所多维卫生动态评级雷达
└── domain-chronic/                     # 死因慢病专属组件 (新增)
    ├── ICD10InferenceCard.tsx          # 根本死因推断与 ICD-10 知识图谱推理卡
    ├── LifeTableGauge.tsx              # 简略寿命表与重大慢病早死率 (4q70) 仪表
    ├── ChronicPrevalenceGISMap.tsx     # 恶性肿瘤/心脑血管标化患病率等值面
    └── InjuryDecisionTreeCard.tsx      # 伤害聚类与决策树危险因素归因图
```

---

## 三、三大扩展领域功能逐项落地设计

对照 [功能需求清单.md](file:///Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy/plan/人工智能-四智能体-功能清单.md) 第（三）、（四）、（五）部分，实现 100% 全功能点映射设计。

---

### 1. 食源性疾病监测预警智能体（功能清单 36 ~ 41）

#### 业务定位
聚焦食源性疾病病例上报、聚集性暴发事件早期探测、致病菌分子同源（PFGE / MLST / WGS）溯源、食品安全抽检融合与暴发处置闭环。

```
┌────────────────────────────────────────────────────────────────────────┐
│               食源性疾病监测预警业务架构图 (Foodborne Disease)             │
├─────────────────┬──────────────────────────────────────────────────────┤
│ 1. 聚集性识别    │ • SaTScan 空间-时间-主诉症状圆柱扫描 (No. 36)          │
│                 │ • 动态弹性阈值算法（区分学校、工厂食堂、农村婚宴场景） │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 2. 风险时序预测  │ • LSTM 深度时序预测模型（融合季节、气温与历史就诊趋势） │
│                 │ • 结合常住人口密度与交通网络评估跨区域扩散风险 (No. 37)│
├─────────────────┼──────────────────────────────────────────────────────┤
│ 3. 分子同源溯源  │ • cgMLST 核心基因组等位基因位点差异网络分析 (No. 38)   │
│                 │ • 知识图谱跨医院、跨区县匹配同源菌株传播链             │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 4. 处置决策建议  │ • 标准化处置规范智能匹配（下发留样抽检与患者回访单）   │
│                 │ • 历史处置案例库语义相似度推荐 (No. 39)                │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 5. 动态监测大屏  │ • 河南省食源性病例热力态势与钻取分析                   │
│                 │ • 高风险嫌疑食品 TOP 10 暴露归因占比 (No. 40)          │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 6. 报告自动生成  │ • 暴发事件一键生成《流行病学调查简报》与周/月报 (No. 41)│
└─────────────────┴──────────────────────────────────────────────────────┘
```

#### 技能 (Skills) 映射与执行逻辑：
1. `skill_foodborne_cluster_detect` (No. 36 聚集性病例识别模型)：
   - **调用引擎**：`analytics_engine/core/satscan_cluster.py`（空间坐标 + 潜伏期时窗 + 共同饮食暴露）；
   - **输入**：`time_window_days`、`district`、`symptom_filter`；
   - **输出与 AG-UI**：返回聚集性事件列表，渲染 `FoodborneClusterRadar`，支持地图钻取到涉案餐馆/学校。
2. `skill_foodborne_risk_forecast` (No. 37 风险预测模型)：
   - **调用引擎**：`analytics_engine/core/lstm_predictor.py`；
   - **输入**：`city`、`pathogen_type`（副溶血性弧菌/沙门氏菌/诺如病毒/蜡样芽胞杆菌）、`forecast_weeks`；
   - **输出与 AG-UI**：生成高风险区域预测与未来 4 周发病曲线（带置信区间）。
3. `skill_molecular_trace` (No. 38 病原体溯源分析)：
   - **调用引擎**：`analytics_engine/foodborne/cgmlst_cluster.py`；
   - **算法**：基于菌株等位基因矩阵计算汉明距离/欧氏距离，通过 UPGMA 构建进化树（距离 $\le 5$ 标记同源聚类）；
   - **输出与 AG-UI**：渲染 `MolecularPhylogenyTree`，直观呈现不同医院病例的分离菌株是否属于同一暴发源。
4. `skill_food_attribution` (No. 38 辅助：嫌疑食品挖掘)：
   - **调用引擎**：`analytics_engine/core/apriori_miner.py`；
   - **算法**：对病例进食清单与抽检阳性数据执行频繁项集关联挖掘，计算暴露比值比 (Odds Ratio, OR)；
   - **输出与 AG-UI**：输出高风险食物 TOP10 条形图。
5. `skill_outbreak_disposal_advice` (No. 39 自动生成处置建议)：
   - **调用**：`app-business-provider` 检索知识库与标准流调指南，生成《食源性暴发处置工单》；
   - **输出与 AG-UI**：渲染 `OutbreakEpidemiologyCard`，派发流调任务并倒计时跟踪。
6. `skill_foodborne_report_export` (No. 41 智能报告生成)：
   - **输出与 AG-UI**：自动汇总当前聚集性事件详情、分子溯源结果、进食史调查，生成图文并茂的《食源性疾病暴发调查专题公报》（PDF/MD 导出）。

---

### 2. 环境相关风险因素监测预警智能体（功能清单 42 ~ 58）

#### 业务定位
涵盖生活饮用水全流程水质安全、污水管网病原监测、公共场所多维卫生评级、空气质量与极端气候健康风险评估、四河流域重金属跨介质污染链推演及情景模拟。

```
┌────────────────────────────────────────────────────────────────────────┐
│               环境健康监测预警业务架构图 (Environmental Health)          │
├─────────────────┬──────────────────────────────────────────────────────┤
│ 1. 智能录入清洗  │ • OCR 识别引擎（检验报告单图片/PDF自动提取） (No. 42)  │
│                 │ • 缺失值与异常值时空插值填充，GB标化校正 (No. 43)     │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 2. 水质安全预警  │ • 随机森林致癌/非致癌健康风险定量评估模型 (No. 44)    │
│                 │ • LSTM 水质趋势预测 + 供水管网克里金插值热力 (No. 45) │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 3. 污水病原监测  │ • 污水核酸浓度与哨点医院门诊时序滞后相关 (Pearson)     │
│                 │ • 污水管网拓扑反向聚类，定位污染排泄源区 (No. 46, 47) │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 4. 公共场所卫生  │ • "环境指标-健康效应"映射模型与动态综合评级 (No. 48,49)│
├─────────────────┼──────────────────────────────────────────────────────┤
│ 5. 空气与极端气候│ • PM2.5/O3 人群日均暴露量与呼吸门诊峰值预测 (No. 50)  │
│                 │ • GBDT 热浪/寒潮模型，提前 72h 生成健康防护预警 (No.51)│
├─────────────────┼──────────────────────────────────────────────────────┤
│ 6. 四河流域评估  │ • "水体(重金属)-土壤(镉)-粮食(铅)"跨介质链条关联(No.52)│
│                 │ • 空间自相关 (Moran's I) 定位环境-肿瘤高危集聚区(No.53)│
├─────────────────┼──────────────────────────────────────────────────────┤
│ 7. 预警/干预/推演│ • 三级动态预警 (阈值/趋势/联动综合指数) (No. 54)       │
│                 │ • 针对水质、空气重污染的精准干预建议推送 (No. 55)      │
│                 │ • 情景模拟推演（关闭污染源对健康指标改善量评估）(No.57)│
│                 │ • 移动端采样扫码、异常点拍照与离线缓存 API (No. 58)    │
└─────────────────┴──────────────────────────────────────────────────────┘
```

#### 技能 (Skills) 映射与执行逻辑：
1. `skill_env_ocr_entry` (No. 42 OCR 引擎)：
   - **调用引擎**：集成轻量化 OCR 模块（如 PaddleOCR/EasyOCR 或多模态 LLM 视觉提取），从水质质检单、空气监测表图片中解析结构化 JSON 并写入待复核池。
2. `skill_water_safety_eval` (No. 44/45 饮用水安全评估与趋势)：
   - **调用引擎**：`analytics_engine/env/water_risk_rf.py`（随机森林模型）+ 普通克里金空间插值；
   - **输入**：`water_source_type`（出厂水/末梢水/二次供水）、`turbidity`、`free_chlorine`、`heavy_metals`；
   - **输出与 AG-UI**：渲染 `WaterPipelineGISMap`，在天地图上高亮超标水厂供水区域及未来水质指标劣化趋势。
3. `skill_sewage_pathogen_trace` (No. 46/47 污水病原监测与溯源)：
   - **调用引擎**：Pearson 时序互相关分析（Cross-Correlation，探测 3~7 天提前预警信号）+ 管网 GIS 空间聚类；
   - **输出与 AG-UI**：渲染 `SewageTracingGraph`，呈现污水病原浓度与临床病例上升趋势的滞后关联。
4. `skill_air_climate_health_risk` (No. 50/51 空气与极端天气预警)：
   - **调用引擎**：`analytics_engine/env/dlnm_model.py`（分布滞后非线性模型）+ GBDT 热浪/寒潮模型；
   - **输出与 AG-UI**：渲染 `DLNMExposureChart`，提前 72 小时向老幼及心血管脆弱人群推送分级健康防御预警。
5. `skill_river_basin_pollution_chain` (No. 52/53 四河流域环境健康评估)：
   - **调用引擎**：局部空间自相关（Local Moran's I）与多元线性相关；
   - **输出与 AG-UI**：输出重金属污染跨介质传递桑基图与流域沿线健康集聚区地图。
6. `skill_env_scenario_simulation` (No. 57 情景模拟推演)：
   - **算法**：基于训练好的环境健康风险方程，接收用户假定策略（如“关停某工业排放源”或“升级某水厂膜过滤设施”），计算模拟前后的 AQI 降低值、超标人口减少率与预期门诊就诊降幅；
   - **输出与 AG-UI**：以直观对比卡（Before / After）输出推演结论。

---

### 3. 死因、慢病及伤害综合监测预警智能体（功能清单 59 ~ 76）

#### 业务定位
聚焦人口全死因医学证明书智能质控与 ICD-10 自动编码、根本死因推断、恶性肿瘤/脑卒中/冠心病等重大慢病发病预测、慢性病过早死亡概率测算、伤害聚类与危险因素归因及精准干预。

```
┌────────────────────────────────────────────────────────────────────────┐
│          死因、慢病及伤害综合监测预警业务架构图 (Chronic & Mortality)       │
├─────────────────┬──────────────────────────────────────────────────────┤
│ 1. 质控与NLP解析 │ • 死因链逻辑冲突/缺漏项智能质控 (检出率≥98%) (No. 59)  │
│                 │ • 根本死因医学文本 NLP 解析与 ICD-10 智能匹配 (No. 60) │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 2. 死因监测分析  │ • 基于医学知识图谱的根本死因规则推理模型 (No. 61)     │
│                 │ • ARIMA 死亡率趋势预测 + DBSCAN 死亡图谱聚类 (No. 62)  │
│                 │ • 罕见死因短期聚集（≥3例同类罕见病）预警触发 (No. 63) │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 3. 慢病监测分析  │ • GBDT 个体重大心脑血管/肿瘤发病风险预测 (≥80%) (No.64)│
│                 │ • 慢病并发症 Apriori 关联规则挖掘 (No. 65)             │
│                 │ • 高风险人群筛查推荐清单与卫生经济学成本效益比 (No. 66)│
├─────────────────┼──────────────────────────────────────────────────────┤
│ 4. 伤害监测分析  │ • 伤害病例时空聚类（跌倒/交通/溺水等高发场景） (No. 67) │
│                 │ • 决策树诱因归因（农机伤害、未佩戴护具等关联） (No. 68)│
│                 │ • 同一场所≥5例同类伤害聚集性事件自动标记与溯源 (No.69) │
├─────────────────┼──────────────────────────────────────────────────────┤
│ 5. 预警推送/报告 │ • 阈值/趋势(LSTM)/关联预警，向省/市/基层分级推送(70,71)│
│                 │ • 自动生成死因(顺位/YPLL)、慢病、伤害监测公报 (72, 73) │
│                 │ • 针对高危死因、慢病群体、高发伤害提供精准干预 (74-76) │
└─────────────────┴──────────────────────────────────────────────────────┘
```

#### 技能 (Skills) 映射与执行逻辑：
1. `skill_icd10_nlp_inference` (No. 59/60/61 数据质控与根本死因推断)：
   - **调用引擎**：`analytics_engine/chronic/icd10_graph_reasoning.py`；
   - **算法**：结合医学知识图谱与 ICD-10 编码规则，对死因链顺序（a直接死因 $\leftarrow$ b引起a $\leftarrow$ c引起b $\leftarrow$ d根本原因）执行逻辑校验与根本死因自动推导；
   - **输出与 AG-UI**：渲染 `ICD10InferenceCard`，高亮推导路径与确信度评分。
2. `skill_mortality_cluster_rare` (No. 62/63 死亡图谱与罕见死因聚集)：
   - **调用引擎**：ARIMA 时序外推 + DBSCAN 空间高密度聚类 + 罕见死因（发生率 $< 1/100,000$ 且短时间 $\ge 3$ 例）规则触发器；
   - **输出与 AG-UI**：在 GIS 地图呈现死亡热力图与异常聚集预警卡。
3. `skill_chronic_risk_forecast` (No. 64/65 慢病风险预测与并发症挖掘)：
   - **调用引擎**：GBDT 多特征风险模型 + Apriori 并发症关联挖掘；
   - **输出与 AG-UI**：输出全省重大慢病标化患病率趋势、早死概率仪表盘及高风险并发症网络拓扑。
4. `skill_chronic_screening_roi` (No. 66 筛查推荐与成本效益)：
   - **算法**：结合区域流行病学基线与人口年龄构成，计算马尔可夫决策过程（Markov Model）下的增量成本效果比 (ICER)；
   - **输出与 AG-UI**：生成各区县优先筛查建议清单与预期投入产出比。
5. `skill_injury_attribution_tree` (No. 67/68/69 伤害聚类与归因分析)：
   - **调用引擎**：决策树分类归因模型（CART / C4.5）；
   - **输出与 AG-UI**：渲染 `InjuryDecisionTreeCard`，可视化呈现伤害诱因归因链条。
6. `skill_chronic_death_report` (No. 72/73 综合监测报告生成)：
   - **输出与 AG-UI**：一键生成全死因顺位、潜在寿命减损年（YPLL）、慢性病过早死亡率（$4q70$）全量公报。

---

## 四、全域 Mock 数据底座设计规范

在 `Agent-CdcBuddy-DataMock` 现有架构基础上进行规范化扩展，创建与真实业务 100% 对齐的三个领域数据集。

### 1. 统一时空标准规范
1. **统一空间代码 (`dim_location`)**：全业务统一采用河南省 18 个地级市（郑州、开封、洛阳等）及 126 个区县国标行政区划编码与天地图标准边界 GeoJSON，保证地图图层无缝下钻。
2. **统一时间颗粒度 (`dim_date`)**：全业务生成 **2021-01-01 至 2026-08-31**（5 年以上周期）的历史连续日度数据，包含季节、公休日、极端气象等外生变量。
3. **统一数据治理质量评分 (DQ Score)**：通过 `run_data_governance.py` 自动执行主外键关联、时空边界、逻辑完整性校验，达标（$\ge 95$ 分）后方可输出至 SQLite 底座。

### 2. 扩展事实表与维度表 DDL 设计

```text
Agent-CdcBuddy-DataMock/
├── data/
│   ├── vector/                     # [已有] 病媒生物监测 (11个表)
│   │   └── vector_monitoring.db
│   ├── foodborne/                  # [扩展] 食源性疾病监测库
│   │   ├── fact_foodborne_case.parquet        (病例上报: 主诉症状/可疑进食场所/潜伏期)
│   │   ├── fact_pathogen_molecular.parquet    (分子分型: 菌株号/血清型/cgMLST等位基因)
│   │   ├── fact_food_sampling.parquet         (抽检监测: 食品类别/环节/检出微生物指标)
│   │   ├── fact_outbreak_event.parquet        (暴发事件: 事件地点/发病人数/罹患率)
│   │   └── foodborne_monitoring.db
│   ├── env/                        # [扩展] 环境健康风险监测库
│   │   ├── fact_water_quality.parquet         (水质监测: 浊度/余氯/pH/重金属/微生物)
│   │   ├── fact_air_environment.parquet      (空气质量: PM2.5/PM10/AQI/日温湿度)
│   │   ├── fact_sewage_pathogen.parquet       (污水病原: 管网采样点/病原核酸拷贝数)
│   │   ├── fact_public_place_hygiene.parquet  (公共场所: 微小气候/二氧化碳/菌落总数)
│   │   ├── fact_four_rivers_basin.parquet     (四河流域: 重金属铅镉在水/土/粮链条浓度)
│   │   └── env_monitoring.db
│   └── chronic/                    # [扩展] 死因、慢病及伤害监测库
│       ├── fact_death_registry.parquet        (死因证明书: 性别/死因链/ICD-10根本死因)
│       ├── fact_chronic_incidence.parquet     (慢病确诊: 肿瘤/脑卒中/冠心病/病理分期)
│       ├── fact_injury_surveillance.parquet   (伤害门诊: 跌倒/交通事故/严重度/场所)
│       ├── fact_behavior_risk.parquet         (危险因素: 吸烟率/高盐饮食率/超重肥胖率)
│       ├── dim_icd10.parquet                  (ICD-10 分类字典树)
│       └── chronic_monitoring.db
├── etl.py                          # 统一 ETL 管道 (Parquet ➔ SQLite/Kingbase)
└── run_data_governance.py          # 跨领域数据治理与完整性验收脚本
```

### 3. Mock 数据特征与逻辑注入规则
- **食源性疾病 Mock**：
  - 构造夏季（6~8月）沿海海鲜副溶血性弧菌感染峰值、春季学校诺如病毒聚集性暴发事件；
  - 注入 3 起具备高度分子同源特征的聚集性案例（其 cgMLST 差异位点 $\le 3$），供同源溯源算法验证。
- **环境健康 Mock**：
  - 构造特定暴雨洪水期出厂水浊度升高与末梢水余氯衰减案例；
  - 构造冬季采暖期 PM2.5 突增对老年人呼吸科门诊量 3 天滞后效应；
  - 注入四河流域沿岸工业区“水体镉-土壤镉-稻米镉”跨介质高浓度梯次关联。
- **死因慢病 Mock**：
  - 注入 50,000+ 条死因证明书样本，涵盖标准死因链与 2% 典型逻辑矛盾样本（用于校验模型测试）；
  - 构造吸烟率、高盐饮食率与心脑血管事件发生率的正相关性分布。

---

## 五、科学计算算法中台扩展设计

`analytics_engine/` 将升级为**跨领域通用疾控科学计算中台**，采用通用核心与领域专用扩展结合的模块化结构：

```
analytics_engine/
├── core/                                # 通用基础科学计算引擎
│   ├── satscan_cluster.py               # 通用 SaTScan 空间-时间圆柱扫描统计量
│   ├── lstm_predictor.py                # 通用 PyTorch 双向多变量 Bi-LSTM 预测网络
│   ├── spatial_interpolation.py         # 通用普通克里金 (Kriging) 与反距离权重 (IDW)
│   ├── apriori_miner.py                 # 通用频繁项集与关联规则挖掘
│   ├── gbdt_risk_regressor.py           # 通用梯度提升树风险回归模型
│   └── text2sql_helper.py               # 领域语义转换辅助工具
├── vector/                              # [已有] 病媒生物专属算法
│   ├── population_dynamics.py
│   ├── species_clustering.py
│   ├── resistance_ml.py
│   └── transmission_risk.py
├── foodborne/                           # [扩展] 食源性疾病专属算法
│   ├── cgmlst_cluster.py                # 核心基因组等位基因分子聚类与进化树
│   ├── outbreak_scanner.py              # 聚集性疫情弹性阈值探测
│   └── food_attribution.py              # 暴露食品归因与比值比计算
├── env/                                 # [扩展] 环境健康专属算法
│   ├── water_risk_rf.py                 # 饮用水健康风险随机森林模型
│   ├── dlnm_model.py                    # 分布滞后非线性模型 (DLNM)
│   ├── sewage_cross_correlation.py      # 污水病原时序滞后相关与反向管网追踪
│   └── river_basin_spatial_autocorr.py  # 四河流域空间自相关与跨介质传递
└── chronic/                             # [扩展] 死因慢病专属算法
    ├── icd10_graph_reasoning.py         # 根本死因知识图谱推理与逻辑质控
    ├── life_table_calculator.py         # 简略寿命表与早死概率 ($4q70$) 测算
    ├── chronic_gbdt_predictor.py        # 个体与群体慢病发病预测
    ├── injury_decision_tree.py          # 伤害诱因决策树归因
    └── serfling_excess_mortality.py     # Serfling 回归超额死亡率模型
```

---

## 六、多端口独立运行与 URL 路由部署方案

为满足“四个智能体分别运行在不同服务端口或 URL 互不影响，便于后续部署维护”的要求，设计多实例隔离方案。

### 1. 运行时配置与端口矩阵

每个智能体通过不同的环境配置启动，拥有独立的运行参数与存储底座：

| 智能体名称 | 运行环境变量 (`AGENT_DOMAIN`) | 独立端口 | 业务专属 SQLite/PG | 独立日志文件 | 独立 PID 标识 |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **病媒生物与宿主动物** | `AGENT_DOMAIN=vector` | `3001` | `vector_monitoring.db`<br>`app_business_vector.db` | `logs/vector.log` | `.server_vector.pid` |
| **食源性疾病监测预警** | `AGENT_DOMAIN=foodborne` | `3002` | `foodborne_monitoring.db`<br>`app_business_food.db` | `logs/foodborne.log` | `.server_foodborne.pid` |
| **环境健康风险监测预警** | `AGENT_DOMAIN=env` | `3003` | `env_monitoring.db`<br>`app_business_env.db` | `logs/env.log` | `.server_env.pid` |
| **死因慢病伤害综合监测** | `AGENT_DOMAIN=chronic` | `3004` | `chronic_monitoring.db`<br>`app_business_chronic.db` | `logs/chronic.log` | `.server_chronic.pid` |

### 2. 统一运维管理脚本升级 (`server.sh`)

升级后的 `server.sh` 脚本支持对单个智能体或全部智能体进行一键控制：

```bash
# 启动单个智能体
./server.sh start vector dev      # 启动病媒智能体 (Port 3001)
./server.sh start foodborne dev   # 启动食源性智能体 (Port 3002)
./server.sh start env dev         # 启动环境健康智能体 (Port 3003)
./server.sh start chronic dev     # 启动死因慢病智能体 (Port 3004)

# 启动全量智能体集群
./server.sh start all dev

# 停止或重启指定智能体
./server.sh stop foodborne
./server.sh restart vector prod

# 查看运行状态矩阵与健康度
./server.sh status
```

**状态输出效果示意**：
```text
[2026-09-24 16:30:00] CDC Multi-Agent Platform Status:
┌──────────────┬──────┬─────────┬──────────────┬─────────────────────────┐
│ Domain       │ Port │ PID     │ Status       │ Dataset / DB            │
├──────────────┼──────┼─────────┼──────────────┼─────────────────────────┤
│ vector       │ 3001 │ 12845   │ RUNNING (OK) │ vector_monitoring.db    │
│ foodborne    │ 3002 │ 12890   │ RUNNING (OK) │ foodborne_monitoring.db │
│ env          │ 3003 │ 12933   │ RUNNING (OK) │ env_monitoring.db       │
│ chronic      │ 3004 │ 12988   │ RUNNING (OK) │ chronic_monitoring.db   │
└──────────────┴──────┴─────────┴──────────────┴─────────────────────────┘
```

### 3. 生产环境容器编排与 Nginx 反向代理网关

在生产部署中，利用 Docker Compose 编排 4 个独立容器实例，并通过统一前置 Nginx 进行 URL 路径与子域名前缀分发：

```
                                ┌───────────────────────────────────┐
                                │   Client Browser / 疾控专网访问   │
                                └─────────────────┬─────────────────┘
                                                  │ HTTP/HTTPS: 80 / 443
                                                  ▼
                                ┌───────────────────────────────────┐
                                │      Nginx 统一反向代理网关       │
                                └──────┬─────┬─────────┬─────┬──────┘
                                       │     │         │     │
                 ┌─────────────────────┘     │         │     └─────────────────────┐
                 │ /vector/                  │ /food/  │ /env/                     │ /death/
                 ▼                           ▼         ▼                           ▼
      ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
      │  cdc-agent-vector    │    │ cdc-agent-foodborne  │    │   cdc-agent-env      │    │  cdc-agent-chronic   │
      │  Port: 3001          │    │ Port: 3002           │    │   Port: 3003         │    │  Port: 3004          │
      ├──────────────────────┤    ├──────────────────────┤    ├──────────────────────┤    ├──────────────────────┤
      │ vector_monitoring.db │    │foodborne_monitor.db  │    │ env_monitoring.db    │    │ chronic_monitoring.db│
      │ app_business_vec.db  │    │ app_business_food.db │    │ app_business_env.db  │    │ app_business_chr.db  │
      └──────────────────────┘    └──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

#### Nginx 路由配置示例 (`docker/nginx.conf`)：
```nginx
upstream agent_vector    { server app_vector:3000; }
upstream agent_foodborne { server app_foodborne:3000; }
upstream agent_env       { server app_env:3000; }
upstream agent_chronic   { server app_chronic:3000; }

server {
    listen 80;
    server_name cdc-ai.local;

    # 1. 病媒生物与宿主动物智能体
    location /vector/ {
        proxy_pass http://agent_vector/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 2. 食源性疾病监测预警智能体
    location /food/ {
        proxy_pass http://agent_foodborne/;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 3. 环境相关风险因素监测预警智能体
    location /env/ {
        proxy_pass http://agent_env/;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 4. 死因、慢病及伤害综合监测预警智能体
    location /death/ {
        proxy_pass http://agent_chronic/;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 统一根路径导航页 (Portal)
    location / {
        root /usr/share/nginx/html/portal;
        index index.html;
    }
}
```

---

## 七、实施推进路线图与验证里程碑

按照业务模块解耦与循序渐进的交付逻辑，建议分四个关键阶段推进：

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              四智能体全域平台研发里程碑                                 │
├──────────────┬─────────────────────────────────────────────────────────────────────────┤
│ 阶段一 (2周) │ 架构通用解耦与多实例运维改造                                             │
│              │ • 抽象 `AgentProfile` 场景配置驱动机制与主题切换                         │
│              │ • 改造 `server.sh` 与 Dockerfile，实现 3001~3004 独立服务端口隔离        │
│              │ • 搭建 DataMock 扩展目录与跨领域 Mock 数据生成生成器                     │
├──────────────┼─────────────────────────────────────────────────────────────────────────┤
│ 阶段二 (3周) │ （三）食源性疾病智能体落地                                               │
│              │ • 编写食源性疾病 Mock 数据 (病例、抽检、cgMLST 分子分型)                 │
│              │ • 实现分子聚类树与暴发时空扫描算法                                       │
│              │ • 开发 `FoodborneClusterRadar` 等 4 个专属 AG-UI 组件与 6 个 Skills     │
│              │ • 独立部署在 3002 端口并完成全功能闭环验证                               │
├──────────────┼─────────────────────────────────────────────────────────────────────────┤
│ 阶段三 (3周) │ （四）环境健康风险智能体落地                                             │
│              │ • 编写饮用水、空气质量、污水病原、四河流域 Mock 数据                     │
│              │ • 实现 DLNM 滞后暴露模型、水质随机森林评估与克里金扩散插值               │
│              │ • 开发 `WaterPipelineGISMap` 等 4 个专属 AG-UI 组件与 17 个 Skills      │
│              │ • 独立部署在 3003 端口并完成情景模拟推演验证                             │
├──────────────┼─────────────────────────────────────────────────────────────────────────┤
│ 阶段四 (3周) │ （五）死因、慢病及伤害智能体落地                                         │
│              │ • 编写死因医学证明书、重大慢病发病、伤害门诊 Mock 数据                   │
│              │ • 实现 ICD-10 知识图谱推理、简略寿命表早死率与决策树归因算法             │
│              │ • 开发 `ICD10InferenceCard`、`LifeTableGauge` 等专属 AG-UI 组件         │
│              │ • 独立部署在 3004 端口并完成死因公报与筛查清单导出验证                   │
├──────────────┼─────────────────────────────────────────────────────────────────────────┤
│ 阶段五 (1周) │ 统一集成验证、自动化测试与专家评审验收                                   │
│              │ • 全量四智能体自动化测试套件执行（Text2SQL、算法引擎、UI渲染）           │
│              │ • Nginx 统一网关路由联调与压力稳定性测试                                 │
│              │ • 输出功能对照检查报告与交付文档                                         │
└──────────────┴─────────────────────────────────────────────────────────────────────────┘
```

---

## 八、自动化测试套件扩展标准与质量保障（继承病媒成果）

### 1. 现有病媒自动化测试资产与成果架构
病媒智能体已建立了全链路自动化测试套件（`tests/automated_test_suite.py`，1043 行代码），其核心架构与质量标准已完全成熟：
- **事实底座驱动**：直连底座库（`vector_monitoring.db` 48,530+ 条真实记录）及业务库（`app_business.db`），杜绝单元测试打桩假数据；
- **全场景需求覆盖**：严格对照功能清单序号（No. 23 ~ No. 35），对每一个模型输出的误差率、耗时（如响应时间 $\le 2$ 秒）、数据完整性进行断言；
- **标准化报告产出**：每次运行自动在 `tests/` 下生成双格式评估报告（机器可读的 `test_execution_report.json` 与可直接向专家汇报的 `test_execution_report.md`）；
- **全流程集成测试**：配套前端会话测试（`test_chat_sessions_real.ts`）与中文地名空间推理规范化校验（`test_geo_and_chinese_reasoning.ts`）。

### 2. 四智能体自动化测试套件架构规划
后续扩展必须严格继承该测试框架与报告产出标准，形成矩阵化自动化测试目录体系：

```text
tests/
├── automated_test_suite.py            # [保持兼容] 病媒生物全量功能测试入口
├── comprehensive_evaluation_test.py   # [保持兼容] 综合评价自动化测试
├── test_geo_and_chinese_reasoning.ts  # [保持兼容] 河南地名空间规范推理测试
├── test_chat_sessions_real.ts         # [保持兼容] 真实会话端到端测试
│
├── suites/                            # 模块化智能体专属测试套件
│   ├── test_suite_vector.py           # [对齐 23~35] 病媒生物与宿主动物测试套件
│   ├── test_suite_foodborne.py        # [对齐 36~41] 食源性疾病监测预警测试套件
│   ├── test_suite_env.py              # [对齐 42~58] 环境健康风险监测预警测试套件
│   └── test_suite_chronic.py          # [对齐 59~76] 死因慢病伤害综合监测测试套件
│
├── run_all_agent_tests.py             # 全域四智能体一键自动化测试聚合执行器
├── reports/                           # 统一测试报告存储目录
│   ├── report_vector.md / .json       # 病媒测试报告
│   ├── report_foodborne.md / .json    # 食源性测试报告
│   ├── report_env.md / .json          # 环境健康测试报告
│   ├── report_chronic.md / .json      # 死因慢病测试报告
│   └── all_agents_test_report.md      # 全域综合执行汇总公报 (可一键导出审阅)
```

### 3. 三大扩展领域量化断言与测试矩阵
将功能清单中各项硬性量化指标直接转化为自动化断言：

| 智能体 | 需求项 | 核心算法与场景 | 硬性指标与自动化断言规则 |
| :--- | :--- | :--- | :--- |
| **食源性疾病** | No. 36 | 聚集性病例 SaTScan 识别 | `assert cluster_detected == True` 且对合成暴发事件的敏感度达到 $100\%$ |
| | No. 37 | LSTM 暴发风险预测 | 未来 4 周发病趋势预测相对误差率 $\le 12\%$，高发区域匹配度 $\ge 90\%$ |
| | No. 38 | 致病菌 cgMLST 同源聚类 | 相同突发污染源分离株的等位基因差异 $\Delta \le 5$，同源聚类正确率 $100\%$ |
| | No. 41 | 专题简报自动提取 | 暴发场所、涉案人数、致病菌种等核心要素提取完整率 $100\%$ |
| **环境健康** | No. 42 | OCR 检验单识别引擎 | 关键水质指标（浊度、余氯、大肠菌群）字段解析准确率 $\ge 95\%$ |
| | No. 43 | 数据清洗与标化模型 | 异常离群点检出率 $\ge 98\%$，标化后数据缺失率降低至 $0\%$ |
| | No. 44 | 随机森林水质风险评估 | 致癌/非致癌健康风险综合判定 AUC 指标 $\ge 0.88$ |
| | No. 46 | 污水病原时序滞后关联 | 污水核酸浓度与哨点门诊量 Pearson 相关系数在 3~7 天滞后窗口达到显著性 ($p < 0.05$) |
| | No. 51 | 极端天气脆弱人群预警 | GBDT 热浪/寒潮模型预警提前量达到 72 小时，触发时效 $\le 15$ 秒 |
| **死因慢病** | No. 59 | 死因证明书数据质量校验 | 逻辑矛盾、缺项、重复等错误检出率强制达到 **$\ge 98\%$** |
| | No. 60 | 根本死因 NLP 与 ICD-10 匹配| 根本死因文本解析与 ICD-10 编码准确率强制达到 **$\ge 95\%$** |
| | No. 63 | 罕见死因短期聚集识别 | 短期内出现 $\ge 3$ 例同类罕见死因自动触发事件标记与预警推送 |
| | No. 64 | 慢病个体发病风险预测 | GBDT 心脑血管/肿瘤 3~5 年发病概率预测准确率强制达到 **$\ge 80\%$** |
| | No. 69 | 伤害聚集性事件识别 | 同一场所短期 $\ge 5$ 例同类伤害自动判定为聚集性事件并触发溯源 |

### 4. 自动化测试脚本与运维工具链集成
在 `package.json` 与 `server.sh` 中全面植入自动化测试执行入口：

```bash
# 1. 运行单个智能体的自动化测试
npm run test:vector       # 执行病媒自动化测试
npm run test:foodborne    # 执行食源性疾病自动化测试
npm run test:env          # 执行环境健康自动化测试
npm run test:chronic      # 执行死因慢病自动化测试

# 2. 一键回归测试 (全域聚合，并行或串行运行并输出综合汇总报告)
npm run test:all

# 3. 通过统一运维脚本执行测试
./server.sh test vector
./server.sh test all
```

---

## 九、专家审阅与确认事项

为确保方案完全符合后续业务演进与验收标准，请您审阅并确认以下关键事项：
1. **测试标准继承**：上述规划完整保留了病媒已有测试成果，并明确了后续三个智能体的量化断言矩阵与双报告（MD/JSON）产出规范，是否符合您的质保预期？
2. **端口与路由规划**：当前规划默认使用 `3001 (vector)`、`3002 (foodborne)`、`3003 (env)`、`3004 (chronic)`，是否符合现行网络与服务器端口策略？
3. **落地优先级**：方案中建议优先研发食源性疾病（因为算法复用度最高，可在最短时间上线验证），后续紧接着开展环境健康与死因慢病；此排期是否符合您的预期？
4. **数据治理规范**：Mock 数据生成目前基准拟设定为 2021-2026 年（近 5 年历史跨度），空间颗粒度下沉至区县级，是否有进一步指定的要求？

