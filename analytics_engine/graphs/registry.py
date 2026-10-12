"""Resolve only graphs actually executed by the engine, with explicit database inputs."""
import importlib
GRAPH_TASKS={'satscan_kmeans_lstm_pipeline':'pipeline','composable_workflow':'composable','dynamic_workflow':'composable','daemon_surveillance':'daemon','daemon_surveillance_cycle':'daemon'}
_TARGETS={'pipeline':('analytics_engine.satscan_lstm_pipeline','run_satscan_kmeans_lstm_pipeline'),'composable':('analytics_engine.composable_workflow','run_dynamic_composable_workflow'),'daemon':('analytics_engine.daemon_surveillance','run_daemon_surveillance_cycle')}
def get_graph(task):
 if task not in GRAPH_TASKS:raise ValueError('Unknown graph task')
 module,name=_TARGETS[GRAPH_TASKS[task]]
 return getattr(importlib.import_module(module),name)
def invoke_graph(task,db_path,args,business_db_path=None):
 graph=get_graph(task);kind=GRAPH_TASKS[task]
 if kind=='pipeline':return graph(db_path=db_path,year=int(args.get('year',2022)),month=int(args.get('month',3)),category=args.get('category','蚊'),forecast_days=int(args.get('forecastDays',7)),p_threshold=float(args.get('pThreshold',.05)))
 if kind=='composable':return graph(db_path=db_path,workflow_name=args.get('workflowName','多技能动态协同工作流'),steps=args.get('steps',[]),initial_context=args.get('initialContext',{}))
 if not business_db_path:raise ValueError('Explicit business database required')
 return graph(monitoring_db_path=db_path,business_db_path=business_db_path,prompt_policy=args.get('promptPolicy') or args.get('prompt_policy'),trigger_source=args.get('triggerSource') or args.get('trigger_source','timer_scheduled'))
