"""Rolling past-origin evaluation; no future records and no clipped fit metrics."""
from collections import defaultdict
import math,numpy as np
from analytics_engine.vector_methods import load_capture_history,fit_forecast,month_number,month_text,coefficient_of_determination
from analytics_engine.repositories.datasets import resolve_dataset_path,resolve_dataset_ref,connect_readonly

def evaluate_vector_forecast(dataset_id,as_of,horizon,db_path=None,city=None,category='蚊',data_window=60,model='ar',district=None,method_name=None):
 db_path=db_path or str(resolve_dataset_path('vector',dataset_id))
 with connect_readonly(db_path) as c:cities=[r[0] for r in c.execute('SELECT DISTINCT city FROM dim_location WHERE city IS NOT NULL ORDER BY city')]
 if city is not None:cities=[city]
 from pathlib import Path
 kind='synthetic'
 try:
  if Path(db_path).resolve()==resolve_dataset_path('vector',dataset_id).resolve() and resolve_dataset_ref('vector',dataset_id).origin=='observed':kind='real-backtest'
 except (ValueError,KeyError):pass
 groups=[];evaluated=0;baseline={}
 for location in cities:
  rows=load_capture_history(db_path,as_of,data_window,category=category,city=location,district=district,method_name=method_name);methods=defaultdict(list)
  for row in rows:methods[row['methodName']].append(row)
  for method,history in sorted(methods.items()):
   actual={r['period']:r['value'] for r in history};pairs=[];base=[]
   for index in range(max(14,len(history)-12),len(history)-horizon+1):
    trained=fit_forecast(history[:index],horizon,model)
    if not trained:continue
    origin=history[index-1]['period'];values={r['period']:r['value'] for r in history[:index]}
    for prediction in trained['forecasts']:
     if prediction['period'] not in actual:continue
     observed=actual[prediction['period']];previous_year=month_text(month_number(prediction['period'])-12);baseline_value=values.get(previous_year,history[index-1]['value'])
     pairs.append({'origin':origin,'target':prediction['period'],'actual':observed,'predicted':prediction['value']});base.append({'actual':observed,'predicted':baseline_value})
   if not pairs:continue
   a=np.array([p['actual'] for p in pairs]);p=np.array([p['predicted'] for p in pairs]);b=np.array([r['predicted'] for r in base]);den=np.abs(a)+np.abs(p);smape=float(np.mean(np.divide(2*np.abs(a-p),den,out=np.zeros_like(a),where=den>0))*100)
   group={'city':location,'methodName':method,'unit':'captures/record','asOf':as_of,'sampleCount':sum(r['sampleCount'] for r in history),'window':{'start':history[0]['period'],'end':history[-1]['period']},'evaluatedPairs':len(pairs),'mae':float(np.mean(np.abs(a-p))),'rmse':float(np.sqrt(np.mean((a-p)**2))),'r2':coefficient_of_determination(a,p),'smapePercent':smape,'baselineMae':float(np.mean(np.abs(a-b))),'meetsTenPercentSmapeCriterion':smape<=10,'pairs':pairs}
   groups.append(group);evaluated+=len(pairs);baseline[location+'|'+method]={'method':'previous-year-same-month-or-last-observation','mae':group['baselineMae']}
 # A root MAE across heterogeneous methods would hide their sampling semantics.
 value=groups[0]['mae'] if len(groups)==1 else None
 return {'method':'rolling-past-origin-capture-backtest-v1','status':'SUCCESS' if groups else 'INSUFFICIENT_DATA','model':model,'datasetId':dataset_id,'asOf':as_of,'horizon':horizon,'evaluatedPairs':evaluated,'groups':groups,'baseline':baseline,'metrics':{'mae':{'value':value,'evaluationKind':kind,'datasetIds':[dataset_id],'definition':'滚动截止点后实际观测误差；不同地市/采样方法分别报告，根值仅单组时提供'}},'qualityFlags':['capture-count-not-standard-density','method-specific-errors-not-pooled','capture-forecast-does-not-validate-standard-density-requirement']}
