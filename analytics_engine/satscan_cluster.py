"""Circular conditional-Poisson scan using actual record exposure; not full SaTScan."""
import math,sqlite3,numpy as np
from analytics_engine.repositories.datasets import connect_readonly

def haversine_distance_km(lat1,lon1,lat2,lon2):
 dlat,dlon=map(math.radians,[lat2-lat1,lon2-lon1]);a=math.sin(dlat/2)**2+math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
 return 6371*2*math.atan2(math.sqrt(a),math.sqrt(max(0.,1-a)))
def calculate_satscan_spatial_clusters(db_path,year=2022,month=3,category='蚊',max_cluster_radius_km=120.,p_threshold=.05,num_simulations=99,seed=42,method_name=None,city=None,district=None):
 if not 1<=month<=12 or not 1<=num_simulations<=999 or not 0<=p_threshold<=1 or not 0<max_cluster_radius_km<=500:raise ValueError('Invalid scan parameters')
 period=f'{year:04d}-{month:02d}';where=['substr(f.date_id,1,7)=?','s.category=?','f.capture_count>=0'];params=[period,category]
 for expr,value in [('m.method_name',method_name),('l.city',city),('l.district',district)]:
  if value is not None:where.append(expr+'=?');params.append(value)
 with connect_readonly(db_path) as c:
  c.row_factory=sqlite3.Row
  rows=[dict(r) for r in c.execute('SELECT l.location_id,l.city,l.district,l.latitude AS lat,l.longitude AS lon,m.method_name,SUM(f.capture_count) AS observed_count,COUNT(*) AS sample_records,AVG(f.weather_temp) AS avg_temp,AVG(f.weather_humidity) AS avg_humidity FROM fact_monitoring f JOIN dim_location l ON l.location_id=f.location_id JOIN dim_species s ON s.species_id=f.species_id LEFT JOIN dim_method m ON m.method_id=f.method_id WHERE '+' AND '.join(where)+' GROUP BY l.location_id,m.method_name ORDER BY l.location_id,m.method_name',params)]
 flags=['approximate-circular-scan-not-full-satscan','record-exposure-not-standard-sampling-effort'];base={'method':'conditional-poisson-circular-scan-v1','period':period,'clusters':[],'high_risk_cities':[],'qualityFlags':flags,'statistics':{'total_monitoring_sites':len(rows),'total_observed_captures':sum(r['observed_count'] for r in rows)}}
 if not rows:return {'status':'NO_DATA',**base,'success':False}
 methods=sorted({r['method_name'] or '未登记方法' for r in rows});base['availableMethods']=methods
 if len(methods)>1:return {'status':'INSUFFICIENT_DATA',**base,'message':'请选择单一采样方法，不能将不同方法的捕获计数用于同一空间扫描','success':False}
 rows=[r for r in rows if r['lat'] is not None and r['lon'] is not None]
 if len(rows)<3 or sum(r['observed_count'] for r in rows)<=0:return {'status':'INSUFFICIENT_DATA',**base,'success':False,'message':'至少需要3个有坐标的监测点和正捕获总数'}
 counts=np.array([r['observed_count'] for r in rows],dtype=float);total=float(counts.sum());exposure=np.array([r['sample_records'] for r in rows],dtype=float);prob=exposure/exposure.sum();expected=total*prob;windows=[];seen=set()
 for i,center in enumerate(rows):
  distances=np.array([haversine_distance_km(center['lat'],center['lon'],r['lat'],r['lon']) for r in rows])
  for radius in sorted(set(distances[distances<=max_cluster_radius_km])):
   indices=tuple(np.flatnonzero(distances<=radius));e=float(expected[list(indices)].sum())
   if indices in seen or e>=total*.5 or e<=0:continue
   seen.add(indices);windows.append((i,float(radius),indices,e))
 def llr(c,e):
  if c<=e:return 0.
  return (c*math.log(c/e) if c else 0.)+((total-c)*math.log((total-c)/(total-e)) if total>c else 0.)
 scored=[(llr(float(counts[list(ix)].sum()),e),i,radius,ix,e) for i,radius,ix,e in windows];rng=np.random.default_rng(seed)
 maxima=[]
 for _ in range(num_simulations):
  simulated=rng.multinomial(int(round(total)),prob);maxima.append(max([llr(float(simulated[list(ix)].sum()),e) for _,_,ix,e in windows],default=0.))
 covered=set();clusters=[]
 for score,i,radius,ix,e in sorted(scored,reverse=True):
  p=(1+sum(v>=score for v in maxima))/(num_simulations+1)
  if score<=0 or p>p_threshold or covered.intersection(ix):continue
  c=float(counts[list(ix)].sum());outside=(total-c)/(total-e);rr=(c/e)/outside if outside>0 else None;members=[rows[j] for j in ix];center=rows[i]
  clusters.append({'cluster_id':f'{period}-cluster-{len(clusters)+1}','center_city':center['city'],'center_district':center['district'],'center_coord':[center['lon'],center['lat']],'radius_km':radius,'observed_count':c,'expected_count':e,'log_likelihood_ratio':score,'relative_risk':rr,'p_value':p,'is_statistically_significant':True,'affected_cities':sorted({m['city'] for m in members}),'affected_districts':sorted({m['district'] for m in members}),'member_locations':members});covered.update(ix)
 return {'status':'SUCCESS',**base,'success':True,'clusters':clusters,'high_risk_cities':sorted({city for c in clusters for city in c['affected_cities']}),'statistics':{**base['statistics'],'candidateWindows':len(windows),'simulations':num_simulations,'seed':seed}}
def run_satscan_spatial_standalone(db_path,**kwargs):return calculate_satscan_spatial_clusters(db_path,**kwargs)
