"""Compatibility names for the canonical, actually executed graph registry."""
from analytics_engine.graphs.registry import invoke_graph
from importlib.util import find_spec
try:LANGGRAPH_ENGINE_LOADED=find_spec('langgraph.graph') is not None
except ModuleNotFoundError:LANGGRAPH_ENGINE_LOADED=False

def execute_satscan_lstm_pipeline_graph(db_path,year=2022,month=3,category='蚊',forecast_days=7,p_threshold=.05):
 return invoke_graph('satscan_kmeans_lstm_pipeline',db_path,{'year':year,'month':month,'category':category,'forecastDays':forecast_days,'pThreshold':p_threshold})
def execute_daemon_surveillance_graph(monitoring_db_path,business_db_path,prompt_policy=None,trigger_source='timer_scheduled'):
 return invoke_graph('daemon_surveillance',monitoring_db_path,{'promptPolicy':prompt_policy,'triggerSource':trigger_source},business_db_path)
