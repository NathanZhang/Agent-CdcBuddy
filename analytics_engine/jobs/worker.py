"""Persistent review barrier only. Business computations run in the main LLM Agent."""
import json,sys
from typing import TypedDict
from langgraph.graph import StateGraph,START,END
from langgraph.types import interrupt,Command
from langgraph.checkpoint.sqlite import SqliteSaver
class State(TypedDict,total=False):
 jobId:str
 runId:str
 status:str
def review(state):
 decision=interrupt({'jobId':state['jobId'],'runId':state['runId'],'required':'professional-review'})
 if decision not in ('approve','reject'):raise ValueError('Invalid decision')
 return {'status':'APPROVED' if decision=='approve' else 'REJECTED'}
def advance(path,run_id,input_state=None,decision=None):
 with SqliteSaver.from_conn_string(path) as saver:
  builder=StateGraph(State);builder.add_node('review',review);builder.add_edge(START,'review');builder.add_edge('review',END);graph=builder.compile(checkpointer=saver);config={'configurable':{'thread_id':run_id}}
  snapshot=graph.get_state(config)
  if snapshot.values.get('status') in ('APPROVED','REJECTED'):return snapshot.values['status']
  if decision:
   if not snapshot.tasks:raise ValueError('No pending review checkpoint')
   graph.invoke(Command(resume=decision),config)
  elif not snapshot.values:
   if not input_state or input_state.get('runId')!=run_id:raise ValueError('Run identity required')
   graph.invoke({**input_state,'status':'WAITING_REVIEW'},config)
  return graph.get_state(config).values['status']
if __name__=='__main__':
 args=json.loads(sys.argv[1]);print(json.dumps({'status':advance(**args)}))
