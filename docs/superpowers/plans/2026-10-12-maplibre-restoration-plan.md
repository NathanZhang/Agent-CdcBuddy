# MapLibre 地图恢复 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将 2.0 查询结果中的静态 SVG 地图恢复为旧版 MapLibre GL 地图交互。

**Architecture:** 沿用仓库已有的 MapLibre、天地图底图和河南行政区划 GeoJSON。新增面向实际查询数据的地图组件，替换 QueryResultVisualization 的地图分支；不引入旧版模拟点位和风险阈值。

**Tech Stack:** React 19、MapLibre GL 5、TypeScript、Vitest。

**Spec:** 用户要求恢复重构前 MapLibre 地图，包括深浅主题、半透明地市区县行政区划、卫星底图、缩放和版权信息。

## Global Constraints

- 保留工作区已有的其他修改。
- 只绘制结果中有效的经纬度和数值，零值保留，不补模拟数据。
- 主题或底图切换保留当前视野；结果变化更新点位。
- 使用既有依赖和本地边界文件。

## Review Focus

- 异步地图初始化期间数据、主题和图层变化仍使用最新值。
- 地图加载失败和 WebGL 不可用时给出可读提示，明细仍可查看。
- 数值为零、负值、缺失和非法坐标不会被伪造或误绘。
- 点位弹窗以文本渲染，标签不作为 HTML 执行。
- 卸载清理地图、订阅和 ResizeObserver。

### Task 1: Restore the result map

**Files:** Create `src/lib/geo/result-map.ts`, `src/components/ag-ui/QueryResultMap.tsx`; modify `src/components/ag-ui/QueryResultVisualization.tsx`; test `tests/refactor/result-map.test.tsx` and existing recommendations tests.

- [x] 添加回归测试，覆盖有效点位、GeoJSON、卫星与主题样式、行政区划层顺序及地图控件的可访问输出。
- [x] 执行测试并确认当前实现不能满足这些行为。
- [x] 实现数据适配、地图样式和客户端组件，恢复缩放、比例尺、版权、图层开关和视野复位。
- [x] 接入查询结果地图并验证已有表格和图表行为。
- [x] 执行 `npm test`、`npm run lint`、`npx tsc --noEmit` 和构建；检查差异与可用的浏览器界面。

## Execution notes

直接在当前工作区实施此次可逆修改，不创建提交或更改其他进行中的工作。用户已要求实施，按开发者指示不增加计划审批步骤。

验证结果：最终 Vitest 30 文件、273 测试通过；科学测试 29/29、集成测试 24/24、隔离旧版回归 44/44 通过（npm test 在允许本地 HTTP 监听环境复跑成功）。Lint、TypeScript 检查和隔离生产构建通过。浏览器验证了矢量底图、卫星影像、行政边界、深浅主题、缩放、比例尺和版权；相同点位重新渲染后比例尺保持 10 km，确认视野未复位。

审查修正：以 source/layer 是否存在判断是否可同步数据，避免 isStyleLoaded 在普通瓦片加载期间阻止更新；按点位内容变化触发复位；弹窗使用 GeoJSON properties 中原始经纬度，避免渲染几何量化误差。测试产生的报告与 Next 配置修改已恢复，其他任务原有工作未更改。

## Follow-up: actual Agent query failure (2026-10-12)

用户报告“无法继续技能执行”和地图未显示。读取现有运行审计确认：首次 SQL 使用不支持的 printf；随后 city=河南省将省级范围误当作地市过滤，查询 NO_DATA 并耗尽3轮工具预算。

修复：查询范围先校验权限，再归一化省名/全省参数；工具 schema 和系统提示明确 city 只表示地市、日期应直接使用事实表字段及允许函数；工具预算结束后允许一次无工具最终汇总纠错；已授权的成功 AG-UI 在预算耗尽时保留，权限拒绝时所有退出路径清空；仅同有效范围与真实可绘制点位的修正查询能解除此前地图查询失败。恢复判定以解析后的表、JOIN 与 WHERE 约束为依据，忽略表别名；无法证明等价时保留失败状态。

新增回归均先失败再通过，涵盖全省范围、权限不扩张、同范围纠错、诊断统计不能冒充地图、不同年份不能冒充恢复、权限失败后预算异常。最终全套：Vitest 31 文件/282 测试，科学测试29/29，集成24/24，隔离旧版44/44；lint、tsc和隔离构建均通过。实际浏览器原始请求运行 SUCCESS，一次查询返回143个有效点位，地图和日期/监测次数明细正常显示。本地服务使用原有 /private/tmp/cdcbuddy-presentation-business.db。
