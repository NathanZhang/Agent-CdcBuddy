# LLM地域识别与地图能力实施计划

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过LLM识别、真实行政区划绑定和服务端范围约束，使“显示河南省地图”及相关跨轮续问正确执行，让各空间技能共享点位、标注、热力、插值、区域与线网图层，并在局部失败时保留已授权成功的地图输出。

**Architecture:** 先交付版本化目录和独立地图技能，再建立统一SpatialOutput、全技能能力登记、图层适配及共享地图组合。将LLM结构化意图绑定到服务器逐图层批准范围，统一约束SQL、分析、导出及后台任务，最后完成真实模型和浏览器验收。

**Tech Stack:** TypeScript、React 19、Next.js 15、MapLibre GL 5、AJV、better-sqlite3、Vitest、现有LLMClient和Python runner。

**Spec:** [LLM地域识别与地图能力改进方案](../../reviews/2026-10-13/LLM地域识别与地图能力改进方案.md)。状态：计划，尚未实施。

## Global Constraints

- 自然语言任务由LLM识别，不以关键词或字符串后缀决定任务、行政层级或成功结果。
- 模型只选择服务端候选id；真实目录、来源映射与权限决定执行范围。不得改写事实库与采集原始字段。
- 识别最多2次LLM实际HTTP请求，含内部重试与fallback，业务工具最多3轮8次；共享取消信号与入口创建的deadlineAt。
- SkillResult保持v1，NO_DATA/FAILED/CANCELLED的业务payload为空。行政底图由独立成功Skill返回，不能把空业务结果改成SUCCESS。
- 空间输出放入业务payload.spatialOutputs，MAP_COMPOSITION是原真实结果的确定性投影；不得虚构业务Skill成功或改写原底图审计。每个运行时Skill必须有空间能力归类。
- points可无数值；labels、heatmap、grid、area、circle、line遵循Spec七节输入与含义，禁止从视觉热力推导专业风险、从分型网络推导地理传播或从行政中心伪造采样点。
- 新地图使用一个共享MapCanvas；map_edit保持数据条件，明确纯底图任务才清空业务图层。来源、单位、方法、精度和图例逐层记录。
- 地图与数据范围分开；明确越权数据请求拒绝，不静默缩为本市。业务结果和敏感点位不得因底图成功而泄漏。
- 上下文来自服务端授权状态，按用户、组织、领域、会话隔离，revision防并发覆盖。
- 首期目录以现有本地资源和来源清单为准，不声明完整最新行政区划；资源和数据库映射版本必须记录。
- 每个任务先加入有意义的失败测试，再实现并验证；不提交生成数据库、秘密配置、模型密钥或测试副产物。
- 本轮只交付设计文件；执行本计划属于后续实施工作。实施前检查现有修改与迁移编号，采用适用的工作区隔离方式。

## Review Focus

- “河南省地图上只标郑州数据”需要分别保存显示与业务范围，不能共享一个city字段。任务3、5、6覆盖。
- 县级市、同名区县、历史来源名称和残缺边界不能通过后缀或取首个候选解决。任务1、2、4覆盖。
- CASE/HAVING、日期维表、Python、导出与后台Job都可能留下第二条未受约束的过滤通道。任务5覆盖。
- 并发续问、跨域恢复和已过期澄清不得执行旧范围；NO_DATA与失败的状态更新含义不同。任务4、6覆盖。
- 底图成功而权限拒绝、汇总LLM失败、取消或WebGL失败时，视图和文字必须与真实子结果一致。任务3、6覆盖。
- 同源多呈现、不同技能重复featureId、0半径扫描、缺CRS、单位不相容及截断数据必须按实际空间证据处理。任务2、3、7覆盖。
- “把这层改成热力”“隐藏标签”“叠加刚才结果”不得误当新底图清空业务；跨年对比需独立图层范围。任务3、4、5、6覆盖。

## 接口约定

以下接口名与类型由对应任务创建，后续任务只能复用。

```ts
type Evidence =
  | { source: 'current'; start: number; end: number; quote: string }
  | { source: 'context'; contextRef: string; cue: { start: number; end: number; quote: string } }
  | { source: 'default'; policyId: string };
type SlotUpdate<T> =
  | { op: 'set'; value: T; evidence: Evidence }
  | { op: 'inherit'; contextRef: string; evidence: Evidence }
  | { op: 'clear'; evidence: Evidence };
type RegionSelection = { includeCandidateIds: string[]; excludeCandidateIds: string[] };
type TimeWindow = { from: string; to: string };
type FilterSpec = { field: string; operator: 'eq'|'in'|'range'|'not_in'; values: (string|number)[] };
type BoundRegionSet = { includeCodes: string[]; excludeCodes: string[]; catalogVersion: string };
type IntentResolution =
  | { status: 'RESOLVED'; intent: InteractionIntent }
  | { status: 'CLARIFICATION'; questions: string[]; pending: PendingIntent }
  | { status: 'FAILED'; error: { code: string; message: string } };
```

`Evidence.source=default`只允许服务器生成，LLM输出协议不得提供。`InteractionIntent`包括Spec第三节字段，其中region槽使用RegionSelection，time槽使用TimeWindow，filters为字段名到SlotUpdate<FilterSpec>的映射。首期单次include与exclude中显式候选总数最多10个，省级目标是一个候选。

`ApprovedIntent`包括Spec第六节字段，`effectiveDataScope`为批准的BoundRegionSet、TimeWindow和FilterSpec集合；displayScope只包含地图地域及展示选项。内部值冻结且不从客户端反序列化为可信对象。`fingerprint`基于规范排序后的生效范围、过滤、领域和映射版本生成，不包含模型推理或可变文本。

空间协议与组合接口由任务2、3创建：`SpatialOutput`含Spec七节全部字段；`MapRendering='points'|'labels'|'heatmap'|'grid'|'area'|'circle'|'line'`；`SpatialCapability.disposition='producer'|'adapter'|'region-summary'|'non-spatial'|'unavailable'`。`MapSceneOperation`是带目标引用的replaceScene、addLayers、replaceLayer、removeLayers、setVisibility、setRendering联合类型。

`ApprovedMapPlan`含基础显示范围和`layerPlans[]`，每项带layerRequestId、来源技能/输出引用、自己的ApprovedIntent与scopeFingerprint；没有覆盖条件时复用基础数据范围。`MapSceneState`按mapId/revision管理底图、图层引用、呈现和视野；仅保存来源与参数，不信任客户端提交的业务GeoJSON。

### Task 1 行政区划目录与独立地图技能

**Files:**
- Create: `config/regions.json`、`config/dataset-region-bindings.json`。
- Create: `src/contracts/region.ts`，定义RegionSelection、BoundRegionSet、RegionCatalog、RegionCandidate与CandidateSearchResult。
- Create: `src/infrastructure/geo/region-catalog.ts`、`src/infrastructure/geo/dataset-region-bindings.ts`、`scripts/build-region-catalog.mjs`。
- Create: `src/contracts/map-view.ts`、`src/application/geo/map-service.ts`、`src/domains/common/map-skills.ts`。
- Create: `src/components/ag-ui/AdministrativeMap.tsx`、`src/lib/geo/administrative-map.ts`。
- Modify: `src/application/skills/skill-service.ts`、`src/application/agent/ui-operation.ts`、`src/application/agent/operation-intent.ts`、`src/components/ag-ui/GenerativeComponentRenderer.tsx`。
- Test: `tests/refactor/region-catalog.test.ts`、`tests/refactor/map-display-skill.test.ts`、`tests/refactor/administrative-map.test.tsx`。

**Interfaces:**
- Produces: `loadRegionCatalog(): RegionCatalog`、`searchRegionCandidates(mention: string, parentCode?: string): CandidateSearchResult`、`bindRegionSelection(selection: RegionSelection, candidates: RegionCandidate[]): BoundRegionSet`。
- Produces: `loadDatasetRegionBindings(domain: AgentDomain, datasetVersion: string): DatasetRegionBindings`。
- Produces: `executeMapDisplay(input: MapDisplayInput, ctx: ExecutionContext): Promise<SkillExecution & {payload: MapView | null}>`、`mapSkills(domain: AgentDomain): SkillDefinition[]`，复用现有非泛型SkillExecution。
- Produces: `AdministrativeMap({view}: {view: MapView})`。MapView使用Spec第七节字段，MapDisplayInput使用服务端已绑定BoundRegionSet、basemap及boundaryLevels。

- [ ] **Step 1:** 编写`region-catalog.test.ts`：郑州别名召回郑州市410100；新郑市保持county级及父级关系；重复代码、错误gb转换、缺失父级、来源名称冲突和缺失geometry拒绝或明确不支持；20候选截断包含hasMore。
- [ ] **Step 2:** 编写地图测试：地图Skill在监测库不可用时返回独立SUCCESS、MAP_VIEW、真实资源hash及features数量，datasets为空；缺资源FAILED；四域注册方法相同但domain各自正确；UI map.display只允许该Skill；静态HTML不包含监测数值或风险等级。
- [ ] **Step 3:** Run `npx vitest run tests/refactor/region-catalog.test.ts tests/refactor/map-display-skill.test.ts tests/refactor/administrative-map.test.tsx`，确认新增能力缺失导致测试失败。
- [ ] **Step 4:** 实现目录构建、只读候选查询和白名单资源加载。单独登记GeoJSON sourceId转换，不采用字符串后缀判断行政层级；隔离既有baseRiskLevel。实现Skill和MAP_VIEW组件，复用MapLibre及天地图配置，视野按真实bbox设置。
- [ ] **Step 5:** 接入结构化`resourceRef.type=map, action=display`与operation-input；原map.drilldown仍走业务查询。资源输入先绑定和验证，不允许客户端提交任意URL。
- [ ] **Step 6:** 复跑新增测试和`tests/refactor/skill-service.test.ts`、`tests/refactor/workbench.test.tsx`；运行`npm run lint`、`npx tsc --noEmit`。全部通过后形成可独立审查的目录与地图变更。

### Task 2 统一空间协议及全部技能适配

**Files:**
- Create: `src/contracts/spatial-output.ts`、`config/spatial-capabilities.json`。
- Create: `src/application/geo/spatial-output-service.ts`、`src/application/geo/spatial-adapters.ts`、`src/application/geo/adapters/query.ts`、`vector.ts`、`foodborne.ts`、`env.ts`、`chronic.ts`、`operations.ts`。
- Modify: `src/contracts/skill-definition.ts`、`src/application/skills/skill-service.ts`、`src/application/config/runtime-profile.ts`、`src/domains/shared/skill-factory.ts`、`src/domains/shared/analytics-skill.ts`。
- Modify: `src/contracts/query-visualization.ts`及四域空间技能输出schema；`analytics_engine/spatial_interpolation.py`补网格元数据，`analytics_engine/species_clustering.py`保留已计算成员位置，其他算法只按实际输出需要补来源键。
- Create: `src/domains/common/map-annotation-skill.ts`，注册只读skill_map_annotation。
- Test: `tests/refactor/spatial-output.test.ts`、`tests/refactor/spatial-capability-coverage.test.ts`、`tests/refactor/spatial-adapters.test.ts`、`tests/refactor/map-annotation.test.ts`、`tests/scientific/test_spatial_output_metadata.py`。

**Interfaces:**
- Consumes: Task1真实目录与来源映射、现有SkillRun与SkillResult。
- Produces: `listSpatialCapabilities(domain: AgentDomain): SpatialCapability[]`；`validateSpatialOutput(value: unknown): SpatialOutput`。
- Produces: `publishSpatialOutputs(run: SkillRun, context: SpatialPublishContext): SpatialOutput[]`，只读实际结果及批准范围，在tool_completed发布前补服务器来源、校验输出并保存，不重算或编造业务值。SpatialPublishContext在本任务定义为经过服务器授权的QueryScope快照、来源映射版本与scopeFingerprint；Task5接入后由ApprovedIntent构造，不在本任务导入尚未创建的类型。
- Produces: `adaptQuerySpatialOutput(rows: Record<string, unknown>[], spec: QuerySpatialSpec, context: SpatialPublishContext): SpatialOutput`；`QuerySpatialSpec`允许无数值点、regionCode、标签、数值权重及所需sourceCRS，旧MapSpec保持读取兼容。
- Produces: `executeMapAnnotation(input: AnnotationInput, ctx: ExecutionContext): Promise<SkillExecution>`，只接受已授权featureRef、目录regionRef或来自用户原文的已核验坐标与文本。

- [ ] **Step 1:** 协议测试断言Point/LineString/Polygon及多重几何、regionCode、featureId、CRS、来源、单位、定位精度和质量元数据；无value的点和标签合法，定量图层缺单位非法，负热力权重拒绝，缺坐标/未知CRS返回具体原因而不补行政中心。
- [ ] **Step 2:** 覆盖登记测试枚举四域listSkillDefinitions、公共/内部Skill及自定义入口，每个规范ID+method都要有归类和理由；动态自定义查询按入口能力族登记，每次调用仍校验实际schema、字段、坐标来源及授权。planned技能只能unavailable；producer/adapter/region-summary必须有实现及对应契约测试，不能仅填配置宣称支持。
- [ ] **Step 3:** 适配测试覆盖四域真实查询行、IDW点+真实网格、扫描簇及成员、水质observedPoints、区县中心DBSCAN；断言value/单位/方法/半径/精度保持。保留species真实计算成员坐标，PCR/生测按原地域口径输出区域摘要；食源候选/伤害候选用区域标签，分型网络缺精确位置不得产出地理line。
- [ ] **Step 4:** 验证污水与河流缺几何时仅生成具体geometry-required outcome；带明确真实位置的注册关联查询可以发布point，缺管网/河网不能靠名称造line。趋势/预测只有原输出明确的地域摘要，不能复制到省内所有站点。标注测试验证无数值、纯文本、用户原文证据与要素授权，不能修改源观测。
- [ ] **Step 5:** Run `npx vitest run tests/refactor/spatial-output.test.ts tests/refactor/spatial-capability-coverage.test.ts tests/refactor/spatial-adapters.test.ts tests/refactor/map-annotation.test.ts`，确认现有pointRows约定和method硬编码无法满足新契约而失败。
- [ ] **Step 6:** 实现严格SpatialOutput、能力登记和按领域的真实结果适配，输出schema允许payload.spatialOutputs而保持SkillResult v1不变。新增技能只登记输出和测试，禁止新增独立业务地图组件或复制默认风险图例。注册自定义SQL与旧chartType=map的受控字段绑定，字段不足时明确失败或要求补充。
- [ ] **Step 7:** 将Node发布阶段绑定runId/callId/method/approvedScope，Python补实际已计算空间元数据；保留原table/chart结果。实现只读标注Skill，目录代表点标明行政精度，不写持久注释。
- [ ] **Step 8:** 复跑新增测试、`tests/refactor/skill-service.test.ts`、`tests/refactor/recommendations.test.tsx`及`npm run test:scientific`，运行lint和tsc。输出按Skill/method/rendering的覆盖报告，区分ready、geometry-required和unavailable。

### Task 3 共享地图组合与图层状态

**Files:**
- Modify: `src/contracts/agent-interaction.ts`、`src/contracts/agui-view.ts`、`src/components/ag-ui/AdministrativeMap.tsx`、`src/components/ag-ui/GenerativeComponentRenderer.tsx`。
- Modify: `src/components/ag-ui/QueryResultMap.tsx`、`src/components/ag-ui/QueryResultVisualization.tsx`、`src/application/agent/main-agent.ts`、`src/application/dispatch/legacy-adapter.ts`、`src/features/workbench/result-adapter.ts`。
- Create: `src/application/agent/output-outcomes.ts`。
- Create: `src/contracts/map-composition.ts`、`src/application/geo/map-composer.ts`、`src/application/geo/map-scene-state.ts`。
- Create: `src/components/ag-ui/MapCanvas.tsx`、`src/components/ag-ui/MapLayerLegend.tsx`、`src/lib/geo/map-layers.ts`、`src/lib/geo/map-interaction.ts`。
- Modify: `src/components/ag-ui/AnalyticsResultCard.tsx`、`src/lib/geo/geo-event-bus.ts`。旧业务地图入口只适配共同协议，不沿用固定风险阈值或放大半径。
- Test: `tests/refactor/map-outcomes.test.tsx`、`tests/refactor/administrative-map.test.tsx`、`tests/refactor/agui.test.ts`、`tests/refactor/results-ui.test.ts`。
- Test: `tests/refactor/map-composer.test.ts`、`tests/refactor/map-layers.test.ts`、`tests/refactor/map-scene-state.test.ts`、`tests/refactor/map-interaction.test.ts`。

**Interfaces:**
- Consumes: Task1 MapView与AdministrativeMap、Task2 SpatialOutput与能力登记。
- Produces: `OutputOutcome`、`aggregateOutputStatus(outcomes: OutputOutcome[]): ResultStatus`、`projectAguiView(turn: AgentTurnResult)`的子结果投影。
- Produces: `AgentTurnResult.outcomes?: OutputOutcome[]`，旧结果缺字段时保持兼容；新地图组合请求必须有outcomes。
- Produces: `composeMap(base: MapView, requests: MapLayerRequest[], outputs: SpatialOutput[], ctx: MapComposeContext): MapComposition`；`applyMapSceneOperation(state: MapSceneState, operation: MapSceneOperation, expectedRevision: number): MapSceneState`。
- Produces: `syncMapLayers(map: LibreMap, composition: MapComposition): void`；`MapCanvas({composition}: {composition: MapComposition})`；定向MapFeatureRef包含mapId/surfaceId/layerId/featureId。

- [ ] **Step 1:** 测试`mapSuccessAndNoDataPreservesBasemap`：MAP_VIEW SUCCESS与数据NO_DATA组合根为NO_DATA，但投影包含本次底图且没有业务点；`mapSuccessAndForbiddenClearsBusiness`：根FAILED，仅独立获授权底图保留。
- [ ] **Step 2:** 测试`cancelClearsActiveView`、`summaryFailureKeepsExecutedMap`、`oldNoDataDoesNotInventMap`及HTTP/SSE一致性；瓦片错误保留本地边界，WebGL错误展示同源SVG轮廓和状态提示；新增请求不沿用旧点位。
- [ ] **Step 3:** 测试同一输出points/labels/heatmap共享source、两个Skill相同featureId隔离、分类图例与不同单位独立、区域缺值不为0；grid使用实际网格而非再次热力平滑；0/0.5/30公里circle严格保留物理半径。渲染line仅用真实几何fixture，不能依赖不存在的专业管网。
- [ ] **Step 4:** 测试逐层add/replace/remove/visibility/rendering、style.load重放、异步revision过期、cameraPolicy、删除后的source引用计数和事件清理；Web/Widget定向选择互不串用。验证本次新场景清旧层，显式引用旧层需重新授权并保留快照来源；单层空/坏几何不清其他成功层。
- [ ] **Step 5:** Run `npx vitest run tests/refactor/map-composer.test.ts tests/refactor/map-layers.test.ts tests/refactor/map-scene-state.test.ts tests/refactor/map-interaction.test.ts tests/refactor/map-outcomes.test.tsx tests/refactor/administrative-map.test.tsx`，确认新共享组合与图层状态尚不存在而失败。
- [ ] **Step 6:** 实现按请求输出聚合和MAP_COMPOSITION投影：全部成功才SUCCESS，否则FAILED、CANCELLED、REVIEW_REQUIRED、INSUFFICIENT_DATA、NO_DATA依次优先。计算、空间适配与呈现各有outcome；仅独立授权成功的底图可在权限失败时保留；失败业务Skill仍payload=null。
- [ ] **Step 7:** 实现共享MapCanvas、受控样式通道、逐层图例和定向交互，按Spec层级排序，style.load后重放已批准快照。每个活动场景、每个界面实例共用一个MapCanvas；Web、Widget及历史场景分别隔离，不能使用页面全局单例。表格和其他分析卡保留，不再为每个方法创建地图。points无数字可画；合法视觉热力与实际grid分开；物理扫描圈通过保真距离计算，不能沿用旧Math.max默认半径。
- [ ] **Step 8:** 实现场景revision、来源重授权、相机策略及资源预算。默认16层、每层10,000要素、画布20,000要素、空间JSON总8MiB，超预算MAP_DATA_LIMIT；当前SQL200行限制不扩大。WebGL降级只能展示已验证的实际矢量数据，未实现的热力降级明确不可用。
- [ ] **Step 9:** 复跑新增测试及`tests/refactor/result-map.test.tsx`、`tests/refactor/recommendations.test.tsx`、agui和results-ui测试；运行lint和tsc。独立审查数据含义、局部失败、场景更新和地图生命周期。

### Task 4 LLM意图与服务端上下文

**Files:**
- Create: `src/contracts/interaction-intent.ts`、`src/contracts/approved-intent.ts`。
- Create: `src/application/agent/intent-resolver.ts`、`src/application/agent/intent-state.ts`、`src/application/agent/intent-guard.ts`、`src/application/agent/intent-prompts.ts`。
- Create: `migrations/sqlite/005_session_intents.sql`（执行前确认编号），同时定义biz_session_intents与biz_map_scenes；通过一次事务更新相关条件与场景revision。
- Modify: `src/infrastructure/db/business-store.ts`、`src/infrastructure/auth/authorization.ts`、`src/contracts/execution-context.ts`、`src/infrastructure/llm/client.ts`。
- Test: `tests/refactor/intent-resolver.test.ts`、`tests/refactor/intent-state.test.ts`、`tests/refactor/intent-authorization.test.ts`、`tests/refactor/llm-intent-budget.test.ts`。

**Interfaces:**
- Consumes: Task1 RegionCatalog、候选搜索、绑定与来源映射、Task2空间能力摘要、Task3 MapSceneState与MapSceneOperation；计划接口约定中的SlotUpdate和Evidence。
- Produces: `resolveInteractionIntent(input: IntentResolveInput, llm: LLMClient): Promise<IntentResolution>`，输入含本轮文本、候选、服务端IntentState、领域、时区日期和signal，禁止输入可信客户端ApprovedIntent。
- Produces: `mergeIntent(previous: IntentState | null, intent: InteractionIntent): IntentDraft`；`approveIntent(draft: IntentDraft, ctx: ExecutionContext): ApprovedIntent`；`validateIntentEvidence(intent: InteractionIntent, input: IntentResolveInput): void`。
- Produces: `approveMapPlan(intent: InteractionIntent, previous: MapSceneState | null, ctx: ExecutionContext): ApprovedMapPlan`，逐层绑定范围、候选来源、呈现能力与历史结果授权；任务类型新增map_edit，不能套用map_display清空规则。
- Produces: `readIntentState(sessionId: string, ctx: ExecutionContext): IntentState | null`；`commitIntentState(sessionId: string, expectedRevision: number, approved: ApprovedIntent, outcomes: OutputOutcome[], ctx: ExecutionContext): IntentState`。
- Produces: `savePendingIntent(pending: PendingIntent, ctx: ExecutionContext): void`；`loadPendingIntent(sessionId: string, ctx: ExecutionContext): PendingIntent | null`。PendingIntent包含Spec第九节字段，TTL为15分钟。
- Produces: `readMapScene(sessionId: string, ctx: ExecutionContext): MapSceneState | null`；`commitMapScene(sessionId: string, expectedRevision: number, scene: MapSceneState, ctx: ExecutionContext): MapSceneState`，与对应IntentState提交共享事务边界。
- Produces: LLMRequest可选`phase: 'intent'|'tool-selection'|'synthesis'`、`temperature`、`attemptBudget`与`deadlineAt`；intent预算在每个实际fetch前扣减，fallback/截断重试也计入，同轮最多2次。其他阶段维持既有重试。

- [ ] **Step 1:** 协议测试验证严格schema、三态操作、引用片段、非法contextRef/候选id、超候选数量及额外权限字段被拒绝。模型只能选候选，default来源只能服务器创建；layerRequests只选公布能力与授权引用，不接收模型编造geometry、数值或自由样式脚本。
- [ ] **Step 2:** 识别编排测试使用可记录输入的LLMClient：初始候选含全部现有市级记录；县名未解析时仅追加一次真实候选消歧；第二次仍非法或有歧义时不执行；候选截断不以首项放行；选择与引用不相符的真实候选也被拒绝。llm-intent-budget测试计算实际fetch次数，429、fallback及截断恢复总数不得超过2，温度默认0.1仅影响intent阶段。使用模拟LLM只能证明编排，不宣称语言识别准确率。
- [ ] **Step 3:** 合并测试覆盖Spec第五节每行：底图新任务清除业务槽，续问明确继承，省级范围重建并清旧市县，显示与查询地域分开；否定无基准必须澄清。map_edit切换卫星、隐藏标签或同源改热力保持条件且不重查；“叠加2023和2024”分别批准时间窗，“只保留IDW网格”引用正确输出。对冲突输出返回INTENT_INVALID，不能静默改成另一任务。
- [ ] **Step 4:** 授权与状态测试覆盖市级看全省底图但全省数据拒绝、default数据辖区可见、候选县市父子一致；NO_DATA可更新已执行业务条件，FAILED/CANCELLED不可更新；并发intent/scene revision冲突、15分钟到期、跨组织/领域会话及旧状态恢复不可串用。历史图层复用重新授权并保留originalRunId与快照，不允许legacy-unverified业务图进入当前场景。
- [ ] **Step 5:** Run `npx vitest run tests/refactor/intent-resolver.test.ts tests/refactor/intent-state.test.ts tests/refactor/intent-authorization.test.ts tests/refactor/llm-intent-budget.test.ts`，确认协议和编排尚不存在而失败。
- [ ] **Step 6:** 实现严格JSON识别、候选绑定、更新合并和逐层批准范围；现有LLMClient通过toolChoice=none及JSON对象响应配合AJV，新增phase与实际请求预算，不假设网关支持尚未确认的JSON Schema模式。新增身份隔离意图与场景状态表、CAS及事务更新，旧会话恢复只读运行证据；拒绝模型自报置信度作为唯一放行依据。
- [ ] **Step 7:** 复跑新增测试、`tests/refactor/authorization.test.ts`与`tests/refactor/session-history.test.ts`，运行lint、tsc及`tests/integration/test_auth.py`对应现有集成运行器。审查迁移与身份隔离，不修改既有迁移内容。

### Task 5 技能与查询范围强制绑定

**Files:**
- Create: `src/infrastructure/query/scope-guard.ts`、`src/infrastructure/query/scoped-filter-compiler.ts`。
- Modify: `src/domains/shared/skill-factory.ts`、`src/domains/shared/analytics-skill.ts`、`src/infrastructure/db/domain-repository.ts`、`src/infrastructure/query/query-gateway.ts`、`src/infrastructure/analytics/runner.ts`。
- Create: `analytics_engine/contracts/scope.py`、`analytics_engine/repositories/scoped_readonly.py`。
- Modify: `analytics_engine/contracts/task.py`、`analytics_engine/engine.py`、`analytics_engine/repositories/datasets.py`、`analytics_engine/vector_methods.py`、`analytics_engine/mock_methods.py`及其他使用原始地域筛选的已启用算法入口。
- Modify: `src/domains/common/interaction-skills.ts`、`src/application/agent/query-recovery.ts`、`src/application/jobs/job-service.ts`、`src/application/jobs/worker-service.ts`、`src/features/workbench/result-adapter.ts`。
- Test: `tests/refactor/approved-scope.test.ts`、`tests/refactor/sql-scope-guard.test.ts`、`tests/refactor/scoped-entrypoints.test.ts`、`tests/refactor/province-query-scope.test.ts`。
- Test: `tests/scientific/test_approved_scope.py`。

**Interfaces:**
- Consumes: Task4 ApprovedIntent/ApprovedMapPlan、Task1 DatasetRegionBindings与Task2 SpatialPublishContext。
- Produces: `scopeFromApprovedIntent(approved: ApprovedIntent, ctx: ExecutionContext): QueryScope`；`bindSkillScope(skill: SkillDefinition, args: Record<string, unknown>, approved: ApprovedIntent, ctx: ExecutionContext): Record<string, unknown>`。
- Produces: `assertSqlMatchesApprovedScope(sql: string, approved: ApprovedIntent, bindings: DatasetRegionBindings): void`；`compileScopedFilters(approved: ApprovedIntent, bindings: DatasetRegionBindings): ScopedViewConstraints`。
- Produces: QueryScope批准地域集合和filter约束支持；旧city/district字符串通过Task1映射适配，不修改原数据库记录。
- Produces: Python严格ApprovedScope协议与`connect_scoped_readonly(path, approved_scope)`，每个只读连接创建受控TEMP VIEW；engine只接受runner传递的服务器约束，禁止算法自行新增未登记地域/时间/业务默认筛选。
- Produces: 由layerRequestId选择对应ApprovedIntent的技能执行上下文与来源fingerprint；2023/2024两个图层不会共用可变全局时间参数。

- [ ] **Step 1:** 测试郑州市产生来源规范city，县级市产生父级city+district，省级无city/district；include/exclude集合不得扩大请求或权限范围；映射缺失为REGION_DATASET_MAPPING_REQUIRED，不是NO_DATA。不同图层的时间、方法和地域独立绑定，后到结果不能改写前层scope；混合无法授权来源拒绝，不能通过融合反查受限数据。
- [ ] **Step 2:** 编写SQL阻断测试：WHERE city='郑州'、遗留2024日期、dim_date.year/month/day、HAVING、CASE和额外业务过滤返回SCOPE_MISMATCH；正常字段投影与日期分组允许。原推荐查询迁移后，在受控视图中得到相同真实数据与单位。
- [ ] **Step 3:** 测试Python runner、CSV导出、自定义技能、后台Job、诊断查询和query-recovery使用同一fingerprint；Python科学测试验证city/district和include/exclude集合在每次连接生效，日期/方法/物种筛选不额外收窄批准范围，来源缺失仍失败；模拟目录或权限更新后Job拒绝，不重新解释冻结的“今年”。采集原字段保持不变且仍授权验证。
- [ ] **Step 4:** Run `npx vitest run tests/refactor/approved-scope.test.ts tests/refactor/sql-scope-guard.test.ts tests/refactor/scoped-entrypoints.test.ts tests/refactor/province-query-scope.test.ts`，确认现有自由过滤和字符串范围导致失败。
- [ ] **Step 5:** 实现批准范围和FilterSpec编译成受控TEMP VIEW约束，Python每次连接创建同样的受控视图并移除未批准隐含筛选。独立scope-guard在原AST安全校验后检查条件一致性，模型SQL不再填写地域/日期条件；旧业务过滤只在可证明等同于批准FilterSpec时允许，否则纠正或拒绝。方法必要训练窗单独记录，不能把图上筛选窗误用作全部训练历史。
- [ ] **Step 6:** 将直接Skill、结构化UI、旧API与Job接入目录绑定，并将批准范围构造成SpatialPublishContext。地图、表格、图层对应导出使用其真实来源范围与版本，不使用当前画布全局范围替代。ApprovedIntent存在时拒绝不一致旧参数；无ApprovedIntent时自由文本不能未经识别执行。参数schema和提示词同时更新，不能只改执行器。
- [ ] **Step 7:** 复跑新增测试及`query-gateway.test.ts`、`domain-repository.test.ts`、`results-report.test.ts`、`vector-analytics.test.ts`、`final-workflow-review.test.ts`，再运行`npm run test:scientific`与`npm run test:integration`。来源查询保持只读，确认权限、导出和算法兼容。

### Task 6 主线Agent与跨端完整链路

**Files:**
- Modify: `src/application/agent/main-agent.ts`、`src/application/agent/operation-intent.ts`、`src/application/agent/ui-operation.ts`、`src/application/dispatch/legacy-adapter.ts`、`src/application/dispatch/agui-adapter.ts`。
- Modify: `src/features/workbench/workbench-controller.ts`、`src/features/workbench/result-adapter.ts`、`src/components/layout/EmbeddedWidget.tsx`。
- Test: `tests/refactor/region-map-dispatch.test.ts`、`tests/refactor/dispatch-http.test.ts`、`tests/refactor/session-history.test.ts`、`tests/refactor/results-ui.test.ts`。

**Interfaces:**
- Consumes: Task1技能与视图、Task2空间输出、Task3组合与outcomes、Task4意图/场景状态、Task5逐层范围绑定。
- Produces: 对话运行在任何业务调用前完成意图批准；MAP_VIEW来自当前run的地图Skill；其他技能只在批准范围内执行。
- Produces: result中可选`intentSummary`（公共白名单字段，不含principal、路径或思维链），展示实际显示/数据范围及继承条件；内部ApprovedIntent存审计而不直接返回客户端。
- Produces: tool_completed后在同一mapId发布MAP_COMPOSITION新revision；其他表格/图表保持，LLM工具消息只提供空间摘要及有限预览，AG UI使用完整已验证输出。

- [ ] **Step 1:** 原始指令测试`newSessionShowsHenanMapWithoutSql`与`henanMapAfterZhengzhouQueryClearsFilters`，断言零次业务SQL、一次地图技能和河南bbox；`mapRegionAndDataRegionDiffer`断言分别绑定河南和郑州；续问用服务器revision而非客户端history。
- [ ] **Step 2:** 端到端协议测试覆盖澄清后续答、错误候选、LLM不可用、最大2次识别请求、工具预算、取消、summary失败以及CAS冲突；验明失败状态与本次地图保留规则。组合实际点位查询、IDW和扫描Skill输出，依次更新同一mapId，点/标签/热力共源、网格和扫描有独立证据；局部不足保留其他成功层。
- [ ] **Step 3:** HTTP/SSE/Widget/历史恢复测试检查outcomes、scope摘要、调用id与实际视图一致；跨年对比不混scope，“切换卫星/隐藏标签/点改热力”不调用新数据Skill，显式历史叠加标明旧快照。旧v1结果可读取，未保存结构化状态的旧会话不从助手文字重建筛选。大GeoJSON不进入模型上下文，但AG UI计数与真实输出一致。
- [ ] **Step 4:** Run `npx vitest run tests/refactor/region-map-dispatch.test.ts tests/refactor/dispatch-http.test.ts tests/refactor/session-history.test.ts tests/refactor/results-ui.test.ts`，确认新链路未接入而失败。
- [ ] **Step 5:** 在main-agent授权会话后增加识别与逐层批准步骤，入口创建共享deadlineAt并传递到LLM与算法signal，部署总时限与120秒算法预算协调，数值在性能验收中确定。纯底图按LLM task直接执行实际map技能；map_with_data创建一次地图Skill并在真实业务输出完成时由组合器更新；map_edit只执行经过校验的场景操作。来源输出按Task2登记适配，不再只有IDW method硬编码才能画地图。与现有原子会话记录、持久化错误和流式答复保持一致。
- [ ] **Step 6:** 实现状态提交时机与pending澄清，纯底图成功同步清除活动业务条件；map_edit不清除，组合请求仅提交对应完成的图层与范围。显示阶段进度与实际范围，不把识别、候选检索或地图组合投影当成新的业务Skill证据。
- [ ] **Step 7:** Run `npm run test:refactor`、`npm run lint`、`npx tsc --noEmit`，确认相关旧地图恢复、中文答复、会话和权限回归通过。形成原始指令可执行的审查结果。

### Task 7 真实LLM评估与发布验收

**Files:**
- Create: `tests/evaluation/region-intent-development.jsonl`、`tests/evaluation/region-intent-holdout.jsonl`、`scripts/evaluate-region-intent.mjs`。
- Create: `docs/reviews/2026-10-13/地域地图验收记录.md`（实施后填写真实结果）。
- Create: `scripts/check-spatial-capability-coverage.mjs`及实际空间能力覆盖报告；CI接入覆盖检查。
- Modify: `README.md`、`.env.example`、`docs/重构部署与验收操作手册.md`。
- Test: `tests/refactor/region-evaluation-format.test.ts`、`tests/refactor/region-rollout.test.ts`。

**Interfaces:**
- Consumes: `resolveInteractionIntent`及其schema、Task6结果和实际部署配置。
- Produces: JSONL评估条目`id,input,serverState,principalFixture,expectedTask,expectedCandidates,expectedSlotOps,expectedClarification,expectedScope`；逐条结果绑定模型/提示词/目录版本，记录错误与耗时。
- Produces: 部署开关`LLM_REGION_INTENT_ENABLED`，识别与批准范围同时启用；关闭时模糊自由文本请求不能回到旧未约束执行链路，明确结构化地图操作仍可执行。

- [ ] **Step 1:** 测试评估schema要求任务、槽更新及范围完整标注，重复id、缺expectedScope、遗漏歧义标注拒绝；关闭开关不能接受伪造旧city绕过，也不能伪装关键词成功。
- [ ] **Step 2:** Run `npx vitest run tests/refactor/region-evaluation-format.test.ts tests/refactor/region-rollout.test.ts`，确认评估工具与开关未实现而失败。
- [ ] **Step 3:** 创建至少120条开发样本和至少40条未参与调参的独立验收样本，覆盖Spec十二节全部场景，包括map_edit、按图层指代、历史叠加及跨年对比；不从同一问句简单替换地名冒充独立覆盖。通过现有LLMClient实际调用，每条3次，读取环境密钥但不写入报告。
- [ ] **Step 4:** 完成评估工具与开关，先用假客户端验证评分脚本，再在批准的实际模型配置下运行`node scripts/evaluate-region-intent.mjs --suite development --repeats 3`及`--suite holdout --repeats 3`。关键用例全通过、其余完整意图准确率≥98%，歧义正确澄清；失败继续修正并重测，保留真实证据。
- [ ] **Step 5:** 运行`node scripts/check-spatial-capability-coverage.mjs`，按运行时所有SkillDefinition生成空间归类及允许rendering的契约覆盖报告；每个producer/adapter/region-summary必须有实际输出测试，缺几何和planned条目有明确阻塞用例。随后运行`npm test`、`npm run lint`、`npx tsc --noEmit`、`npm run build`；测试使用隔离业务库，生成报告和Next副产物不混入交付。每项读取实际退出码后记录结果。
- [ ] **Step 6:** 在实际浏览器验证Web与Widget的原指令、新会话、郑州续问、空数据、显示/查询分离、卫星/矢量、行政层级、主题、视野、瓦片失败和WebGL失败；实际叠加观测点+标签+视觉热力+IDW网格+扫描区域，另测水质点、区县中心聚类、区域分级、跨年对比和图层隐藏/替换。线网仅以明确fixture验证几何渲染，不宣称真实业务拓扑已实现。检查本轮runId、网络请求、单位图例和状态，不仅检查页面存在地图div。
- [ ] **Step 7:** 填写真实验收记录、性能p50/p95和部署迁移步骤，说明目录覆盖与模型边界；审查全部变更后按既有发布流程灰度。未实际运行的检查标记未执行，不能填入计划中的目标数字。

## 计划自查

Spec一至四节由任务1、4实施；统一空间输出、能力登记和适配由任务2实施；地图组合及结果投影由任务3、6实施；历史与权限范围由任务4、5实施；状态、预算、跨端和后台由任务4至6实施；验收和发布由任务7实施。主要接口名在前置任务声明并在后续复用，所有Review Focus均有明确测试归属。

本计划不包含Mock造数、planned专业模型实现或外部行政区划服务采购。未来接入更多区域时更新目录、映射和评估语料，通过同一链路，不追加自然语言关键词分支。
