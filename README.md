# Agent-CdcBuddy (疾控病媒监测智能体)

> 基于大模型与 CopilotKit 的新一代疾控中心 (CDC) 病媒生物监测与抗药性智能分析平台。

---

## 🌟 核心特性

- **四智能体协同架构**：
  - 🦟 **监测分析智能体 (Surveillance Agent)**：病媒密度监测、趋势分析、物种构成比分析
  - 🧪 **抗药性分析智能体 (Resistance Agent)**：抗药性分级判定、矩阵透视与演化预测
  - ⚠️ **风险评估智能体 (Risk Assessment Agent)**：传播风险等级量化、病原体关联分析
  - 🛠️ **处置推荐智能体 (Intervention Agent)**：消杀方案自动生成、全流程处置闭环工单

- **动态生成式 UI (Generative UI)**：
  - 支持 GIS 地图空间分布热力呈现（集成国家天地图）
  - 密度趋势折线图、物种构成饼图、抗药性热力矩阵图、抗药性演化图
  - 风险仪表盘、预警卡片与处置方案审批卡片

- **多端与多模式支持**：
  - **嵌入式浮窗模式 (Embedded Widget)**：一键引入 `<script src="cdc-buddy-embed.js"></script>`
  - **移动端现场监测 API**：支持物种 AI 识别、数据校验、断网暂存与同步
  - **多数据库驱动**：内置 SQLite 演示引擎，无缝扩展 PostgreSQL / 人大金仓 (KingbaseES)
  - **自定义 Skills 扩展**：支持界面配置与动态注册业务技能

---

## 🚀 快速启动

### 1. 环境要求
- Node.js 18+
- npm / yarn / pnpm

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
复制环境变量模版并配置：
```bash
cp .env.example .env.local
```

编辑 `.env.local`：
```env
# SiliconFlow 硅基流动大模型服务配置
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=Qwen/Qwen3.6-27B

# 国家地理信息公共服务平台 天地图 Tianditu 开发者 Key (可选)
NEXT_PUBLIC_TIANDITU_KEY=your_tianditu_key_here
```

### 4. 本地启动开发服务器
```bash
npm run dev
```
打开浏览器访问 [http://localhost:3000](http://localhost:3000)。

---

## 📚 详细开发与接入文档

- [嵌入式浮窗与 API 模式接入指南及示例代码](docs/嵌入式浮窗与API模式接入指南及示例代码.md)
- [移动端 API 开发指南及调用示例](docs/移动端API开发指南及调用示例.md)
- [生产环境 PostgreSQL 及人大金仓 (KingbaseES) 迁移指南](docs/生产环境PostgreSQL及人大金仓(KingbaseES)迁移指南.md)
- [自定义 Skills 对话扩展指南](docs/自定义Skills对话扩展指南.md)
- [需求功能对照清单及使用教程](docs/需求功能对照清单及使用教程.md)

---

## 📄 开源协议

MIT License
