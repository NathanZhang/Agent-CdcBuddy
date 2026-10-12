# 数据不足诊断与Mock生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 四域所有数据不足反馈均给出真实诊断；由主线Agent提供隔离Mock生成和现有方法真实重算。

**Architecture:** Skill负责按同次授权数据检查要求、现状和缺口，LLM依据结构化证据解释，AG-UI独立展示诊断。Mock由约束生成器写入独立不可变快照，所有读取绑定服务端执行数据上下文；生成与重算均由主线Agent执行Skills。

**Tech Stack:** 现有Next.js/React/TypeScript、Ajv、SQLite、Python/Pydantic、NumPy/SciPy/scikit-learn、HTTP/SSE与AG-UI；优先复用既有依赖。

**Spec:** [数据不足诊断与Agent生成Mock数据方案](../../reviews/2026-10-12/数据不足诊断与Agent生成Mock数据方案.md)。

## Global Constraints

- 状态：审阅稿；本次不实施代码、不生成数据。实施基线：`codex/cdcbuddy-refactor`，`c8dccd1`。
- 所有功能交互必须“主线Agent → 实际LLM → 实际Skills → 对话 + AG-UI”；不得返回固定业务对话、假指标或演示结果。
- 病媒默认observed；其他三域默认mock；任何生成进入独立simulation快照，默认来源不变。
- 仅六种既有ResultStatus；不足必须有诊断，FAILED/NO_DATA/CANCELLED的业务payload仍为null。
- 门槛为方法版本的实际运行要求；专业有效性单独声明，不因满足最低条件或模拟结果而视为专业验收。
- 首期不混合真实记录与生成记录，不实现planned专业模型，不创建模拟审批通知子系统。
- profile先授权，所有数据集选择由服务端校验；数据库路径不能来自客户端/LLM。
- 拟定生成预算：10,000事实行、50MB、120秒；每用户并发1、活跃数据集3，全局生成并发2，TTL7天；均可配置且不能绕过服务器上限。
- pilot默认关闭Mock生成；独立`manageMockDatasets`权限须显式授予。
- 原3轮8次工具预算不扩大；长任务复用持久Job续接Main Agent。

## Review Focus

- COUNT=0、AVG=null、值0、全阴性、无显著簇不同语义，不能均变成不足：任务2、3的边界测试。
- root SUCCESS但部分方法/滞后/指标不足，或NO_DATA空payload，诊断仍应可见且无旧成功图：任务3、4测试。
- profile统计可能越权、被限额截断或未取得，不能泄漏或假装精确总数：任务2、5测试。
- 生成过程取消、重复请求、过期快照、撤销权限和来源版本变化，不能留下半成品或越权续接：任务5、6测试。
- Mock重算必须真的消费新数据，且任何跨入口都不能将模拟结果用于真实通知、审批、复测消警：任务5、7测试。

## 文件和接口边界

所有路径相对当前重构工作树。以下新增文件负责单一功能；现有大型文件只添加接入和调用，不将策略或生成算法堆入Main Agent。

| 新增模块 | 职责 |
|---|---|
| `src/contracts/data-diagnostic.ts` | 统一诊断类型、schema、校验与跨结果引用约束 |
| `config/data-requirements.json` | Skill/方法/输出的版本化需求及依据 |
| `src/application/diagnostics/diagnostic-service.ts` | 加载规则、聚合检查、推荐注册动作，不生成业务对话 |
| `src/infrastructure/db/data-profile.ts` | 授权范围内的SQL质量/覆盖统计 |
| `analytics_engine/diagnostics.py` | Python算法同次读取产生检查证据 |
| `src/components/ag-ui/DataDiagnosticCard.tsx` | 诊断独立展示和Agent动作入口 |
| `src/contracts/dataset-selection.ts` | source/simulation上下文及Mock计划类型 |
| `src/infrastructure/db/mock-dataset-store.ts` | 沙箱注册、所有权、生命周期、租约和发布 |
| `src/application/mock/mock-service.ts` | 计划、权限、预算、幂等生成协调 |
| `src/domains/common/data-support-skills.ts` | 诊断、Mock规划、生成、重算四个真实Skill |
| `analytics_engine/synthetic/` | 四域参数化生成器与真实质量校验 |

### 约定的公开类型

定义放在任务1和5，不由各任务另起名字。

```ts
type CheckState = 'met' | 'unmet' | 'unknown' | 'not-applicable';
type DiagnosticCategory = 'NO_MATCH' | 'SAMPLE_GAP' | 'TEMPORAL_GAP' |
  'SPATIAL_GAP' | 'FIELD_GAP' | 'COMPATIBILITY' | 'QUALITY' |
  'PARAMETER_REQUIRED' | 'CAPABILITY' | 'VALIDATION' | 'RESOURCE';
type EvidenceValue = { state: 'measured' | 'unknown' | 'restricted';
  value: number | string | boolean | string[] | null; unit: string | null };
type RequirementBasis = 'implementation-minimum' | 'engineering-policy' |
  'validated-domain-rule' | 'expert-confirmation-needed';
type DataCheck = { key: string; state: CheckState;
  requirement: { operator: 'gte' | 'gt' | 'eq' | 'present' | 'compatible' | 'nonconstant';
    value: number | string | boolean | string[] | null; unit: string | null;
    policyId: string; policyVersion: string; basis: RequirementBasis };
  observed: EvidenceValue; gap: number | null; evidenceRef: string };
type DiagnosticAction = { id: string; kind: 'clarify' | 'adjust_scope' |
  'collect' | 'import' | 'select_method' | 'review' | 'mock_plan' | 'rerun';
  skillId: string | null; diagnosticId: string; enabled: boolean;
  disabledReason: string | null; requiredPermissions: string[];
  allowedMode: 'source' | 'simulation' | 'both'; argsSchemaId: string | null;
  expectedBenefit: string; limitation: string };
type DataDiagnostic = { id: string; runId: string; skillId: string;
  outputKey: string; groupKey?: string; domain: AgentDomain;
  scene: { name: string; goal: string; scope: Record<string, unknown> };
  method: { id: string; version: string; availability: 'available' | 'planned';
    validation: 'unvalidated' | 'validated' | 'not-applicable' };
  datasets: DatasetRef[]; factDateRange: { start: string | null; end: string | null;
    state: 'measured' | 'unknown' | 'restricted' };
  category: DiagnosticCategory; severity: 'blocking' | 'partial' | 'informational';
  reasonCode: string; checks: DataCheck[];
  impact: { blockedOutputs: string[]; availableOutputs: string[] };
  actions: DiagnosticAction[] };
type DatasetSelection = { mode: 'source' } |
  { mode: 'simulation'; datasetId: string };
```

`AgentDomain/DatasetRef/Principal/ExecutionContext/SkillResult`沿用现有导出位置；SkillResult v2与SkillExecution都增加`diagnostics: DataDiagnostic[]`。数值必须有限；诊断datasets只能引用结果datasets，资源无数据集时允许空数组；reasonCode和evidenceRef必须来自注册规则/已记录检查。原始病例ID不得自动写入公开diagnostic。

## Task 1 统一诊断契约与新旧结果兼容

**Files:** 新增`src/contracts/data-diagnostic.ts`；修改`src/contracts/skill-result.ts`、`src/contracts/skill-definition.ts`、`analytics_engine/contracts/result.py`、`analytics_engine/contracts/task.py`、`analytics_engine/engine.py`、`src/infrastructure/analytics/runner.ts`、`src/application/skills/skill-service.ts`；新增`tests/refactor/data-diagnostic-contract.test.ts`、`tests/scientific/test_data_diagnostic_contract.py`。

**Interfaces:** `validateDataDiagnostic(value: unknown): DataDiagnostic`；`validateSkillResult`新写入仅v2；新增`readHistoricalSkillResult(value: unknown): SkillResult | LegacySkillResult`用于只读v1兼容。Python用同字段模型；新写入同步切换`--protocol skill-result-v2`，v1仅保留历史读取/隔离兼容，不允许v2消费者误收v1生成结果；`task_result`接收算法diagnostics并保留空payload规则。

- [ ] Step 1 写失败测试：v2不足无blocking诊断拒绝；NaN/未知dataset/跨runId/evidenceRef非法拒绝；NO_DATA带诊断+null合法；资源缺失诊断允许datasets=[]；v1只读可用且不能新写入。
- [ ] Step 2 运行`npm run test:refactor -- tests/refactor/data-diagnostic-contract.test.ts`及`.venv/bin/python -m unittest tests.scientific.test_data_diagnostic_contract -v`，确认新增断言因接口缺失失败。
- [ ] Step 3 实现上述类型与Ajv/Pydantic边界，诊断可独立于业务payload；明确各缺口状态校验。
- [ ] Step 4 重跑上述命令，预期全部通过；再跑现有`results.test.ts`与`test_result_contract.py`并调整v2新写入fixture。
- [ ] Step 5 提交独立契约变更：`feat: add structured data diagnostic contract`。

## Task 2 版本化需求与授权后实际profile

**Files:** 新增`config/data-requirements.json`、`config/data-support-coverage.json`、`src/application/diagnostics/diagnostic-service.ts`、`src/infrastructure/db/data-profile.ts`、`analytics_engine/diagnostics.py`、`tests/refactor/data-profile.test.ts`、`tests/scientific/test_data_diagnostics.py`；修改`src/domains/shared/skill-factory.ts`。

**Interfaces:** `profileData(request: ProfileRequest, ctx: ExecutionContext): Promise<DataProfile>`；`ProfileRequest`含规范skillId、outputKey、已校验scope与允许字段；`DataProfile`含匹配数、有效数、缺失数、日期范围、截断及EvidenceValue；`buildDiagnostics(input: DiagnosticInput): DataDiagnostic[]`。`DiagnosticInput`含结果身份、规则键、实际checks、datasets与impact；Python`make_check(...)`输出对应DataCheck。profile不能接收任意服务器路径。

- [ ] Step 1 写失败测试：授权地域只测本辖区；200行返回上限不改变真实COUNT；COUNT=0与AVG=null/AVG=0分离；无日期/统计失败为unknown；缺口仅数值可比时计算；未知SQL需求不编门槛。
- [ ] Step 2 运行`npm run test:refactor -- tests/refactor/data-profile.test.ts`及`.venv/bin/python -m unittest tests.scientific.test_data_diagnostics -v`，确认失败。
- [ ] Step 3 登记规格覆盖清单中的规则和依据版本；实现同快照、有限预算、先授权的profile；查询/报告/导出连接真实空结果诊断，未取得统计保留unknown。
- [ ] Step 4 重跑新增测试并运行`npm run test:refactor -- tests/refactor/query-gateway.test.ts tests/refactor/domain-repository.test.ts tests/refactor/authorization.test.ts`，预期通过且无辖区/SQL约束退化。
- [ ] Step 5 提交：`feat: diagnose scoped data requirements with measured evidence`。

## Task 3 四域算法和公共流程的完整诊断接入

**Files:** 修改`analytics_engine/vector_methods.py`、`vector_backtest.py`、`spatial_interpolation.py`、`satscan_cluster.py`、`species_clustering.py`、`pathogen_apriori.py`、`transmission_risk.py`、`resistance_evolution.py`、`resistance_ml.py`、`mock_methods.py`、`foodborne/cgmlst_cluster.py`、`foodborne/food_attribution.py`、`foodborne/outbreak_scanner.py`、`env/water_rf_kriging.py`、`chronic/death_cert_qc.py`、`chronic/icd10_nlp_inference.py`、`src/domains/shared/analytics-skill.ts`、`src/domains/common/interaction-skills.ts`、`src/domains/common/workflow-skills.ts`、`src/domains/chronic/skills/index.ts`、`src/application/skills/skill-service.ts`；新增`tests/scientific/test_diagnostic_coverage.py`、`tests/refactor/diagnostic-coverage.test.ts`。

**Interfaces:** 每个Skill输出v2；算法在决定状态/子输出的原检查点产生诊断，引用任务2规则。不从前端标签反推事实；规范Skill与alias同一策略。`assertDiagnosticCoverage(catalog, policies)`校验available/ planned能力和存在缺口的outputKey覆盖。

- [ ] Step 1 写失败测试：AR6/GBDT12训练对和末两月/过期12月；回测0评估对；IDW多方法/单点；扫描坐标点不足/总捕获0；PCR全阴性/联合计数1；KMeans全零/单簇；cgMLST无效/不同长度/未知分型方案；Pearson0..3对和常量；Moran缺权重/恒定；水质全NULL；区县缺坐标；候选未达到阈值与字段缺失；资源不存在；模型planned保留FAILED。
- [ ] Step 2 运行`.venv/bin/python -m unittest tests.scientific.test_diagnostic_coverage -v`和`npm run test:refactor -- tests/refactor/diagnostic-coverage.test.ts`，确认未接入输出失败。
- [ ] Step 3 接入全部规则，给局部失败绑定outputKey/groupKey。对合法零值保留原监测事实；数学不定义的指标按输出诊断，不伪造值；修复全NULL均值导致非有限值的返回边界，保留业务范围和算法。
- [ ] Step 4 重跑新增测试，运行`npm run test:scientific`与`npm run test:refactor -- tests/refactor/interaction-skills.test.ts tests/refactor/vector-analytics.test.ts`，预期通过；覆盖报告中规范Skill/别名、原54项功能及其planned子能力无遗漏，保存在`config/data-support-coverage.json`。
- [ ] Step 5 提交：`feat: explain data gaps across four domain skills`。

## Task 4 主线LLM说明与所有AG-UI出口

**Files:** 新增`src/components/ag-ui/DataDiagnosticCard.tsx`、`tests/refactor/data-diagnostic-ui.test.tsx`、`tests/refactor/diagnostic-agent.test.ts`；修改`src/infrastructure/db/business-store.ts`、`src/infrastructure/db/migrations.ts`、`src/application/agent/operation-intent.ts`、`src/application/agent/write-intent.ts`、`src/application/agent/main-agent.ts`、`src/contracts/agui-view.ts`、`src/components/ag-ui/GenerativeComponentRenderer.tsx`、`src/components/ag-ui/AnalyticsResultCard.tsx`、`src/components/ag-ui/WaterPipelineGisMap.tsx`、`src/application/dispatch/legacy-adapter.ts`、`src/application/agent/operation-http.ts`、`src/features/workbench/workbench-controller.ts`、`src/features/workbench/result-adapter.ts`、`src/features/workbench/use-workbench-controller.ts`、`src/domains/shared/skill-factory.ts`、`src/domains/common/interaction-skills.ts`。

**Interfaces:** `projectAguiView(turn)`先投影本次可用diagnostics，再按原失败规则投影业务结果；组件类型`DATA_DIAGNOSTIC_CARD`，只读事实取自DataDiagnostic。动作传`resourceRef={type:'data_diagnostic',id:diagnosticId,action:actionId}`至现有dispatch；服务端重新读取已授权诊断，不相信客户端复制的checks。扩展`biz_agent_runs`迁移，保存`principal_snapshot_json`和`dataset_selection_json`（首批默认source），更新显式列名写入；扩展`getRecordedTurn`读取时验证当前组织/辖区及历史结果来源权限，诊断和动作审计使用已保存run；不得仅因userId相同而在辖区变更后继续读取旧敏感结果。为data_diagnostic动作登记允许的Skill及服务端绑定参数，伪造diagnosticId、变更action、注入客户端checks和扩大目标范围均拒绝。历史缺审计上下文时只允许可重新验证权限的内容，否则要求新run。LLM提示要求说明场景/方法/需求/现状/原因/建议，不预写业务replyText。

- [ ] Step 1 写失败测试：NO_DATA null payload有诊断卡且无旧地图；部分方法成功显示结果及局部诊断；失败LLM不产生模板答复但保留本轮完成检查；Widget/HTTP/SSE/会话读取同内容；unknown显示“尚未检查”；资源与planned错误不用“数据不足”；规划/profile成功不能覆盖原分析不足。
- [ ] Step 2 运行`npm run test:refactor -- tests/refactor/data-diagnostic-ui.test.tsx tests/refactor/diagnostic-agent.test.ts`，确认失败。
- [ ] Step 3 实现诊断投影和LLM证据输入；显示可读六块、展开明细和动作限制。会话保存v2诊断，v1只读提示并允许新run重诊断；报告附诊断而空分析不自动归档。开关`DATA_DIAGNOSTICS_V2_ENABLED`控制新写入，读取保持兼容。
- [ ] Step 4 重跑新增测试并运行`npm run test:refactor -- tests/refactor/agui.test.ts tests/refactor/workbench.test.tsx tests/refactor/dispatch-http.test.ts tests/refactor/results-report.test.ts tests/refactor/results-mobile.test.ts`，预期通过。第一批可在此独立交付。
- [ ] Step 5 提交：`feat: render grounded data diagnostics through the main agent`。

## Task 5 沙箱数据上下文与生命周期隔离

**Files:** 新增`src/contracts/dataset-selection.ts`、`src/infrastructure/db/mock-dataset-store.ts`、`tests/refactor/mock-dataset-isolation.test.ts`、`tests/integration/test_mock_datasets.py`；修改`src/contracts/execution-context.ts`、`src/contracts/principal.ts`、`src/infrastructure/auth/authorization.ts`、`src/infrastructure/auth/session.ts`、`src/infrastructure/db/migrations.ts`、`src/infrastructure/db/dataset-manifest.ts`、`src/infrastructure/db/domain-repository.ts`、`src/infrastructure/analytics/runner.ts`、`analytics_engine/repositories/datasets.py`、`src/domains/shared/skill-factory.ts`、`src/domains/shared/analytics-skill.ts`、`src/domains/common/workflow-skills.ts`、`src/application/jobs/job-service.ts`、`src/application/jobs/worker-service.ts`。

**Interfaces:** `ExecutionContext.datasetSelection: DatasetSelection`默认为source，显式simulation选择只接受服务端授权datasetId；`Principal.permissions.manageMockDatasets?: boolean`。`resolveExecutionDataset(ctx): AuthorizedDatasetLocation`将所有读取绑定同快照。`registerMockDataset`/`acquireDatasetLease`/`retireMockDataset`处理归属、状态和TTL；新增`biz_mock_datasets`与`biz_mock_generation_requests`迁移，不改全局来源manifest。

- [ ] Step 1 写失败测试：跨组织/辖区/所有权/域、匿名、公众、客户端路径与全局env切库被拒；SQL/Python来源一致；默认三个mock源仍不能用于真实处置；simulation在Worker/报告中不丢失；运行租约阻止文件提前删除；到期与权限撤销拒绝新执行；profile不暴露越权事实。
- [ ] Step 2 运行`npm run test:refactor -- tests/refactor/mock-dataset-isolation.test.ts`及`.venv/bin/python -m unittest tests.integration.test_mock_datasets -v`，确认失败。
- [ ] Step 3 实现注册、租约、授权数据上下文和权限持久化；新增迁移支持已有业务库升级。真实处置入口同时要求source模式、证据origin为observed且满足既有验证政策。默认Mock来源可分析但不能触发真实处置。
- [ ] Step 4 重跑新增测试并运行`npm run test:refactor -- tests/refactor/datasets.test.ts tests/refactor/authorization.test.ts tests/refactor/analytics-runner.test.ts tests/refactor/workflow.test.ts`，预期通过；四域原来源文件hash不变。
- [ ] Step 5 提交：`feat: isolate authorized simulation datasets from source workflows`。

## Task 6 参数化Mock规划与真实生成

**Files:** 新增`src/application/mock/mock-service.ts`、`src/domains/common/data-support-skills.ts`、`analytics_engine/synthetic/__init__.py`、`generate.py`、`vector.py`、`foodborne.py`、`env.py`、`chronic.py`、`validate.py`、`tests/scientific/test_synthetic_generation.py`、`tests/refactor/mock-generation.test.ts`；修改`src/application/skills/skill-service.ts`、`src/application/agent/operation-intent.ts`、`src/application/agent/write-intent.ts`、`src/infrastructure/db/migrations.ts`、`src/application/jobs/job-service.ts`、`src/application/jobs/worker-service.ts`。原seed-demo保持明确离线用途，不作为运行时隐式初始化。

**Interfaces:** `createMockPlan(diagnosticId, overrides, ctx): Promise<MockPlan>`；`executeMockPlan(planId, generationRequestId, ctx): Promise<MockGenerationResult>`。MockPlan在`dataset-selection.ts`定义，字段严格按规格第七节；MockGenerationResult包含jobId、状态、datasetRef、校验checks、planId和预算，不返回伪造分析。Python `generate(spec, staging_path)`与`validate_snapshot(spec, staging_path)`只接受已登记模板，不执行LLM代码。planning只读，generating有write意图和manageMockDatasets校验。

- [ ] Step 1 写失败测试：同seed/版本/参数hash一致，改seed/分布/日期/缺陷设置数据不同；外键/非负/向量/日期/权重真实校验；故意缺陷场景可产生预期不足；未显式生成请求不写入；规划动作不能被LLM改成生成/删除，客户端附带任意路径和重算参数被拒；超预算/未授权/过期plan/来源改变被拒；同request幂等；取消/崩溃不发布半成品。
- [ ] Step 2 运行`.venv/bin/python -m unittest tests.scientific.test_synthetic_generation -v`和`npm run test:refactor -- tests/refactor/mock-generation.test.ts`，确认失败。
- [ ] Step 3 实现四域模板、校验和独占临时文件/原子发布；真实行数、hash、seed与模拟假设写注册表；生成失败保留错误与未满足检查，不把结构校验成功当原模型分析成功。`MOCK_GENERATION_ENABLED`默认pilot关闭。
- [ ] Step 4 重跑新增测试，运行`npm run test:scientific`和`npm run test:integration`，预期通过且隔离源库无变化。
- [ ] Step 5 提交：`feat: generate validated mock snapshots through agent skills`。

## Task 7 真实重算 端到端验收与发布说明

**Files:** 修改`src/domains/common/data-support-skills.ts`、`src/application/mock/mock-service.ts`、`src/application/agent/main-agent.ts`、`src/application/jobs/worker-service.ts`、`src/components/ag-ui/DataDiagnosticCard.tsx`、`src/domains/shared/skill-factory.ts`、`src/domains/common/interaction-skills.ts`、`docs/重构部署与验收操作手册.md`；新增`tests/refactor/mock-rerun.test.ts`、`tests/integration/test_mock_rerun.py`、`scripts/verify-data-support-live.mjs`、`docs/reviews/2026-10-12/数据诊断功能验收.md`。

**Interfaces:** `rerunDiagnosticAnalysis(diagnosticId, datasetId, overrides, ctx): Promise<SkillExecution>`，从服务器原run取规范Skill及原参数，仅接收注册可变参数；生成后调用原Skill，返回真实v2输出、原diagnosticId和parentRunId。长任务Job恢复主线LLM与Skills，保留原身份、datasetSelection、幂等键和所有权；失权或不再READY就终止。

- [ ] Step 1 写失败测试：原AR/Pearson/cgMLST/DBSCAN分别消费新快照；改变数据影响结果而无固定数字；故意保留缺口重算仍不足；未实现模型依旧CAPABILITY_UNAVAILABLE；原观察诊断不变；跨入口Mock预警/审批/通知/复测消警全部拒绝；SSE和会话显示同来源与诊断；超工具预算走新持久run而非扩大循环。
- [ ] Step 2 运行`npm run test:refactor -- tests/refactor/mock-rerun.test.ts`和`.venv/bin/python -m unittest tests.integration.test_mock_rerun -v`，确认失败。
- [ ] Step 3 实现重算与异步续接，真实LLM汇总模拟结果和剩余缺口；补管理/删除沙箱动作，经现有Agent意图校验执行；补部署开关、预算、权限、TTL、来源恢复及故障恢复操作说明。
- [ ] Step 4 运行`./scripts/check-refactor.sh`及`npm run build`，预期lint/类型/四套现有与新增测试及构建通过；记录实际测试数与原库hash，不沿用历史通过数字。
- [ ] Step 5 执行`node scripts/verify-data-support-live.mjs`，脚本使用Node原生fetch访问隔离测试实例，不增加tsx或运行依赖。四域分别保存真实LLM诊断→方案→明确生成→原Skill重算的runId/参数/来源/SSE及Web/Widget证据；验证一条NO_DATA、局部不足、LLM故障、权限拒绝、无效Mock和有效零值。失败原样留证，不固定返回成功。活体验收生成的数据仅在隔离测试目录。
- [ ] Step 6 将实际证据、覆盖率和限制写入验收报告；先发布诊断，再按授权角色开启模拟功能。提交：`feat: rerun real analysis on isolated mock data with verified diagnostics`。

## 审阅与执行交接

本方案建议按既有执行方式在当前隔离分支逐任务推进：先完成任务1至4供独立验收，再实施任务5至7。任何任务的结果必须同时通过行为、权限和来源验证；当前审阅稿没有勾选任何实施步骤。

审阅重点：六块说明是否覆盖业务需要，首批Mock模板和默认预算是否适用，pilot默认关闭及显式权限是否符合试点要求。用户审阅后再执行；这里不要求对已授权的只读诊断额外审批。
