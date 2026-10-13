"""IDW interpolation of method-separated observed captures; no synthetic monitoring points."""
import sqlite3,math
import numpy as np
from analytics_engine.repositories.datasets import connect_readonly
from analytics_engine.vector_methods import cutoff_date

def idw_values(points,targets,power=2):
 if not points:return []
 if power<=0:raise ValueError('Power must be positive')
 a=np.asarray(points,dtype=float);result=[]
 for lat,lon in targets:
  # Equirectangular distance in km, local latitude adjustment.
  d=np.hypot((a[:,0]-lat)*111.195,(a[:,1]-lon)*111.195*np.cos(np.radians((a[:,0]+lat)/2)))
  exact=d<1e-9
  if np.any(exact):result.append(float(np.mean(a[exact,2])))
  else:
   w=1/d**power;result.append(float(np.sum(w*a[:,2])/np.sum(w)))
 return result

def calculate_spatial_idw(db_path,city=None,category='蚊',district=None,method_name=None,as_of=None,from_date=None,grid_size=18):
 if not isinstance(grid_size,int) or not 2<=grid_size<=50:raise ValueError('Invalid grid size')
 where=['f.capture_count>=0','f.date_id<=?','l.latitude BETWEEN -90 AND 90','l.longitude BETWEEN -180 AND 180'];params=[cutoff_date(db_path,as_of)]
 for col,val in [('l.city',city),('l.district',district),('s.category',category),('m.method_name',method_name)]:
  if val is not None:where.append(col+'=?');params.append(val)
 if from_date:where.append('f.date_id>=?');params.append(from_date)
 with connect_readonly(db_path) as c:
  c.row_factory=sqlite3.Row
  rows=[dict(r) for r in c.execute(f"SELECT l.location_id,l.city,l.district,l.street,l.latitude AS lat,l.longitude AS lon,m.method_name,AVG(f.capture_count) AS value,COUNT(*) AS samples,MIN(f.date_id) AS start,MAX(f.date_id) AS end FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id JOIN dim_species s ON f.species_id=s.species_id JOIN dim_method m ON f.method_id=m.method_id WHERE {' AND '.join(where)} GROUP BY l.location_id,m.method_name ORDER BY l.location_id,m.method_name",params)]
 if not rows:return {'status':'NO_DATA','grid':[],'monitoringPoints':[],'alerts':[]}
 methods=sorted(set(r['method_name'] for r in rows))
 if len(methods)>1:return {'status':'INSUFFICIENT_DATA','availableMethods':methods,'grid':[],'monitoringPoints':[],'alerts':[],'qualityFlags':['select-one-sampling-method']}
 pts=[(r['lat'],r['lon'],r['value']) for r in rows]
 targets=[(float(lat),float(lon)) for lat in np.linspace(min(p[0] for p in pts),max(p[0] for p in pts),grid_size) for lon in np.linspace(min(p[1] for p in pts),max(p[1] for p in pts),grid_size)]
 targets=list(dict.fromkeys(targets));values=idw_values(pts,targets)
 return {'status':'SUCCESS','method':'observed-capture-idw-v1','unit':'captures/record','methodName':methods[0],'gridMetadata':{'spacingLat':(max(p[0] for p in pts)-min(p[0] for p in pts))/(grid_size-1),'spacingLon':(max(p[1] for p in pts)-min(p[1] for p in pts))/(grid_size-1),'extent':[min(p[1] for p in pts),min(p[0] for p in pts),max(p[1] for p in pts),max(p[0] for p in pts)]},'grid':[{'lat':t[0],'lon':t[1],'value':v} for t,v in zip(targets,values)],'monitoringPoints':[{'id':r['location_id'],'city':r['city'],'district':r['district'],'street':r['street'],'lat':r['lat'],'lon':r['lon'],'value':r['value'],'sampleCount':r['samples'],'window':{'start':r['start'],'end':r['end']}} for r in rows],'alerts':[],'qualityFlags':['capture-count-not-standard-density','interpolation-not-disease-risk','no-interpolation-uncertainty-evaluation']}
