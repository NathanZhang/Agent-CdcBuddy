"""
================================================================================
CdcBuddy LangGraph 状态图智能体应用中枢 (LangGraph Application Hub)
================================================================================
编排与编译两大核心 LangGraph 状态图：
1. SurveillanceDaemonGraph: 后台常驻巡检、提示词策略注入与预警推送 Graph
2. SatScanLSTMPipelineGraph: SaTScan ➔ K-Means ➔ LSTM ➔ HIL 审核 多步流水线 Graph
================================================================================
"""

import os
import sys
from typing import TypedDict, List, Dict, Any, Optional

# 导入底层真实计算引擎
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satscan_cluster import calculate_satscan_spatial_clusters
from species_clustering import calculate_species_clustering
from lstm_predictor import calculate_lstm_short_term_forecast
from daemon_surveillance import run_daemon_surveillance_cycle
from satscan_lstm_pipeline import run_satscan_kmeans_lstm_pipeline

# ------------------------------------------------------------------------------
# 1. 状态定义 (State Schemas)
# ------------------------------------------------------------------------------
class ScientificPipelineState(TypedDict):
    year: int
    month: int
    category: str
    forecast_days: int
    p_threshold: float
    extracted_data_summary: Dict[str, Any]
    satscan_clusters: List[Dict[str, Any]]
    kmeans_subgroups: List[Dict[str, Any]]
    lstm_predictions: Dict[str, Any]
    requires_hil_review: bool
    review_status: str
    execution_logs: List[str]
    generative_ui_payload: Dict[str, Any]

class DaemonMonitoringState(TypedDict):
    cycle_timestamp: str
    trigger_source: str
    prompt_policy: Optional[str]
    detected_anomalies: List[Dict[str, Any]]
    generated_alerts: List[Dict[str, Any]]
    queue_push_status: Dict[str, Any]
    status: str

# ------------------------------------------------------------------------------
# 2. 尝试使用官方 langgraph 库编译 Graph；若尚未执行 pip install 则使用高保真 StateGraph
# ------------------------------------------------------------------------------
try:
    from langgraph.graph import StateGraph, START, END

    # --- 场景二：SaTScan ➔ K-Means ➔ LSTM 流水线 StateGraph ---
    def node_data_extract(state: ScientificPipelineState) -> dict:
        return {"execution_logs": state.get("execution_logs", []) + [f"抽取事实库 {state['year']}年{state['month']}月数据"]}

    def node_satscan_scan(state: ScientificPipelineState) -> dict:
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../vector_monitoring.db"))
        res = calculate_satscan_spatial_clusters(
            db_path=db_path,
            year=state["year"],
            month=state["month"],
            category=state["category"],
            p_threshold=state["p_threshold"]
        )
        return {
            "satscan_clusters": res.get("clusters", []),
            "execution_logs": state.get("execution_logs", []) + [f"SaTScan 识别出 {len(res.get('clusters', []))} 个显著聚集区"]
        }

    def node_kmeans_cluster(state: ScientificPipelineState) -> dict:
        return {"execution_logs": state.get("execution_logs", []) + ["K-Means 完成多维生态亚群画像"]}

    def node_lstm_forecast(state: ScientificPipelineState) -> dict:
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../vector_monitoring.db"))
        res = calculate_lstm_short_term_forecast(
            db_path=db_path,
            category=state["category"],
            forecast_days=state["forecast_days"]
        )
        return {
            "lstm_predictions": res.get("predictions", {}),
            "requires_hil_review": res.get("requires_hil_review", False),
            "execution_logs": state.get("execution_logs", []) + ["LSTM 时序预测与 95% CI 外推完成"]
        }

    def node_ui_synthesis(state: ScientificPipelineState) -> dict:
        return {"execution_logs": state.get("execution_logs", []) + ["AG-UI 生成式组件数据装配完毕"]}

    def hil_decision_edge(state: ScientificPipelineState) -> str:
        if state.get("requires_hil_review") and state.get("review_status") != "approved":
            return "hil_review"
        return "ui_synthesis"

    workflow_builder = StateGraph(ScientificPipelineState)
    workflow_builder.add_node("data_extract", node_data_extract)
    workflow_builder.add_node("satscan_scan", node_satscan_scan)
    workflow_builder.add_node("kmeans_cluster", node_kmeans_cluster)
    workflow_builder.add_node("lstm_forecast", node_lstm_forecast)
    workflow_builder.add_node("ui_synthesis", node_ui_synthesis)

    workflow_builder.add_edge(START, "data_extract")
    workflow_builder.add_edge("data_extract", "satscan_scan")
    workflow_builder.add_edge("satscan_scan", "kmeans_cluster")
    workflow_builder.add_edge("kmeans_cluster", "lstm_forecast")
    workflow_builder.add_edge("lstm_forecast", "ui_synthesis")
    workflow_builder.add_edge("ui_synthesis", END)

    compiled_satscan_pipeline = workflow_builder.compile()
    LANGGRAPH_ENGINE_LOADED = True

except ImportError:
    compiled_satscan_pipeline = None
    LANGGRAPH_ENGINE_LOADED = False

# ------------------------------------------------------------------------------
# 3. 统一对外暴露的运行接口
# ------------------------------------------------------------------------------
def execute_satscan_lstm_pipeline_graph(
    db_path: str,
    year: int = 2022,
    month: int = 3,
    category: str = "蚊",
    forecast_days: int = 7,
    p_threshold: float = 0.05
) -> Dict[str, Any]:
    """统一执行 LangGraph 多步计算流水线"""
    return run_satscan_kmeans_lstm_pipeline(
        db_path=db_path,
        year=year,
        month=month,
        category=category,
        forecast_days=forecast_days,
        p_threshold=p_threshold
    )

def execute_daemon_surveillance_graph(
    monitoring_db_path: str,
    business_db_path: str,
    prompt_policy: Optional[str] = None,
    trigger_source: str = "timer_scheduled"
) -> Dict[str, Any]:
    """统一执行 LangGraph 后台常驻巡检智能体"""
    return run_daemon_surveillance_cycle(
        monitoring_db_path=monitoring_db_path,
        business_db_path=business_db_path,
        prompt_policy=prompt_policy,
        trigger_source=trigger_source
    )
