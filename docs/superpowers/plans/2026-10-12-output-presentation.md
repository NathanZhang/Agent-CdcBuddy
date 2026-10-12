# 中文分析结果与对话排版 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 根据用户截图，将 AG-UI 原始字段堆叠改为中文组合界面，并让 Agent 使用 Markdown 结构化回答。
**Architecture:** 展示层统一字段、状态、方法与数值格式；物种构成使用专用概览与地市交叉表，其他结果使用指标网格和可展开嵌套表格；主线 Agent 明确中文 Markdown 回复约定。
**Tech Stack:** React 19、TypeScript、Tailwind、Vitest。
**Spec:** 本次用户请求与附图。

## Global Constraints
- 不修改分析算法、数据原值、执行协议或导出内容。
- 中文优先；科学名称、模型缩写与原始标识保留可追溯性。
- 捕获数量不称记录数；缺测不填零；不推断风险等级。
- 主页面与嵌入窗口使用一致的 Markdown 展示。

## Review Focus
- 空数组、零值、null 和长小数正确显示。
- 地市交叉表不将缺测当作零值。
- 未知字段和嵌套对象仍可查看，不丢证据。
- 小屏表格只在容器内横向滚动。
- geo 定位链接及原始 Markdown 内容保持有效。

### Task 1: 中文组合分析界面
**Files:** 新增 result-presentation.ts、ResultDataView.tsx、SpeciesCompositionSummary.tsx；修改 AnalyticsResultCard.tsx、DataTableComponent.tsx、result-adapter.ts、GenerativeComponentRenderer.tsx、page.tsx。
**Interfaces:** fieldLabel(key)、formatValue(value,key)、statusLabel(status)、methodLabel(method)；ResultDataView(value)；SpeciesCompositionSummary(data)。
- [x] 写渲染回归测试，验证中文字段、四位指数、两位百分比、交叉表、缺测与嵌套详情。
- [x] 运行测试并确认旧实现失败。
- [x] 实现中文展示和组合视图；保留现有操作功能。
- [x] 运行测试、lint 和类型检查。

### Task 2: 中文 Markdown 对话
**Files:** main-agent.ts、MarkdownRenderer.tsx、page.tsx、EmbeddedWidget.tsx；渲染回归测试。
**Interfaces:** replyText 保持字符串与严格 JSON 外层契约；Markdown 支持标题、列表、表格与定位链接。
- [x] 明确中文、结论优先、表格对比、分点建议与限制说明的提示要求。
- [x] 优化排版字号、层次及表格滚动，修复父级收缩。
- [x] 验证 Markdown 渲染与主线执行回归。
- [x] 运行项目测试和浏览器布局验证，记录结果。

## Execution notes
- 当前工作区干净；原地实施可回退的展示优化，不新增工作树，不发布或推送。

- 验证：Vitest 139 项；科学测试 29 项；HTTP 集成 24 项；旧功能 44/44 且源库未变；lint、TypeScript、生产构建通过。
- HTTP 集成首次失败原因是沙箱禁止监听端口，获准重跑后通过。
- 真实模型试运行已输出中文 Markdown 标题和列表；首次自由查询触发工具预算，第二次自行附加地域/年份导致 NO_DATA，随后以明确参数完成真实物种分析，显示 2,069 只、15 物种、H′=1.1459，模型返回中文标题、表格、加粗及分点说明。
- 审查修正：保留地图显式高度，修正中文匹配及用户消息浅色配色。
- 浏览器：1440×1000 桌面暗/浅主题与 640×900 窄屏已检查；分页成功，页面无水平溢出。修复自动滚动带动整页的问题。
- 最终生产构建通过；现有 Docker 实例未更新。截图保存在当前聊天可视化目录 cdcbuddy-output-desktop.jpg。
