"""Exploratory computations. Mock inputs are not evidence of epidemiological efficacy."""
from datetime import date,timedelta,datetime
from collections import defaultdict,Counter
import numpy as np
from scipy.stats import pearsonr
from sklearn.cluster import DBSCAN
from repositories.datasets import connect_readonly,resolve_dataset_path

def lag_correlations(concentration,cases,max_lag=14):
 if not 0<=max_lag<=30:raise ValueError('maxLag must be 0..30')
 result=[]
 for lag in range(max_lag+1):
  pairs=[(v,cases[k]) for d,v in concentration.items() if (k:=(date.fromisoformat(d)+timedelta(days=lag)).isoformat()) in cases and v is not None and cases[k] is not None]
  r=p=None
  if len(pairs)>=4:
   x,y=np.array(pairs,dtype=float).T
   if np.isfinite(x).all() and np.isfinite(y).all() and np.ptp(x)>0 and np.ptp(y)>0:r,p=map(float,pearsonr(x,y))
  result.append({'lagDays':lag,'pairedDates':len(pairs),'pearsonCorrelation':r,'significanceP':p})
 return result

def valid_weights(values,weights):
 y=np.asarray(values,dtype=float);w=np.asarray(weights,dtype=float)
 if not 3<=len(y)<=50 or w.shape!=(len(y),len(y)) or not np.isfinite(y).all() or not np.isfinite(w).all() or np.any(w<0) or np.any(np.diag(w)!=0) or w.sum()<=0:raise ValueError('Require 3..50 values and finite nonnegative square zero-diagonal weights')
 return y,w

def moran_statistic(values,weights):
 y,w=valid_weights(values,weights);z=y-y.mean();den=float(z@z)
 return float(len(z)/w.sum()*(z@(w@z))/den) if den else None

def coordinate_clusters(coords,eps_km=5,min_samples=2):
 points=np.asarray(coords,dtype=float)
 if not len(points):return []
 if points.shape!=(len(points),2) or not np.isfinite(points).all() or np.any(abs(points[:,0])>90) or np.any(abs(points[:,1])>180) or not 0<eps_km<=200 or not 2<=min_samples<=100:raise ValueError('Invalid coordinates or DBSCAN parameters')
 return DBSCAN(eps=eps_km/6371.0088,min_samples=min_samples,metric='haversine').fit_predict(np.radians(points)).tolist()

def scoped_rows(domain,table,date_column,db_path,city=None,district=None,from_date=None,as_of=None):
 conn=connect_readonly(db_path or resolve_dataset_path(domain));conn.row_factory=__import__('sqlite3').Row
 cutoff=as_of or conn.execute(f'SELECT MAX(substr({date_column},1,10)) FROM {table}').fetchone()[0]
 if cutoff:date.fromisoformat(cutoff)
 if from_date:date.fromisoformat(from_date)
 where=[];params=[]
 for key,val in [('city',city),('district',district)]:
  if val:where.append(f'{key}=?');params.append(val)
 if cutoff:where.append(f'substr({date_column},1,10)<=?');params.append(cutoff)
 if from_date:where.append(f'substr({date_column},1,10)>=?');params.append(from_date)
 rows=[dict(r) for r in conn.execute(f'SELECT * FROM {table}'+(' WHERE '+' AND '.join(where) if where else '')+f' ORDER BY {date_column}',params)];conn.close()
 return rows,cutoff

def sewage(city=None,pathogen='诺如病毒',db_path=None,district=None,from_date=None,as_of=None,max_lag=14):
 columns={'诺如病毒':'norovirus_copies_l','新冠病毒':'sars_cov2_copies_l','肠道病毒':'enterovirus_copies_l'}
 if pathogen not in columns:raise ValueError('Unsupported pathogen')
 rows,cutoff=scoped_rows('env','fact_sewage_monitoring','monitoring_date',db_path,city,district,from_date,as_of)
 plants=defaultdict(list)
 for r in rows:plants[r['plant_id']].append(r)
 groups=[]
 for plant,rs in plants.items():
  daily=defaultdict(list)
  for r in rs:daily[r['monitoring_date'][:10]].append(r)
  concentrations={d:float(np.mean(v)) if (v:=[r[columns[pathogen]] for r in rs if r[columns[pathogen]] is not None]) else None for d,rs in daily.items()}
  cases={d:float(np.mean(v)) if (v:=[r['sentinel_hospital_cases'] for r in rs if r['sentinel_hospital_cases'] is not None]) else None for d,rs in daily.items()}
  curves=lag_correlations(concentrations,cases,max_lag);valid=[r for r in curves if r['pearsonCorrelation'] is not None];best=max(valid,key=lambda r:r['pearsonCorrelation']) if valid else None
  groups.append({'plantId':plant,'plantName':rs[0]['plant_name'],'observedDates':len(daily),'optimalLagWindow':best,'lagCorrelationTrend':curves})
 return {'status':'NO_DATA' if not rows else 'SUCCESS' if any(g['optimalLagWindow'] for g in groups) else 'INSUFFICIENT_DATA','method':'calendar-aligned-pearson-v1','sampleCount':len(rows),'asOf':cutoff,'groups':groups,'reverseTracingSources':[],'qualityFlags':['exploratory-lag-selection-unadjusted-p','hospital-linkage-unvalidated','missing-dates-not-imputed','no-pipeline-topology-no-source-lock']}

def river(basin_name=None,db_path=None,city=None,district=None,from_date=None,as_of=None,weights=None,permutations=199,seed=42):
 rows,cutoff=scoped_rows('env','fact_river_basin_monitoring','monitoring_date',db_path,city,district,from_date,as_of)
 if basin_name:rows=[r for r in rows if r['basin_name']==basin_name]
 groups=defaultdict(list)
 for r in rows:groups[r['section_name']].append(r)
 summary=[{'sectionName':k,'sampleCount':len(rs),**{col:float(np.mean(v)) if (v:=[r[col] for r in rs if r[col] is not None]) else None for col in ['water_pb','water_cd','soil_cd','crop_pb']}} for k,rs in sorted(groups.items())]
 spatial=None
 if weights:
  keys=weights['sectionNames'];matrix=weights['matrix'];lookup={r['sectionName']:r['water_cd'] for r in summary}
  if len(set(keys))!=len(keys) or set(keys)!=set(lookup) or any(lookup[k] is None for k in keys):raise ValueError('Weights must identify every actual section once')
  if not 19<=permutations<=999:raise ValueError('permutations must be 19..999')
  y=[lookup[k] for k in keys];stat=moran_statistic(y,matrix);p=None
  if stat is not None:
   rng=np.random.default_rng(seed);expected=-1/(len(y)-1);sims=[moran_statistic(rng.permutation(y),matrix) for _ in range(permutations)];p=(1+sum(abs(s-expected)>=abs(stat-expected) for s in sims))/(permutations+1)
  spatial={'globalMoransI':stat,'permutationP':p,'permutations':permutations,'seed':seed,'weightNormalization':'none','weightSource':'user-supplied-unvalidated-topology'}
 return {'status':'NO_DATA' if not rows else 'SUCCESS' if spatial and spatial['globalMoransI'] is not None else 'INSUFFICIENT_DATA','method':'descriptive-metals-moran-v1','asOf':cutoff,'totalSamples':len(rows),'sections':summary,'spatialAutocorrelation':spatial,'qualityFlags':['no-validated-river-topology','no-causal-transfer-inference','no-health-risk-estimate']}

def window_candidates(rows,time_key,group_keys,window_days,min_size):
 groups=defaultdict(list)
 for r in rows:groups[tuple(r.get(k) for k in group_keys)].append(r)
 result=[]
 for key,rs in sorted(groups.items(),key=lambda item:str(item[0])):
  times=[datetime.fromisoformat(r[time_key]) for r in rs];left=0;best=None
  for right,t in enumerate(times):
   while t-times[left]>timedelta(days=window_days):left+=1
   if right-left+1>=min_size and (best is None or right-left+1>best['caseCount']):best={**dict(zip(group_keys,key)),'caseCount':right-left+1,'start':times[left].isoformat(),'end':t.isoformat(),'reviewRequired':True}
  if best:result.append(best)
 return result

def mortality(db_path=None,target_city=None,district=None,from_date=None,as_of=None,eps_km=5,min_samples=2):
 rows,cutoff=scoped_rows('chronic','fact_death_registry','death_date',db_path,target_city,district,from_date,as_of)
 counts=Counter((r['city'],r['district']) for r in rows);conn=connect_readonly(db_path or resolve_dataset_path('chronic'))
 points=[{'city':c,'district':d,'lat':lat,'lon':lon,'observedDeaths':counts[(c,d)]} for c,d,lat,lon in conn.execute('SELECT city,district,latitude,longitude FROM dim_districts ORDER BY city,district') if (c,d) in counts and lat is not None and lon is not None];conn.close()
 for p,label in zip(points,coordinate_clusters([[p['lat'],p['lon']] for p in points],eps_km,min_samples)):p['clusterId']=label
 rare=[r for r in rows if r.get('icd10_category')=='罕见病' or str(r.get('icd10_code','')).startswith(('A81','G12'))]
 candidates=window_candidates(rare,'death_date',['city','district','icd10_code'],14,3)
 return {'status':'SUCCESS' if rows else 'NO_DATA','method':'district-centroid-dbscan-v1','asOf':cutoff,'totalDeaths':len(rows),'observedMonthlyDeaths':[{'month':k,'deaths':v} for k,v in sorted(Counter(r['death_date'][:7] for r in rows).items())],'dbscanSpatialClusters':points,'rareMortalityClustersDetected':candidates,'rareClusterCount':len(candidates),'qualityFlags':['centroids-not-individual-death-locations','clusters-not-risk-or-causality','rare-disease-code-candidate-requires-review','no-arima-no-population-rate']}

def injury(db_path=None,city=None,district=None,from_date=None,as_of=None):
 rows,cutoff=scoped_rows('chronic','fact_injury_surveillance','injury_time',db_path,city,district,from_date,as_of)
 def stats(key):return [{key:k,'caseCount':v,'percentage':v/len(rows)*100} for k,v in Counter(r[key] for r in rows).most_common()] if rows else []
 return {'status':'SUCCESS' if rows else 'NO_DATA','method':'injury-observed-counts-v1','asOf':cutoff,'totalInjuriesMonitored':len(rows),'injuryTypeComposition':stats('injury_type'),'recordedCauseComposition':stats('injury_cause_factor'),'clusterIncidentsDetected':window_candidates(rows,'injury_time',['city','district','injury_place','injury_type'],1,5),'decisionTreeAttribution':None,'qualityFlags':['recorded-causes-not-causal-estimates','no-trained-decision-tree','24-hour-candidates-require-review']}

def unavailable(method):return {'status':'FAILED','method':method,'payload':None,'error':{'code':'CAPABILITY_UNAVAILABLE','message':'Required implementation, training or validation data unavailable','retryable':False}}
