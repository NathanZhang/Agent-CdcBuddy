"""Measured PCR/capture inputs; disease transmission score unavailable without a validated model."""
from analytics_engine.repositories.datasets import connect_readonly

def calculate_transmission_risk(db_path,city=None,disease_name=None,district=None,as_of=None,from_date=None):
 with connect_readonly(db_path) as c:
  base=[];values=[]
  for col,val in [('l.city',city),('l.district',district)]:
   if val is not None:base.append(col+'=?');values.append(val)
  def clauses(table,alias):
   where=list(base);params=list(values);cols={r[1] for r in c.execute('PRAGMA table_info('+table+')')}
   for op,value in [('<=',as_of),('>=',from_date)]:
    if value:
     if 'date_id' not in cols:raise ValueError('Requested time scope unavailable')
     where.append(alias+'.date_id'+op+'?');params.append(value)
   return ' AND '.join(where) or '1=1',params,cols
  where,args,cols=clauses('fact_monitoring','f')
  rows=c.execute(f'SELECT COUNT(*),AVG(f.capture_count) FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id WHERE {where}',args).fetchone()
  if not rows[0]:return {'status':'NO_DATA','payload':None,'riskScore':None,'city':city,'qualityFlags':[]}
  captures=rows[1];capture_groups=[]
  if 'method_id' in cols:
   capture_groups=[{'methodName':r[0],'meanCapture':r[1],'sampleCount':r[2],'unit':'captures/record'} for r in c.execute(f'SELECT m.method_name,AVG(f.capture_count),COUNT(*) FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id LEFT JOIN dim_method m ON f.method_id=m.method_id WHERE {where} GROUP BY m.method_name',args)]
   if len(capture_groups)>1:captures=None
  where,args,_=clauses('fact_pathogen_detection','d')
  total,pos=c.execute(f"SELECT COUNT(*),SUM(CASE WHEN pcr_result='阳性' THEN 1 ELSE 0 END) FROM fact_pathogen_detection d JOIN dim_location l ON d.location_id=l.location_id WHERE {where} AND pcr_result IN ('阳性','阴性')",args).fetchone()
 return {'status':'INSUFFICIENT_DATA','method':'observed-transmission-inputs-v1','city':city,'diseaseName':disease_name,'riskScore':None,'riskLevel':None,'breakdown':{},'measuredAverageCapture':captures,'captureGroups':capture_groups,'pathogenPositiveRate':100*(pos or 0)/total if total else None,'pathogenTestCount':total,'pathogenPositiveCount':pos or 0,'qualityFlags':['validated-transmission-model-unavailable','population-exposure-unavailable','pcr-record-positivity-not-individual-prevalence','capture-count-not-standard-density']}
