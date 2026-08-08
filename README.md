# Agent-CdcBuddy (疾控病媒生物监测预警智能体平台)

> **新一代基于大语言模型与 CopilotKit 的疾控中心 (CDC) 病媒生物监测、抗药性评估、疫情风险研判与消杀处置全流程智能协作平台。**

[![Next.js](https://img.shields.io/badge/Next.js-15.1.7-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat&logo=react)](https://react.dev/)
[![CopilotKit](https://img.shields.io/badge/CopilotKit-1.4.0-6366F1?style=flat)](https://copilotkit.ai/)
[![Python](https://img.shields.io/badge/Python-3.9+-3776AB?style=flat&logo=python)](https://python.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

---

## 🌟 核心特性与平台全景

Agent-CdcBuddy 专为国家、省、市、县四级疾病预防控制中心（CDC）及爱卫办量身打造，打通**“现场采集 ➔ 智能识别 ➔ 动态预警 ➔ 风险研判 ➔ 处置闭环 ➔ 专报生成”**全链条业务流。

```
                    ┌─────────────────────────────────────────────────────────┐
                    │               Agent-CdcBuddy 智能中枢                     │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
          ┌──────────────────────┬───────────────┴──────────────┬──────────────────────┐
          ▼                      ▼                              ▼                      ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│  监测分析智能体   │   │  抗药性分析智能体 │   │  风险评估智能体   │   │  处置推荐智能体   │
│Surveillance Agent│   │ Resistance Agent │   │  Risk Agent      │   │Intervention Agent│
├──────────────────┤   ├──────────────────┤   ├──────────────────┤   ├──────────────────┤
│• 种群动态ARIMA消长│   │• 抗药性ML分级判定│   │• 动力学传播风险  │   │• 智能处置方案生成│
│• 优势种聚类与多样│   │• LC50 毒力回归测定│   │• PCR 病原关联挖掘│   │• 派发消杀流转工单│
│• GBDT密度长期预测│   │• 贝叶斯基因演化图│   │• 空间时空动态预警│   │• 48h复测核销闭环 │
└─────────┬────────┘   └─────────┬────────┘   └─────────┬────────┘   └─────────┬────────┘
          └──────────────────────┼──────────────────────────────┴──────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       ┌───────────────────┐           ┌───────────────────┐
       │ 生成式 UI (AG-UI) │           │ Python 科学算法引擎│
       ├───────────────────┤           ├───────────────────┤
       │• 国家天地图 GIS   │           │• ARIMA/LSTM 预测  │
       │• ECharts 双轴时序 │           │• GBDT 气象驱动回归│
       │• 抗药性热力矩阵   │           │• 克里金/IDW空间插值│
       │• 风险动态仪表盘   │           │• Apriori 病原关联 │
       │• 处置工单操作卡   │           │• 贝叶斯耐药演化   │
       │• 自动化专报导出   │           │• Shannon 多样性   │
       └───────────────────┘           └───────────────────┘
```

---

## 🚀 核心架构与技术能力

### 1. 🤖 四智能体协同架构 (Four-Agent Collaboration)
- **🦟 监测分析智能体 (Surveillance Agent)**：基于 5.6 万条多维监测数据，实现蚊、蝇、鼠、蜚蠊、蜱等重点病媒生物的密度消长分析、空间集聚识别与种群多样性测算。
- **🧪 抗药性分析智能体 (Resistance Agent)**：构建拟除虫菊酯、有机磷、氨基甲酸酯等常用杀虫剂的抗性矩阵，输出 LC50 毒力回归参数与 1 年内 KDR 等位基因演化预测。
- **⚠️ 风险评估智能体 (Risk Assessment Agent)**：结合病原学 PCR 检测结果（登革病毒、乙脑、疟原虫、汉坦病毒等）与气象生境，量化 0~100 综合传播风险指数，触发三级空间预警。
- **🛠️ 处置推荐智能体 (Intervention Agent)**：依据国家标准（GB/T、WS/T）自动生成物理清除、化学超低容量喷雾（ULV）、生物灭幼方案，下发流转工单并跟踪 48 小时复测核销。

### 2. 🧮 Python 科学计算算法引擎 (`analytics_engine/`)
系统内嵌高性能 Python 算法服务模块，支持标准算法模型的即时调度与计算：
- `population_dynamics.py`：时间序列 ARIMA / LSTM 季节消长预测与置信区间计算。
- `density_gbdt.py`：融合温湿度、生境特征的 GBDT 密度预测与特征重要性权重分析。
- `spatial_interpolation.py`：基于克里金 (Kriging) 与反距离权重 (IDW) 的空间密度平滑插值。
- `pathogen_apriori.py`：Apriori 关联规则挖掘高危病原体-媒介昆虫-易感生境组合。
- `resistance_ml.py` & `resistance_evolution.py`：耐药性机器学习分级与马尔可夫/贝叶斯基因突变演化。
- `species_clustering.py` & `transmission_risk.py`：K-Means 优势种聚类、Shannon-Wiener 多样性指数与传播动力学模型。

### 3. 💾 双数据库协同持久化架构
- **时空监测事实库 (`vector_monitoring.db`)**：涵盖河南省 18 地市 5.6 万+ 条捕获记录、PCR 筛查与抗药性生物测定事实表（星型模型）。
- **业务持久化闭环库 (`app_business.db`)**：独立持久化消杀处置工单 (`biz_disposal_tickets`)、分级预警事件 (`biz_early_warning_events`)、移动端审核流 (`biz_mobile_submissions`)、国家标准规范库 (`biz_kb_standards`)、生成专报归档 (`biz_generated_reports`) 与自定义技能 (`biz_custom_skills`)。
- **支持国产信创平滑迁移**：具备 DAL 数据访问抽象层，一键无缝切换至 **PostgreSQL 14+** 或 **人大金仓 (KingbaseES V8/V9)**。

### 4. 🎨 AG-UI 生成式界面与多模态交互
- **国家天地图 (Tianditu) GIS**：支持全省宏观热力图、点位聚类、区县/街道平滑下钻与脉冲高亮预警。
- **可视化图表库**：双轴气温关联时序折线图、南丁格尔玫瑰图、耐药热力矩阵图、传播风险动态仪表盘。
- **多模态与专报生成**：支持移动端 AI 拍照物种识别模拟、自然语言 Text2SQL 智能查询、一键导出 PDF / Markdown 专题研判公报。
- **对话式元技能扩展 (Meta-Skill Builder)**：通过对话自动解析意图、编译安全 SQL、绑定可视化模板并注册至技能集市。

### 5. 🔒 细粒度 RBAC 权限体系
内置四大角色权限矩阵：
- **省级管理员**：全省全域数据透视、阈值管理、算法调优、自定义技能发布与专报审批。
- **市级专家**：辖区监测分析、抗药性评估、预警推送、消杀指导与工单派发。
- **区县监测员**：现场采集上报、移动端录入、质控核验、工单执行与 48h 复测核销。
- **公众用户**：常见病媒科普、科普问答、辖区一般预警概览。

---

## 🛠️ 快速启动指南

### 1. 环境准备
- **Node.js**：v18.0.0+ (推荐 v20+)
- **Python**：v3.9+ (内置科学计算库 numpy, scipy, scikit-learn, pandas 等)

### 2. 获取代码与依赖安装
```bash
git clone https://github.com/NathanZhang/Agent-CdcBuddy.git
cd Agent-CdcBuddy

# 安装前端与 CopilotKit 依赖
npm install
```

### 3. 配置环境变量
复制环境变量模版并填入对应配置：
```bash
cp .env.example .env.local
```
编辑 `.env.local`：
```env
# 硅基流动 SiliconFlow 大模型服务配置
SILICONFLOW_API_KEY=sk-your-siliconflow-api-key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=Qwen/Qwen3.6-27B

# 国家地理信息公共服务平台 天地图 Tianditu 开发者 Key (可选，用于空间GIS底图)
NEXT_PUBLIC_TIANDITU_KEY=your_tianditu_browser_key
```

### 4. 统一运维启动服务

系统提供标准化运维脚本 `server.sh`，可一键完成环境检测、Python 虚拟环境配置、数据库初始核验与服务启动：

```bash
# 启动开发服务器 (默认端口 3000)
./server.sh start dev

# 或者直接启动
./start.sh

# 查看当前运行状态与 PID
./server.sh status

# 实时查看系统运行日志
./server.sh logs

# 停止服务
./server.sh stop
# 或 ./stop.sh
```

打开浏览器访问：**`http://localhost:3000`** 即可进入系统主控制台。

---

## 🧪 自动化测试体系

Agent-CdcBuddy 提供了全覆盖的自动化测试套件，全面验证 13 项核心业务技能、Meta-Skill 动态技能创建、移动端接口与 RBAC 权限安全体系：

```bash
# 运行完整自动化测试套件
npm test
# 或执行: ./.venv/bin/python tests/automated_test_suite.py
```

- **测试范围**：13 项核心技能、Meta-Skill 创建、移动端识别/质控/上报 API、4 种 RBAC 角色权限。
- **测试通过率**：**100% (23/23 用例全部 PASS)**。
- **测试报告**：详见 [自动化测试执行报告 (Markdown)](tests/test_execution_report.md) 及 [JSON 报告](tests/test_execution_report.json)。

---

## 📂 项目工程目录结构

```text
Agent-CdcBuddy/
├── README.md                          # 项目核心总览与使用手册
├── package.json                       # 前端依赖与 NPM 脚本
├── requirements.txt                   # Python 科学计算依赖
├── server.sh                          # 统一运维管理脚本 (start|stop|restart|status|logs)
├── start.sh / stop.sh                 # 极简启动与停止脚本
├── vector_monitoring.db               # 疾控多维时空监测只读事实库 (5.6万条数据)
├── app_business.db                    # 业务状态持久化数据库 (工单/预警/审核/自定义技能)
├── analytics_engine/                  # Python 科学算法与机器学习分析引擎
│   ├── engine.py                      # 统一算法调度入口
│   ├── population_dynamics.py         # ARIMA 种群消长时序模型
│   ├── density_gbdt.py                # GBDT 气象驱动密度预测
│   ├── spatial_interpolation.py       # 克里金 / IDW 空间插值
│   ├── pathogen_apriori.py            # Apriori 病原关联规则挖掘
│   ├── resistance_ml.py               # 抗药性分类与 LC50 回归
│   ├── resistance_evolution.py        # 贝叶斯耐药基因演化模型
│   ├── species_clustering.py          # 优势种聚类与 Shannon 多样性
│   └── transmission_risk.py           # 动力学传播风险综合评估
├── src/                               # 核心应用源码
│   ├── app/                           # Next.js App Router
│   │   ├── api/copilotkit/            # CopilotKit Runtime 后端端点
│   │   ├── api/v1/mobile/             # 移动端 RESTful 开放 API (识别/质控/上报)
│   │   ├── api/skills/                # 自定义技能 RESTful API
│   │   ├── globals.css                # 全局样式与暗黑主题
│   │   └── page.tsx                   # 疾控主工作区与智能体会话中枢
│   ├── components/                    # 组件库
│   │   ├── ag-ui/                     # AG-UI 生成式界面组件 (地图/图表/工单/专报等 14 款)
│   │   ├── common/                    # 通用基础组件 (Header, Sidebar, CopilotIcon 等)
│   │   └── layout/                    # 布局与嵌入式浮窗组件 (EmbeddedWidget)
│   └── lib/                           # 核心业务库
│       ├── analytics/                 # 前端与 Python 引擎通信适配器
│       ├── data/                      # 静态元数据与词典
│       ├── db/                        # 数据库抽象层 DAL (SQLite / PostgreSQL / 金仓)
│       ├── geo/                       # GIS 地理坐标与图层工具
│       ├── rbac/                      # 角色权限鉴定与策略中枢
│       ├── skills/                    # 13 项出厂业务 Skills 定义与执行器
│       └── theme/                     # 主题设计系统
├── docs/                              # 开发者与业务技术文档中心
│   ├── 需求功能对照清单及使用教程.md
│   ├── 算法引擎与四智能体架构设计规范.md
│   ├── Text2SQL与多模态交互及智能问答指南.md
│   ├── 自动化测试与质量保障指南.md
│   ├── 移动端API开发指南及调用示例.md
│   ├── 生产环境PostgreSQL及人大金仓(KingbaseES)迁移指南.md
│   ├── 自定义Skills对话扩展指南.md
│   └── 嵌入式浮窗与API模式接入指南及示例代码.md
├── scripts/                           # 数据库初始化与运维脚本
│   └── init_business_db.py            # 业务持久化库初始化脚本
└── tests/                             # 自动化测试与验证
    ├── automated_test_suite.py        # 核心全链路自动化测试套件
    ├── test_execution_report.md       # 自动化测试执行报告 (Markdown)
    └── test_execution_report.json     # 自动化测试结果 (JSON)
```

---

## 📚 详细技术与接入文档中心

| 文档名称 | 内容概述 | 适用对象 |
| :--- | :--- | :--- |
| 📖 [**需求功能对照清单及使用教程**](docs/需求功能对照清单及使用教程.md) | 对照第 23~35 项国家业务需求，逐项详解技能、AG-UI 组件与实操 Prompt | 业务专家 / 疾控人员 / 评测专家 |
| 🧠 [**算法引擎与四智能体架构设计规范**](docs/算法引擎与四智能体架构设计规范.md) | 四智能体协同逻辑、Python 算法引擎 8 大数学模型与双库 DAL 架构设计 | 架构师 / 算法工程师 / 研发人员 |
| 💬 [**Text2SQL与多模态交互及智能问答指南**](docs/Text2SQL与多模态交互及智能问答指南.md) | 知识库检索引擎、Text2SQL 安全查询、拍照识别、多模态研判与专报导出 | 研发人员 / AI 应用工程师 |
| 🧪 [**自动化测试与质量保障指南**](docs/自动化测试与质量保障指南.md) | 自动化测试框架结构、13 项技能测试用例、Meta-Skill 与安全测试详情 | 测试工程师 / 质量保障团队 |
| 📱 [**移动端API开发指南及调用示例**](docs/移动端API开发指南及调用示例.md) | 现场拍照识别、实时质控校验、数据采集上报等 RESTful API 与多语言示例 | 移动端开发者 / 前端工程师 |
| 🏢 [**生产环境PostgreSQL及人大金仓迁移指南**](docs/生产环境PostgreSQL及人大金仓(KingbaseES)迁移指南.md) | 双数据库 DDL 建表脚本、数据一键迁移管道与信创环境适配方案 | 运维工程师 / DBA / 信创部署团队 |
| 🛠️ [**自定义Skills对话扩展指南**](docs/自定义Skills对话扩展指南.md) | Meta-Skill 动态技能创建原理、语义解析、SQL 自动编译与动态注册 | 业务专家 / 系统管理员 |
| 🪟 [**嵌入式浮窗与API模式接入指南及示例代码**](docs/嵌入式浮窗与API模式接入指南及示例代码.md) | 单行 Script、React 组件、Vue3 Iframe 快速引入既有业务系统指南 | 第三方系统集成商 / 研发人员 |

---

## 📄 开源协议与声明

本项目基于 [MIT License](LICENSE) 开源发布。
本项目所涉及的演示监测数据均经脱敏与合成处理，旨在为公共卫生与疾病预防控制领域的智能化转型提供高标准的开源技术范式与参考实现。
