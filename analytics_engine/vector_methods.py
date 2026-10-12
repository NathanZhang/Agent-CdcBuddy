"""Time-bounded, method-separated capture statistics. Capture counts are not standard density."""
from datetime import date
from collections import defaultdict
import math,sqlite3
import numpy as np
from analytics_engine.repositories.datasets import connect_readonly

def cutoff_date(db_path,as_of=None):
 if as_of is not None:return date.fromisoformat(as_of).isoformat()
 with connect_readonly(db_path) as c:row=c.execute('SELECT MAX(date_id) FROM fact_monitoring').fetchone()
 return row[0] if row and row[0] else date.today().isoformat()
def month_number(text):return int(text[:4])*12+int(text[5:7])-1
def month_text(number):return f'{number//12:04d}-{number%12+1:02d}'
def coefficient_of_determination(actual,predicted):
 a=np.asarray(actual,dtype=float);p=np.asarray(predicted,dtype=float)
 if not len(a) or len(a)!=len(p):return None
 denominator=float(np.sum((a-np.mean(a))**2))
 return None if denominator==0 else float(1-np.sum((a-p)**2)/denominator)
def load_capture_history(db_path,as_of=None,data_window=60,frequency='month',category='蚊',species_name=None,city=None,district=None,method_name=None):
 if frequency not in ('month','day') or not isinstance(data_window,int) or not 1<=data_window<=3650:raise ValueError('Invalid history window')
 cutoff=cutoff_date(db_path,as_of);where=['f.date_id<=?','f.capture_count>=0'];params=[cutoff]
 for expression,value in [('s.category',category),('s.species_name',species_name),('l.city',city),('l.district',district),('m.method_name',method_name)]:
  if value is not None:where.append(expression+'=?');params.append(value)
 period='substr(f.date_id,1,7)' if frequency=='month' else 'f.date_id'
 sql=f'''SELECT m.method_name, {period} AS period,AVG(f.capture_count) AS value,SUM(f.capture_count) AS captures,COUNT(*) AS records,COUNT(CASE WHEN f.sampling_unit>0 THEN 1 END) AS effort_records,SUM(CASE WHEN f.sampling_unit>0 THEN f.sampling_unit ELSE 0 END) AS effort,SUM(CASE WHEN f.sampling_unit>0 THEN f.capture_count ELSE 0 END) AS effort_captures FROM fact_monitoring f JOIN dim_species s ON s.species_id=f.species_id JOIN dim_location l ON l.location_id=f.location_id LEFT JOIN dim_method m ON m.method_id=f.method_id WHERE {' AND '.join(where)} GROUP BY m.method_name,{period} ORDER BY period ASC,m.method_name'''
 groups=defaultdict(list)
 with connect_readonly(db_path) as c:
  c.row_factory=sqlite3.Row
  for row in c.execute(sql,params):
   r=dict(row);groups[r['method_name']].append({'period':r['period'],'methodName':r['method_name'] or '未登记方法','value':float(r['value']),'captureCount':float(r['captures']),'sampleCount':r['records'],'effortRecords':r['effort_records'],'samplingUnitRatio':float(r['effort_captures']/r['effort']) if r['effort'] else None})
 return sorted([row for group in groups.values() for row in group[-data_window:]],key=lambda r:(r['period'],r['methodName']))
def feature(number,lag1,lag2):return [lag1,lag2,math.sin(2*math.pi*(number%12)/12),math.cos(2*math.pi*(number%12)/12)]
def fit_forecast(history,horizon,method='ar'):
 if not isinstance(horizon,int) or not 1<=horizon<=36:raise ValueError('Invalid forecast horizon')
 if method not in ('ar','gbdt'):raise ValueError('Unknown forecast model')
 values={month_number(r['period']):r['value'] for r in history};numbers=sorted(values);X=[];y=[]
 for n in numbers:
  if n-1 in values and n-2 in values:X.append(feature(n,values[n-1],values[n-2]));y.append(values[n])
 minimum=12 if method=='gbdt' else 6
 if len(y)<minimum or not numbers or numbers[-1]-1 not in values:return None
 X=np.asarray(X);y=np.asarray(y)
 if method=='gbdt':
  from sklearn.ensemble import GradientBoostingRegressor
  model=GradientBoostingRegressor(n_estimators=80,max_depth=2,learning_rate=.05,random_state=42).fit(X,y)
  predict=lambda x:float(model.predict(np.asarray(x).reshape(1,-1))[0]);fitted=model.predict(X);importance=[float(v) for v in model.feature_importances_]
 else:
  design=np.column_stack([np.ones(len(X)),X]);beta=np.linalg.lstsq(design,y,rcond=None)[0]
  predict=lambda x:float(np.dot([1,*x],beta));fitted=design@beta;importance=None
 forecasts=[];latest=numbers[-1]
 for offset in range(1,horizon+1):
  n=latest+offset;raw=predict(feature(n,values[n-1],values[n-2]));value=max(0.,raw);values[n]=value
  forecasts.append({'period':month_text(n),'value':value,'nonnegativeConstraintApplied':raw<0})
 return {'forecasts':forecasts,'trainingPairs':len(y),'trainingR2':coefficient_of_determination(y,fitted),'trainingRmse':float(np.sqrt(np.mean((y-fitted)**2))),'factorWeights':None if importance is None else [{'factor':name,'weight':importance[i]} for i,name in enumerate(['前一月捕获量','前两月捕获量','月季节正弦','月季节余弦'])]}
def forecast_capture(db_path,category='蚊',species_name=None,city=None,district=None,forecast_months=3,as_of=None,data_window=60,method_name=None,model='ar'):
 if not isinstance(forecast_months,int) or not 1<=forecast_months<=24:raise ValueError('Invalid forecast horizon')
 cutoff=cutoff_date(db_path,as_of);rows=load_capture_history(db_path,cutoff,data_window,category=category,species_name=species_name,city=city,district=district,method_name=method_name)
 if not rows:return {'status':'NO_DATA','method':'autoregression-seasonal-capture-v1' if model=='ar' else 'gradient-boosting-capture-v1','groups':[],'trend':[],'r2Score':None,'qualityFlags':[]}
 grouped=defaultdict(list)
 for row in rows:grouped[row['methodName']].append(row)
 groups=[]
 for name,history in sorted(grouped.items()):
  gap=month_number(cutoff)-month_number(history[-1]['period']);flags=['capture-count-not-standard-density']
  trained=fit_forecast(history,forecast_months+gap,model) if gap<=12 else None
  if gap>12:flags.append('monitoring-history-too-stale')
  elif gap>0:flags.append('missing-months-recursively-extrapolated')
  if trained:trained['forecasts']=[p for p in trained['forecasts'] if p['period']>cutoff[:7]]
  if any(r['effortRecords']<r['sampleCount'] for r in history):flags.append('sampling-effort-unavailable')
  if any(r['samplingUnitRatio'] is not None for r in history):flags.append('sampling-unit-semantics-not-validated')
  numbers=[month_number(r['period']) for r in history]
  if len(numbers)>1 and numbers[-1]-numbers[0]+1!=len(numbers):flags.append('gaps-in-monitoring-calendar')
  groups.append({'methodName':name,'city':city,'unit':'captures/record','status':'SUCCESS' if trained else 'INSUFFICIENT_DATA','trainingWindow':{'start':history[0]['period'],'end':history[-1]['period'],'asOf':cutoff,'periods':len(history),'sampleCount':sum(r['sampleCount'] for r in history)},'history':history,'forecasts':trained['forecasts'] if trained else [],'trainingR2':trained['trainingR2'] if trained else None,'trainingRmse':trained['trainingRmse'] if trained else None,'factorWeights':trained['factorWeights'] if trained else None,'qualityFlags':flags+([] if trained else ['insufficient-contiguous-training-pairs'])})
 status='SUCCESS' if any(g['status']=='SUCCESS' for g in groups) else 'INSUFFICIENT_DATA'
 return {'status':status,'method':'autoregression-seasonal-capture-v1' if model=='ar' else 'gradient-boosting-capture-v1','asOf':cutoff,'groups':groups,'trend':[],'r2Score':groups[0]['trainingR2'] if len(groups)==1 else None,'weatherCorrelation':{'tempCorr':None,'humidityCorr':None},'qualityFlags':['capture-count-not-standard-density','training-fit-is-not-backtest']+(['partial-method-coverage'] if any(g['status']!='SUCCESS' for g in groups) else []),'metrics':{}}
