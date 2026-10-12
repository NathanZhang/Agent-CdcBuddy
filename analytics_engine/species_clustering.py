"""Observed composition and exploratory capture/geography K-Means; no risk label inference."""
import sqlite3,math
import numpy as np
from analytics_engine.repositories.datasets import connect_readonly
from analytics_engine.vector_methods import cutoff_date

def cluster_features(features,seed=42):
 if not features:return {'labels':[],'clusterCount':0}
 X=np.asarray(features,dtype=float)
 if not np.isfinite(X).all():raise ValueError('Nonfinite feature')
 scale=X.std(axis=0);scale[scale==0]=1;Z=(X-X.mean(axis=0))/scale
 k=min(3,len(np.unique(Z,axis=0)))
 if k==1:return {'labels':[0]*len(X),'clusterCount':1}
 from sklearn.cluster import KMeans
 labels=KMeans(n_clusters=k,n_init=10,random_state=seed).fit_predict(Z)
 return {'labels':[int(v) for v in labels],'clusterCount':k}

def calculate_species_clustering(db_path,category='蚊',city=None,year=None,method_name=None,district=None,as_of=None,seed=42):
 where=['f.capture_count>=0','f.date_id<=?'];params=[cutoff_date(db_path,as_of)]
 for col,val in [('s.category',category),('l.city',city),('l.district',district),('m.method_name',method_name)]:
  if val is not None:where.append(col+'=?');params.append(val)
 if year is not None:where.append('substr(f.date_id,1,4)=?');params.append(str(year))
 with connect_readonly(db_path) as c:
  c.row_factory=sqlite3.Row
  rows=[dict(r) for r in c.execute(f"SELECT s.species_name,s.latin_name,s.category,l.city,l.district,l.latitude AS lat,l.longitude AS lon,m.method_name,SUM(f.capture_count) AS total,AVG(f.capture_count) AS mean,COUNT(*) AS samples FROM fact_monitoring f JOIN dim_location l ON f.location_id=l.location_id JOIN dim_species s ON f.species_id=s.species_id LEFT JOIN dim_method m ON f.method_id=m.method_id WHERE {' AND '.join(where)} GROUP BY s.species_name,s.latin_name,s.category,l.city,l.district,l.latitude,l.longitude,m.method_name ORDER BY s.species_name,l.city,l.district,m.method_name",params)]
 total=sum(r['total'] for r in rows);species={}
 for r in rows:
  entry=species.setdefault(r['species_name'],{'speciesName':r['species_name'],'latinName':r['latin_name'],'category':r['category'],'totalCount':0,'cityBreakdown':{}});entry['totalCount']+=r['total'];entry['cityBreakdown'][r['city']]=entry['cityBreakdown'].get(r['city'],0)+r['total']
 items=[];h=0
 for entry in sorted(species.values(),key=lambda r:-r['totalCount']):
  p=entry['totalCount']/total if total else 0;h-=p*math.log(p) if p else 0;entry['percentage']=p*100 if total else None;entry['cityBreakdown']=[{'city':city,'count':count} for city,count in entry['cityBreakdown'].items()];items.append(entry)
 clusters=[]
 for method in sorted(set(r['method_name'] or '未登记方法' for r in rows)):
  valid=[r for r in rows if (r['method_name'] or '未登记方法')==method and r['lat'] is not None and r['lon'] is not None]
  result=cluster_features([[r['mean'],r['lat'],r['lon']] for r in valid],seed)
  for label in range(result['clusterCount']):
   group=[r for r,l in zip(valid,result['labels']) if l==label]
   clusters.append({'clusterId':label+1,'clusterName':f'探索性聚类 {label+1}','methodName':method,'samplePointCount':len(group),'coveredCities':sorted(set(r['city'] for r in group)),'meanCapture':sum(r['mean'] for r in group)/len(group),'unit':'captures/record','members':[{'city':r['city'],'district':r['district'],'speciesName':r['species_name']} for r in group]})
 return {'status':'SUCCESS' if total else 'INSUFFICIENT_DATA' if rows else 'NO_DATA','method':'method-separated-kmeans-capture-v1','items':items,'dominantSpecies':items[0]['speciesName'] if items and total else None,'shannonWienerIndex':h if total else None,'clusters':clusters,'qualityFlags':['capture-count-not-standard-density','exploratory-clusters-not-risk-classes']}
