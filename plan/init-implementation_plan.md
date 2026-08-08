# 疾控病媒监测预警智能体系统 (CdcBuddy Vector Guard) 整体设计方案与开发计划

本项目面向疾控中心（CDC）病媒生物（蚊、蝇、鼠、蟑、蜱、恙螨）及宿主动物生态监测、病原检测、抗药性评估、动态预警与处置闭环，基于 **CopilotKit** 框架构建智能体应用。系统原生支持 **AG-UI 生成式界面**（含 MapLibre GL 空间地理地图、专业时空图表、交互式数据表格与动态处置卡片），具备 Skills 插件化引擎与自主对话扩展能力，并提供独立应用运行与嵌入式浮窗双模式。

---

## 一、 系统技术架构与选型

```
+-----------------------------------------------------------------------------------+
|                        疾控病媒监测预警智能体 (CdcBuddy Vector Guard)                |
+-----------------------------------------------------------------------------------+
|  [表现层 / AG-UI Generative Frontend] (Next.js 15 / React 19 / Tailwind / CSS)    |
|  * CopilotKit 对话交互与生成式卡片渲染 (CopilotSidebar / CopilotChat / CopilotPopup) |
|  * 时空地理组件: MapLibre GL (省/市/区三级下钻、热力图、网格聚合、监测点空间打点)       |
|  * 可视化组件: ECharts & Recharts (ARIMA密度趋势、种群雷达、抗药性矩阵、风险仪表盘)    |
|  * 业务工作台: 初始推荐 Prompt 瀑布流、快捷 Skills 技能市场、移动端数据录入仿真器    |
+-----------------------------------------------------------------------------------+
|  [智能体中枢 / Agent Core & Copilot Runtime]                                       |
|  * CopilotKit Runtime API Route (`/api/copilotkit`)                               |
|  * CDC 领域大模型中枢 (LLM Router + Prompt Engine + Text2SQL / Text2Skill)        |
|  * 会话状态管理、多轮上下文记忆与生成式 UI 动作分发 (Action Dispatcher)           |
+-----------------------------------------------------------------------------------+
|  [Skills 技能中枢 / Extensible Skills Engine]                                     |
|  * 预置标准技能 (8大业务模块, 功能清单 23~35项)                                     |
|  * 动态技能构建器 (Meta-Skill Builder): 用户对话一键生成/定制专属分析技能并持久化   |
|  * 技能执行上下文 (Tool Calling + Python / Node.js 统计推理内核)                  |
+-----------------------------------------------------------------------------------+
|  [安全与权限适配层 / RBAC Architecture]                                            |
|  * 4级角色控制: 省级疾控管理员 / 市级疾控专家 / 区县监测员 / 公众访客             |
|  * 行级数据空间隔离 (Province / City / District 辖区范围过滤) & 功能权限掩码      |
+-----------------------------------------------------------------------------------+
|  [数据引擎与存储层 / Vector Data Engine]                                           |
|  * 结构化数据库: `vector_monitoring.db` (SQLite 3 事实表 + 8 维度表，5.6万+记录)   |
|  * 列式分析引擎: `Agent-CdcBuddy-DataMock/data/*.parquet` (DuckDB / Polars 快速分析)|
|  * 空间与标准知识库: 河南省区划 GeoJSON、国家病媒生物消杀规范、ICD / 病原学知识库 |
+-----------------------------------------------------------------------------------+
```

### 1. 核心技术栈
1. **前端与应用框架**：
   - **Next.js 15 (App Router) + React 19 + TypeScript**
   - **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`) 实现自然语言与 Copilot 状态同步、Tool Action 调用、Generative UI 动态流式渲染。
   - **UI 风格设计**：现代医疗疾控科技风（Cyber CDC Slate & Neon Cyan 主题）、毛玻璃与微动效、自适应暗色/亮色模式。
2. **生成式 UI (AG-UI) 核心组件**：
   - **地图引擎**：`maplibre-gl` + `@types/maplibre-gl`，内置河南省 18 地级市及 126 区县矢量底图、热力插值图层、聚集区高亮、监测点聚类弹窗。
   - **数据图表引擎**：`echarts` + `echarts-for-react` / `recharts`（时序密度曲线、置信区间带、抗性堆叠柱状图、病原检出桑基图与雷达图）。
   - **报表与卡片**：富文本流式报告生成器（支持 Markdown、交互式表格、一键导出 PDF / Word / 图片）。
3. **后端与计算引擎**：
   - **Next.js API Routes** + **Node.js SQLite3 / `better-sqlite3`** + **Python 统计推理服务**（提供 ARIMA 时序预测、K-Means 聚类、GBDT 风险回归算法计算支持）。
   - **DuckDB-Wasm / SQLite API**：直接查询 `vector_monitoring.db` 与 `data/*.parquet`。

---

## 二、 核心模块与功能设计（对照《功能清单》23~35项）

### 模块 1：种群动态分析 (No. 23, 24)
- **23 种群动态模型**：
  - 基于 `fact_monitoring` 的 48,530 条生态监测记录与气象特征（温度、湿度），计算历史消长规律，运行时序预测模型（ARIMA / 季节性分解），生成未来 3 个月各病媒（如白纹伊蚊、淡色库蚊、褐家鼠、德国小蠊）密度波动趋势图与 95% 置信区间。
- **24 种群识别与优势种分析**：
  - 基于聚类与构成比算法，动态计算选定区域/时间段内各物种捕获比例（如伊蚊 vs 库蚊 vs 按蚊构成比），在 MapLibre 地图上以饼图/柱状图展示空间构成差异。

### 模块 2：抗药性评估与消杀方案推荐 (No. 25)
- **25 抗药性预测与消杀指导模型**：
  - 查询 `fact_insecticide_resistance` 及关联 `dim_pesticide`，解析各类杀虫剂（氯氰菊酯、溴氰菊酯、双硫磷等）的 LC50、LC95、毒力斜率与死亡率。
  - 自动评估耐药等级（敏感 / 低抗 / 中抗 / 高抗），输出**抗药性热力矩阵**，并智能匹配推荐消杀方案与轮换用药指南。

### 模块 3：病原携带风险分析 (No. 26)
- **26 病原携带风险评估模型**：
  - 关联 `fact_pathogen_detection`（7,336 条检测记录，涵盖登革病毒、乙脑病毒、恙虫病东方体、汉坦病毒等）与 `fact_monitoring` 捕获量。
  - 计算各监测点病原阳性率、最小感染率（MIR），结合空间宿主分布挖掘高风险传播组合，并在地图上标红预警。

### 模块 4：动态预警响应与处置闭环 (No. 27, 28, 29)
- **27 动态多维预警分析**：
  - 融合生态密度阈值、病原阳性突增、极端气象（高温暴雨），实时计算三级预警指数（一般-黄色 / 较重-橙色 / 严重-红色）。
  - 使用 MapLibre GL 空间插值渲染全省各区县风险热力图，支持从地级市钻取至区县与街道级。
- **28 风险分级推送与依据卡片**：
  - 自动生成标准化预警通知卡片（附带触发规则、历史对比基线、气象归因依据）。
- **29 处置闭环管理**：
  - 针对预警自动匹配处置建议（如"清除翻盆倒罐积水+超低容量空间喷雾"），生成处置任务工单，支持跟踪进度、上报处置结果并自动核销预警。

### 模块 5：中长期风险预测评估 (No. 30, 31, 32)
- **30 密度预测模型**：融合气象趋势与历史生境，预测未来 1~2 个月密度等级。
- **31 传播风险综合评估**：构建"病媒密度 × 病原携带率 × 暴露指数"数学模型，量化输出传染病输入与本地传播风险评分。
- **32 抗药性演化预测**：评估长期单一用药下的抗性突变趋势，给出提前 1 年的抗药性预警。

### 模块 6：自然语言智能问答 (NLQ) (No. 33)
- **33 NLQ 疾控知识与数据检索**：
  - 结合 CDC 专家知识库（病媒生态习性、鉴定特征图谱、监测规范 GB/T）与数据库 Text2SQL，实现自然语言秒级准确回答与图表联动呈现。

### 模块 7：自动化专题报告生成 (No. 34)
- **34 专题监测分析报告一键生成**：
  - 用户只需输入"生成郑州市2024年夏季蚊媒监测与登革热风险评估报告"，智能体自动抓取数据、绘制图表、编写专家评述与防控对策，生成富文本报告并支持 PDF / Markdown 导出。

### 模块 8：移动端现场采集与质控辅助 (No. 35)
- **35 现场录入与智能校验**：
  - 提供现场拍照识别物种模拟、经纬度与生境自动匹配、数据合理性校验（如气温异常、幼虫成虫数量矛盾预警）。

---

## 三、 Skills 架构与动态技能创建机制 (Skills Engine)

所有功能采用结构化的 **Skill 规范** 封装：

```typescript
export interface VectorSkill {
  id: string;
  name: string;
  category: 'population' | 'resistance' | 'pathogen' | 'warning' | 'report' | 'custom';
  description: string;
  icon: string;
  recommendedPrompts: string[];
  requiredRole?: UserRole[];
  parametersSchema: JSONSchema;
  handler: (args: any, context: SkillContext) => Promise<SkillResult>;
  renderComponent: (result: SkillResult) => React.ReactNode; // AG-UI 生成式界面组件
}
```

### 1. 预置基础技能目录 (8 大类 13 项)
1. `vector_population_dynamics` (种群消长与 ARIMA 预测)
2. `vector_species_composition` (优势种群聚类与构成比分析)
3. `vector_resistance_evaluation` (抗药性评估与用药推荐)
4. `vector_pathogen_risk` (病原携带阳性率与传播风险评估)
5. `vector_spatial_early_warning` (MapLibre 时空动态预警与热力图)
6. `vector_disposal_workflow` (处置闭环与消杀任务调度)
7. `vector_comprehensive_report` (自动化专题报告生成)
8. `vector_nlq_query` (多维数据智能问答与 Text2SQL)

### 2. 对话式创建新技能 (Meta-Skill / Conversational Skill Builder)
- 用户可以通过对话指令："*帮我创建一个新技能：专门分析近三年安阳市蜱虫携带恙虫病东方体的季节分布，并在地图上标出高危村镇*"。
- 智能体通过 `CreateCustomSkill` 工具分析用户意图，生成技能元数据、SQL 查询模板、过滤参数及对应的 AG-UI 可视化布局，动态保存至用户自定义 Skills 注册表，并在界面技能市场中即时生效。

---

## 四、 页面交互设计与双模式运行架构

### 1. 独立运行模式 (Standalone Mode - 第一阶段全功能)
- **首页探索视图**：
  - 顶部：疾控中心病媒生物智能体监控概览看板（河南省实时监测点数、活跃预警数、主要超标物种）。
  - 中部：精选推荐 Prompt 卡片流（如"查看最新全省蚊媒密度预警"、"分析氯氰菊酯抗药性"、"生成登革热专项报告"）与 Skills 技能大厅。
  - 主体：**双栏/全屏 Copilot 交互界面**：
    - 左侧/主区：**AG-UI 动态生成工作台**（MapLibre 空间地图、ECharts 分析图表、数据表格、生成的报告文档）。
    - 右侧/浮动：**Copilot 对话中枢**，用户自然语言输入，AI 协同流式输出思维链并在主区动态渲染对应的卡片和控件。
- **角色切换模拟器 (RBAC Switcher)**：顶部工具栏支持一键切换【省级管理员 / 市级专家 / 区县监测员 / 公众访客】以实时预览权限边界。

### 2. 业务系统嵌入模式 (Embedded Widget Mode - API & Floating Assistant)
- 提供 `<CdcBuddyWidget />` 嵌入式组件与独立打包脚本 `cdc-buddy-embed.js`。
- 其他疾控业务系统只需引入单行脚本或调用 REST/WebSocket API，即可在右下角弹出 AI 交互悬浮窗，并支持宿主系统向智能体传递当前登录用户 Token 与行政区划上下文。

---

## 五、 开发实施计划 (Development Roadmap)

### Phase 1: 基础设施与数据中枢搭建 (当前阶段)
- [x] 需求分析与架构设计方案评审
- [ ] 初始化 Next.js 15 + TypeScript + TailwindCSS + CopilotKit 项目框架
- [ ] 构建数据服务层：连接 `Agent-CdcBuddy-DataMock/vector_monitoring.db`，封装 SQLite / Parquet 高性能查询 API 及空间区划数据
- [ ] 构建 RBAC 权限控制架构与 Mock 鉴权中间件

### Phase 2: AG-UI 生成式组件库与可视化引擎开发
- [ ] 集成 **MapLibre GL**，构建河南省 18 市及 126 区县矢量地图组件、热力图层、点位聚合标记与信息浮窗
- [ ] 开发 ECharts / Recharts 图表库（时序消长曲线、抗药性矩阵、构成比雷达图、风险仪表盘）
- [ ] 开发结构化数据表格组件（排序、分页、指标筛选、CSV/Excel 导出）
- [ ] 开发富文本报告渲染与 PDF/Markdown 导出组件

### Phase 3: 核心 Skills 业务引擎实现 (功能清单 23~35 项)
- [ ] 实现种群动态与预测技能（ARIMA/时序消长趋势，优势种识别）
- [ ] 实现抗药性评估与用药推荐技能
- [ ] 实现病原体检测阳性率与传播风险评估技能
- [ ] 实现多维动态预警与处置闭环工作流技能
- [ ] 实现自然语言问答 (Text-to-SQL + 知识库问答) 与专题报告生成技能
- [ ] 实现 Meta-Skill 动态技能创建器（通过对话创建新技能）

### Phase 4: CopilotKit 深度集成与交互优化
- [ ] 注册 CopilotKit Actions 与自定义 Generative UI Renderers
- [ ] 实现初始界面的推荐 Prompt 瀑布流、快捷 Skills 菜单与历史会话管理
- [ ] 实现移动端现场数据录入与智能质控模拟器
- [ ] 封装独立运行与嵌入式浮窗组件 API

### Phase 5: 验证测试与交付
- [ ] 基于 `vector_monitoring.db` 5.6万条数据进行端到端测试
- [ ] 界面交互响应与 MapLibre 渲染性能调优
- [ ] 输出系统使用手册、API 文档与 Walkthrough

---

## 六、 验证与确认

### 自动化与数据验证
- 验证 SQLite 数据集查询性能（单次时空聚合响应时间 < 200ms）。
- 验证 CopilotKit Action 调用链与生成式 UI 渲染无死锁和错误。
- 验证 MapLibre GL 底图加载与 GeoJSON 空间数据准确度。

### 人机交互验证
- 验证 8 大业务模块对应的对话场景能否准确触发对应 Skills 并渲染图表/地图/表格。
- 验证用户通过自然语言能否成功创建新 Skill 并在后续会话中使用。
