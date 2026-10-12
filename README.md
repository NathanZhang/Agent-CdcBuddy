# Agent-CdcBuddy 2.0

Agent-CdcBuddy 面向病媒生物、食源性疾病、环境健康、死因慢病与伤害四个领域提供疾控监测分析工作台。2.0 将业务交互统一到主线 Agent，由实际 LLM 调用真实 Skills，根据执行证据生成中文对话与 AG-UI。

当前版本为 **2.0.0**，Git 标签为 **v2.0.0**。发布范围和限制见 [2.0 发布说明](docs/releases/v2.0.0.md)，详细验收边界见 [重构交付与剩余能力](docs/reviews/2026-10-12/重构交付与剩余能力.md)。原54项专业功能尚未全部实现；Skill可调用表示相应受限方法可执行，不代表完整专业需求已验收。

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

## 后续方案

[数据不足诊断与Agent生成Mock数据方案](docs/reviews/2026-10-12/数据不足诊断与Agent生成Mock数据方案.md)及[实施计划](docs/superpowers/plans/2026-10-12-data-insufficiency-plan.md)目前为待审阅稿，未包含在2.0已实现能力中。

旧版README保存于 [历史项目说明](docs/history/README-before-v2.md)。其中的模型、部署和完成度描述是旧版内容；当前发布状态以本README、发布说明与重构验收文档为准。
