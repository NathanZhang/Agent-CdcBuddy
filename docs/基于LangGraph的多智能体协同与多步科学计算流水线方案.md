# 基于 LangGraph 的 CdcBuddy 多智能体协同与多步科学计算流水线实施方案

本文档为 Agent-CdcBuddy (疾控病媒生物监测预警智能体平台) 升级至 **LangGraph 状态图与多智能体协同架构** 的官方技术实施规范。

---

## 🌟 一、 升级目标与架构演进

平台从传统的“单轮路由 / 同步 Tool-Calling 架构”升级为**“基于 LangGraph 的有状态、多智能体协同与复杂多步计算编排体系”**，核心满足两大核心业务场景：

1. **场景一：后台常驻多智能体（Daemon Agent）**
   - 系统启动后自动后台常驻运行；
   - 支持**定时轮询（可配置/支持热修改）**与**数据变更事件驱动（CDC/Hook/Redis Streams）**双轮驱动；
   - 支持**通过专家自然语言提示词（Prompt Policy）动态调整巡检研判规则**；
   - 自动生成分级预警事件并异步推送到消息队列及前端 SSE 通道。

2. **场景二：多步长链条科学计算流水线（Stateful Multi-step Graph）**
   - 支撑重型科学计算级联编排：`数据抽取` ➔ `SaTScan 时空扫描` ➔ `K-Means 风险亚群剖析` ➔ `LSTM 深度时序外推` ➔ `AG-UI 可视化`；
   - 具备状态持久化（Checkpointer）、断点恢复、条件分支与专家人机协同审核（Human-in-the-Loop Interrupt）。

---

## 🏛️ 二、 总体架构拓扑图

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 前端展示与交互层 (Next.js 15 + AG-UI)                            │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │ CopilotKit 对话/状态中枢│  │ AG-UI 动态生成式可视化组件│  │ WebSocket / SSE 实时预警订阅中枢     │  │
│  │ (LangGraph 状态流式同步)│  │ (GIS / ECharts / 工单) │  │ (实时接收后台智能体推入的预警事件)  │  │
│  └───────────▲───────────┘  └───────────▲────────────┘  └──────────────────▲──────────────────┘  │
└──────────────┼──────────────────────────┼──────────────────────────────────┼─────────────────────┘
               │ HTTP / SSE Stream        │                                  │ Push Notification
┌──────────────▼──────────────────────────┴──────────────────────────────────┴─────────────────────┐
│                          LangGraph 智能体服务中枢 (Python FastAPI / LangGraph 0.2+)              │
│                                                                                                  │
│  ┌──────────────────────────────────────────────┐  ┌──────────────────────────────────────────┐  │
│  │ 【场景一】后台常驻数据分析智能体 (Daemon)    │  │ 【场景二】多步复杂分析 Graph (Interactive)   │  │
│  │  Surveillance Daemon Graph                   │  │  Spatial-Temporal Prediction Graph       │  │
│  │                                              │  │                                          │  │
│  │  ┌──────────────┐      ┌──────────────────┐  │  │  ┌──────────────┐      ┌──────────────┐  │  │
│  │  │ 动态触发源   │ ───► │ 提示词策略注入   │  │  │  │ 数据检索抽取 │ ───► │ SaTScan 扫描 │  │  │
│  │  │(Timer / CDC) │      │(Prompt Policy)   │  │  │  │(DataExtract) │      │(Cluster Scan)│  │  │
│  │  └──────────────┘      └────────┬─────────┘  │  │  └──────────────┘      └──────┬───────┘  │  │
│  │                                 │ Config     │  │                               │ Clusters │  │
│  │  ┌──────────────┐      ┌────────▼─────────┐  │  │  ┌──────────────┐      ┌──────▼───────┐  │  │
│  │  │ 异步队列推送 │ ◄─── │ 空间/时序异常研判│  │  │  │ LSTM 趋势预测│ ◄─── │ K-Means 聚类 │  │  │
│  │  │(QueuePushNode)│      │(Multi-Agent Eval)│  │  │  │(LSTM Predict)│      │(Sub-Grouping)│  │  │
│  │  └──────┬───────┘      └──────────────────┘  │  │  └──────┬───────┘      └──────────────┘  │  │
│  │         │                                    │  │         │                                │  │
│  │         ▼ (周期休眠 / 事件等待)              │  │         ▼                                │  │
│  │    [Dynamic Interval / Event Listener]       │  │  ┌──────────────┐      ┌──────────────┐  │  │
│  │                                              │  │  │ 人机交互审查 │ ───► │ 生成UI综合报表│  │  │
│  │                                              │  │  │(Interrupt HIL)│      │(UI Synthesis)│  │  │
│  │                                              │  │  └──────────────┘      └──────────────┘  │  │
│  └──────────────────────────────────────────────┘  └──────────────────────────────────────────┘  │
│                                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 核心基础设施与算法支持                                                                     │  │
│  │ • Checkpointer: PostgresSaver / SqliteSaver (支持执行状态断点、重试与历史轨迹回溯)         │  │
│  │ • 算法引擎模块: analytics_engine/ (新增 satscan_cluster.py, lstm_predictor.py 等)          │  │
│  │ • 消息总线/任务队列: Redis Streams / Celery / BullMQ + Postgres LISTEN/NOTIFY              │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
┌───────────────────────────────────────┐   ┌──────────────────────────────────────────────────────┐
│  时空监测事实库 (vector_monitoring.db) │   │  业务持久化数据库 (app_business.db)                  │
│  (5.6万条多维时空事实 / 只读星型模型)  │   │  (预警事件表 biz_early_warning_events / 处置工单表)   │
└───────────────────────────────────────┘   └──────────────────────────────────────────────────────┘
```

---

## 🚀 三、 场景一：后台常驻数据分析智能体设计与实现

### 1. 配置管理与动态热重载
- **配置文件 (`config/daemon_config.yaml`)**：
  ```yaml
  surveillance_daemon:
    enabled: true
    trigger_mode: "hybrid"            # "interval" | "event_driven" | "hybrid"
    interval_seconds: 300            # 定时轮询默认间隔 (秒)
    cron_expression: "*/5 * * * *"   # Cron 表达式
    batch_size: 1000                 # 单次增量拉取最大记录数
    alert_push_queue: "redis://localhost:6379/0:cdc_alert_stream"
    active_prompt_profile: "summer_mosquito_peak" # 激活的提示词策略
  ```
- **RESTful 热重载接口**：
  - `GET /api/v1/daemon/config`：读取当前守护状态与间隔参数。
  - `POST /api/v1/daemon/config`：实时修改 `interval_seconds`，后台调度事件立即重置计时，无需重启服务。

### 2. 提示词驱动的任务策略动态注入 (Prompt-Driven Policy)
- **混合架构设计**：确定性算法核心（保障吞吐与数学准确性）+ LLM 提示词策略注入（赋予专家自由调整巡检规则的能力）。
- **专家自然语言指令示例**：
  > “当前进入豫南登革热防控关键期，重点巡检信阳市和南阳市白纹伊蚊；若布雷图指数 BI 环比增长超 20% 或发现 PCR 阳性，立即生成红色预警，并推荐以生物灭幼（Bti）为主的处置方案。”
- **Prompt Policy 节点解析**：
  LLM 自动将上述自然语言编译为结构化运行策略对象（JSON Policy）：
  ```json
  {
    "target_cities": ["信阳市", "南阳市"],
    "target_vectors": ["白纹伊蚊"],
    "spike_threshold": 0.20,
    "force_level": "red",
    "preferred_action": "biological_control"
  }
  ```

### 3. 数据变更事件驱动 (Event-Driven CDC) 机制
1. **应用层钩子**：移动端现场采集上传或批量监测导入成功后，触发 `event_bus.publish("DATA_INGESTED", batch_info)`。
2. **数据库级 CDC 兜底**：PostgreSQL 下通过 `LISTEN / NOTIFY`，SQLite 下通过文件系统变更或 Update Hook 监听。
3. **混合调度器实现 (`backend/daemon/event_listener.py`)**：
   ```python
   import asyncio
   from typing import AsyncGenerator
   import redis.asyncio as aioredis
   from langgraph.graph import CompiledGraph

   class SurveillanceDaemonRunner:
       def __init__(self, graph: CompiledGraph, interval: int = 300):
           self.graph = graph
           self.interval = interval
           self.is_running = False
           self.redis_client = None
           self.wake_event = asyncio.Event()

       async def start(self):
           self.is_running = True
           self.redis_client = aioredis.from_url("redis://localhost:6379/0")
           
           # 启动后台事件监听协程
           asyncio.create_task(self._listen_cdc_events())
           
           # 调度主循环 (Timer + Event Trigger)
           while self.is_running:
               try:
                   await self._execute_surveillance_cycle()
                   
                   # 等待 interval 超时 或 收到 wake_event 唤醒
                   try:
                       await asyncio.wait_for(self.wake_event.wait(), timeout=self.interval)
                       self.wake_event.clear()
                   except asyncio.TimeoutError:
                       pass # 定时器正常触发
               except Exception as e:
                   print(f"[Daemon Error] 巡检异常: {e}")
                   await asyncio.sleep(10)

       async def _listen_cdc_events(self):
           pubsub = self.redis_client.pubsub()
           await pubsub.subscribe("cdc_monitoring_data_channel")
           async for message in pubsub.listen():
               if message["type"] == "message":
                   print(f"[CDC Event] 接收到数据变更事件，立即唤醒研判: {message['data']}")
                   self.wake_event.set()
   ```

---

## 🔬 四、 场景二：多步复杂分析工作流 (SaTScan ➔ K-Means ➔ LSTM)

### 1. 业务场景定义
用户输入：“*调用 SaTScan 分析2022年3月全省的蚊媒密度分布，并将高风险区域的数据导入 LSTM 进行下一周的趋势预测。*”

### 2. State Schema 状态定义
```python
from typing import TypedDict, List, Dict, Any, Optional
from pydantic import BaseModel

class ScientificPipelineInput(BaseModel):
    target_year: int = 2022
    target_month: int = 3
    category: str = "蚊"
    species: Optional[str] = "白纹伊蚊"
    cluster_significance_p: float = 0.05
    forecast_horizon_days: int = 7

class ScientificPipelineState(TypedDict):
    input_params: ScientificPipelineInput
    chat_history: List[Dict[str, Any]]
    
    # 步骤产物
    extracted_spatial_data: List[Dict[str, Any]]
    satscan_clusters: List[Dict[str, Any]]
    satscan_significant_areas: List[str]
    satscan_llr_statistics: Dict[str, Any]
    kmeans_clusters: List[Dict[str, Any]]
    kmeans_feature_centers: Dict[int, Dict[str, float]]
    lstm_time_series_predictions: Dict[str, List[Dict[str, Any]]]
    lstm_confidence_intervals: Dict[str, Dict[str, List[float]]]
    
    # 审核与输出
    requires_expert_review: bool
    review_status: str
    generative_ui_payload: Dict[str, Any]
    execution_logs: List[str]
```

### 3. Graph 拓扑编排实现 (`backend/graphs/vector_satscan_lstm.py`)
```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver

def extract_data_step(state: ScientificPipelineState) -> dict: ...
def satscan_step(state: ScientificPipelineState) -> dict: ...
def kmeans_step(state: ScientificPipelineState) -> dict: ...
def lstm_step(state: ScientificPipelineState) -> dict: ...
def human_review_step(state: ScientificPipelineState) -> dict: ...
def ui_synthesis_step(state: ScientificPipelineState) -> dict: ...

def check_expert_review_condition(state: ScientificPipelineState) -> str:
    if state.get("requires_expert_review") and state.get("review_status") != "approved":
        return "human_review"
    return "ui_synthesis"

builder = StateGraph(ScientificPipelineState)
builder.add_node("data_extract", extract_data_step)
builder.add_node("satscan_scan", satscan_step)
builder.add_node("kmeans_cluster", kmeans_step)
builder.add_node("lstm_forecast", lstm_step)
builder.add_node("human_review", human_review_step)
builder.add_node("ui_synthesis", ui_synthesis_step)

builder.add_edge(START, "data_extract")
builder.add_edge("data_extract", "satscan_scan")
builder.add_edge("satscan_scan", "kmeans_cluster")
builder.add_edge("kmeans_cluster", "lstm_forecast")
builder.add_conditional_edges(
    "lstm_forecast", 
    check_expert_review_condition, 
    {
        "human_review": "human_review",
        "ui_synthesis": "ui_synthesis"
    }
)
builder.add_edge("human_review", "ui_synthesis")
builder.add_edge("ui_synthesis", END)

checkpointer = SqliteSaver.from_conn_string("app_business.db")
spatial_lstm_pipeline_graph = builder.compile(
    checkpointer=checkpointer,
    interrupt_before=["human_review"]
)
```

---

## 🛠️ 五、 实施路线与交付里程碑

| 阶段 | 周期 | 核心改造任务 | 交付产物 |
| :--- | :--- | :--- | :--- |
| **阶段一：算法引擎与依赖扩展** | 2~3 天 | 1. 引入 `langgraph>=0.2.0`, `torch`, `pysatscan`。<br>2. 补充 `analytics_engine/satscan_cluster.py` 与 `analytics_engine/lstm_predictor.py`。 | 独立的 Python 单元测试验证 SaTScan 与 LSTM 算法输出精度。 |
| **阶段二：LangGraph 服务与后台 Daemon** | 3~4 天 | 1. 搭建 FastAPI 智能体服务层。<br>2. 实现配置文件与 REST API 动态热修改轮询间隔。<br>3. 搭建 Redis / DB 事件监听，支持毫秒级增量唤醒。<br>4. 支持专家 Prompt 模板动态调整研判规则。 | 后台常驻 Agent 在定时与数据变更时自发研判并推入预警流。 |
| **阶段三：多步复杂分析 Graph 编排** | 3~4 天 | 1. 封装 `SaTScan ➔ K-Means ➔ LSTM` 多步流水线 Graph。<br>2. 实现条件分支、错误自动重试与 `interrupt()` 人机协同审核。 | CLI 与 REST API 能够端到端完成多步链式计算并输出结构化 JSON。 |
| **阶段四：前端 CopilotKit 与 AG-UI 联动** | 2~3 天 | 1. 升级 CopilotKit 连接到 LangGraph 后端。<br>2. 开发全新的生成式组件 `PipelineWorkflowViewer` 与 `SaTScanForecastMapCard`。<br>3. 实现 SSE 实时预警弹窗与动态脉冲高亮。 | 用户在 UI 对话中即可一键触发多步分析，直观查看算法流转过程与 GIS 预测渲染。 |
| **阶段五：全流程测试与验收** | 1~2 天 | 1. 运行 23 项基础测试用例与 LangGraph 集成测试用例。<br>2. 压力测试后台守护进程与长链条流水线的并发稳定性。 | 输出自动化测试报告与系统升级验收文档。 |
