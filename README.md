# Agent-CdcBuddy 2.0

Agent-CdcBuddy 面向病媒生物、食源性疾病、环境健康、死因慢病与伤害四个领域提供疾控监测分析工作台。2.0 将业务交互统一到主线 Agent，由实际 LLM 调用真实 Skills，根据执行证据生成中文对话与 AG-UI。

当前版本为 **2.0.1**，Git 标签为 **v2.0.1**。发布范围和限制见 [2.0.1 发布说明](docs/releases/v2.0.1.md)，详细验收边界见 [重构交付与剩余能力](docs/reviews/2026-10-12/重构交付与剩余能力.md)。原54项专业功能尚未全部实现；Skill可调用表示相应受限方法可执行，不代表完整专业需求已验收。

## 执行架构

```text
Web / Widget / 业务操作
  → HTTP / SSE Dispatch 与服务端身份校验
  → Main Agent 与实际 LLM 工具调用
  → Skills：受限 SQL / Python 真计算 / 持久业务工作流
  → SkillResult（runId、来源、方法、状态、指标与限制）
  → LLM 基于同次执行结果生成答复
  → AG-UI 事件与 React 地图、图表、表格和操作卡片
```

前端使用项目工作台控制器，服务端使用 `@ag-ui/core` 校验标准事件。CopilotKit依赖与独立Runtime已移除；`/api/copilotkit`仅为接受本项目Agent交互协议的旧地址适配，不兼容原CopilotKit协议。业务功能按钮使用同一主线执行路径；UI操作与对话历史分离，避免界面管理请求污染研判对话。

事实数据库只读，业务库与LangGraph审批检查点独立。服务端执行域、角色、辖区、所有权和敏感列授权，SQL具有AST约束。LLM或算法失败明确返回失败，不以固定成功文字、关键词规则或旧成功视图兜底。

使用 Qwen3.8 兼容网关时，技能选择默认使用 `medium` 推理档位，覆盖模型默认的 `xhigh`。可在环境配置中设置 `SILICONFLOW_REASONING_EFFORT` 为 `low`、`medium` 或 `xhigh`；`low` 更侧重简短推理。已有工具结果的文字汇总关闭推理，`length` 截断会关闭推理并重新生成一次。档位控制推理深度，不是严格的 token 上限；网关需支持并传递该参数。修改环境配置后需重启服务；生产容器通过 `env_file` 读取配置。

## 当前能力与数据来源

| 领域 | 默认数据来源 | 已实现的计算子集 | 主要限制 |
|---|---|---|---|
| 病媒 | observed，真实观测 | AR/GBDT捕获预测与滚动回测、KMeans、IDW、近似圆形Poisson扫描、PCR两项关联、生测记录摘要 | 捕获/记录不是标准密度；无完整ARIMA/LSTM、完整SaTScan、验证过的传播或基因演化模型 |
| 食源性 | mock | SQL汇总、暴露窗口候选、cgMLST等位距离与单链接候选簇 | 无真实外部效果验收；候选不是确诊暴发或源头；无未暴露对照归因与预测模型 |
| 环境 | mock | 实际指标汇总、日历配对滞后Pearson、明确提供权重时Moran | 不虚构管网/河网及溯源；未实现RF/Kriging、DLNM和专业场景模拟 |
| 慢病伤害 | mock | 月死亡数、区县中心DBSCAN、罕见码/伤害聚集候选、死因经验质控与编码候选 | 不代表个体位置、真实风险或临床推断；未实现人口率、风险GBDT、寿命表与ROI |

Mock只限定输入来源，查询、数学、持久化与产物必须实际执行。模拟输入不能证明真实精度。可用能力与尚未实现能力见 [能力清单](docs/reviews/2026-10-12/refactor-evidence/final-capability-inventory.json)。

公共能力包括会话与技能管理、人工采集、实际CSV/Markdown导出、SQLite Job与有限重试、持久审批恢复、幂等工单及站内通知。工单流程仍需机构政策和专业验收；外部短信/APP通知、PDF、OCR、SSO及生产数据库替代驱动没有完成。

## 安装与验证

```sh
npm ci --no-audit --no-fund
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
```

来源数据库不随Git发布。先配置 `config/datasets.json` 或 `DATASET_MANIFEST_PATH`，指定四域来源快照；不得把缺失来源在启动时自动变成Mock。各域可独立部署，实例领域由服务端运行配置决定。首次启动、身份初始化、端口、Worker、备份与恢复见 [部署与验收操作手册](docs/重构部署与验收操作手册.md)。

```sh
./scripts/check-refactor.sh
npm run build
```

完整本地检查需要受控来源快照；CI使用独立合成fixture，保留Mock标签。工程测试、兼容回归与真实专业效果分别验收，不能相互替代。

### 生成可复现的 Mock 演示数据

在项目根目录显式生成四域数据及配套来源、地域绑定文件。输出目录须为新目录；已有数据库拒绝覆盖，启动过程不会生成事实数据。

```sh
DEPLOYMENT_TIER=demo .venv/bin/python scripts/seed-demo.py --domain all --output-dir .refactor-acceptance/demo-data --seed 7
export DATASET_MANIFEST_PATH="$PWD/.refactor-acceptance/demo-data/manifest.json"
export DATASET_REGION_BINDINGS_PATH="$PWD/.refactor-acceptance/demo-data/region-bindings.json"
# 在上述环境变量下启动服务，或验收48个示例卡片的技能执行和视图渲染
./node_modules/.bin/vitest run tests/refactor/recommendations.test.tsx
```

四域全部标记 `origin=mock`，包含病媒多地市/物种比较与60个月训练窗口、食源性事件及菌株关联、32个月水质趋势、污水日级6天滞后、死因质控与伤害候选。坐标来自项目内版本化行政边界的中心或内部代表点；站点为内部点轻微偏移，没有县级边界的名称使用地市代表点，均为示意坐标。固定日期对应当前示例，数据时限写入 manifest，不会随系统日期漂移。

单域生成沿用 `--domain foodborne --output /新目录/food.db --seed 7`（也支持 vector/env/chronic）；单域输出需自行登记来源与地域绑定。CI 使用同一批生成器：`.venv/bin/python scripts/ci-fixtures.py --output-dir /新目录/cdc-ci --seed 7`。生成数据的关联、覆盖、复现与隔离检查：`.venv/bin/python tests/run_integration.py mock_demo_coverage fixture_isolation`。这些演示不提供尚未实现模型的能力或真实专业效果证明。

### 正式运行的 Mock 隔离与安全清理

`DEPLOYMENT_TIER=pilot`、未明确设置 demo 的生产构建均拒绝 Mock 事实；生产构建设置 local 也不能绕过。显式 demo 仅用于隔离演示。来源策略覆盖容器启动、就绪检查、SQL、Python、技能与后台任务。默认配置中的食源性、环境、慢病仍为 Mock，正式部署必须替换为经过核验的真实快照及配套地域绑定，不能只修改 origin 标签。新生成数据库有 `_cdc_mock_provenance` 标记，改名、复制或将清单改为 observed 都不能成为真实来源。

Mock 和来源不明的结果不能提交正式任务、周期巡检、归档报告、采集记录、审批、通知或复测核销；历史模拟查询、地图、报告和下载在正式模式下也会被拦截。模拟 CSV 保留系统来源列，文件名标记“模拟数据”；不会恢复旧预警接口及界面中的固定示例回退。迁移 `008_collection_provenance.sql` 为新采集记录保存来源证据，不给旧记录补造真实来源；无证据的旧任务、采集记录需重新执行或提交，不能自动审批和核销。

所有四域生成器均在输出目录旁的 `.mock-audit/mock-registry.sqlite3` 保存生成与清理审计，可用 `--audit-dir` 指定其他受控目录。记录包含生成 ID、领域、seed、脚本版本/hash、操作人及 UID、时间、到期时间、表行数、内容 SHA256、状态与错误。数据库权限为 0600，审计不记录患者明细。默认保留 7 天，可用 `--retention-days 1..365` 调整；到期拒绝新的分析，物理清理由管理员显式执行。

```sh
# 查看登记 ID 与生成/清理事件；--jsonl 可用于归档日志
.venv/bin/python scripts/mock-audit.py --audit-dir .refactor-acceptance/demo-data/.mock-audit
# 预览到期快照的清理，必须指定实际部署正在使用的来源清单
.venv/bin/python scripts/cleanup-mock.py --audit-dir .refactor-acceptance/demo-data/.mock-audit --expired --active-manifest /受控路径/正式来源清单.json
# 审阅预览后，在同一命令增加 --apply 才执行删除；也可用 --dataset-id 指定审计中的生成 ID
```

清理只处理登记中 SHA256、数据库标记、文件及目录身份全部匹配的独立快照。当前配置来源、活跃租约、符号/硬链接、文件替换、内容变更及活动 SQLite 日志均拒绝删除；不递归删除目录，不按文件名或日期批量删行。运行租约有心跳及本机 PID 检查，未知或跨主机的遗留租约保守保留，须在原执行环境释放或核验。删除前记录意图并移入隔离文件，再次验证后删除；中断可通过同一登记 ID 重试，保留审计与历史结果。整个清理过程不删除业务记录和审计账本。

快照登记绑定生成时的绝对路径和文件身份，移动或复制后不能直接复用，应在新的演示环境重新生成。没有审计登记的旧 Mock 库无法安全自动清理，工具会拒绝；须单独备份、核验及停止使用。正式数据不得混入模拟快照；已变更的快照保留并等待人工核验。

## 后续方案

[数据不足诊断与Agent生成Mock数据方案](docs/reviews/2026-10-12/数据不足诊断与Agent生成Mock数据方案.md)及[实施计划](docs/superpowers/plans/2026-10-12-data-insufficiency-plan.md)目前为待审阅稿，未包含在2.0已实现能力中。

旧版README保存于 [历史项目说明](docs/history/README-before-v2.md)。其中的模型、部署和完成度描述是旧版内容；当前发布状态以本README、发布说明与重构验收文档为准。

## 地域识别与共同地图

自由文本先由 LLM 识别任务、地域、时间、筛选及逐层请求，再由服务器验证原文证据、行政目录、权限和来源绑定。“显示河南省地图”使用独立地图技能，不读取监测事实；“郑州”绑定为郑州市，“新郑市”保持县级范围。新任务清空未明示的历史条件；澄清续答有身份、版本和15分钟时限约束。

地图统一使用 MapComposition。真实 SpatialOutput 可共享为点位、名称、视觉热力、区域面、扫描圆、插值网格或已有线几何；同一范围的查询可供多个呈现复用。数量热力保留零值并排除缺失值，区县中心不作为实测点生成热力；专业分析的网格、扫描半径和来源限制单独保留。没有管网、河网或实际坐标的结果明确报告缺少几何。

部署默认启用 `LLM_REGION_INTENT_ENABLED`。设为 `false` 时自由文本停止执行，显式界面操作和已冻结任务仍使用受控路径。目录由 `node scripts/build-region-catalog.mjs` 从本地行政边界构建；来源绑定使用 `config/dataset-region-bindings.json`，替换快照时必须登记对应版本的地域拼写与坐标系，可用 `DATASET_REGION_BINDINGS_PATH` 指向经过审核的绑定文件。

工程覆盖检查：`node scripts/check-spatial-capability-coverage.mjs`。真实模型开发及留出评估分别运行 `node scripts/evaluate-region-intent.mjs --suite development --repeats 3` 和 `--suite holdout --repeats 3`；凭据只从运行环境读取，报告不输出密钥。测试与运行限制见 [地域地图验收记录](docs/reviews/2026-10-13/地域地图验收记录.md)。
