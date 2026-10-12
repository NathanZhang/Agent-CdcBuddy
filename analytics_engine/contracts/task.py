"""Strict protocol boundary. Logs belong to stderr, numeric failures are never repaired."""
import json,math
from analytics_engine.contracts.result import SkillResult,DatasetRef,check_finite

def parse_task_args(text):
 def invalid(value):raise ValueError('Non-standard JSON constant: '+value)
 value=json.loads(text,parse_constant=invalid)
 if not isinstance(value,dict):raise ValueError('Task arguments must be an object')
 check_finite(value)
 return value

def json_value(value):
 if isinstance(value,dict):return {str(k):json_value(v) for k,v in value.items()}
 if isinstance(value,(list,tuple)):return [json_value(v) for v in value]
 if hasattr(value,'item'):return json_value(value.item())
 if value is None or isinstance(value,(str,bool,int,float)):
  check_finite(value);return value
 raise ValueError('Unsupported result value: '+type(value).__name__)

def task_result(run_id,domain,task,dataset,payload=None,error=None):
 status='FAILED' if error else payload.get('status','SUCCESS') if isinstance(payload,dict) else 'SUCCESS'
 if status not in ('SUCCESS','NO_DATA','INSUFFICIENT_DATA','FAILED','REVIEW_REQUIRED','CANCELLED'):raise ValueError('Unknown algorithm status')
 if isinstance(payload,dict) and payload.get('error') and status=='SUCCESS':status='FAILED';error=str(payload['error'])
 result={'schemaVersion':'1','runId':run_id,'domain':domain,'status':status,'method':'analytics:'+task,'datasets':[dataset],'payload':None if status in ('NO_DATA','FAILED','CANCELLED') else json_value(payload),'metrics':{},'qualityFlags':payload.get('qualityFlags',[]) if isinstance(payload,dict) else []}
 if status=='FAILED':result['error']={'code':'ANALYTICS_FAILED','message':error or 'Algorithm failed','retryable':False}
 return SkillResult.model_validate(result).model_dump(exclude_none=False)
