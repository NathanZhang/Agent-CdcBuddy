"""Read-only probes. Run from repository root with .venv/bin/python."""
import sys, json, sqlite3, subprocess
from pathlib import Path
root = Path.cwd()
sys.path.insert(0, str(root/'analytics_engine'))
from population_dynamics import calculate_population_dynamics
from transmission_risk import calculate_transmission_risk
from env.water_rf_kriging import evaluate_water_health_risk
from env.sewage_lag_tracing import analyze_sewage_lag_correlation
from chronic.mortality_cluster_dbscan import detect_mortality_patterns_and_rare_clusters
from chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10
out={}
for name in ['vector_monitoring.db','foodborne_monitoring.db','env_monitoring.db','chronic_monitoring.db']:
 con=sqlite3.connect(f'file:{root/name}?mode=ro',uri=True)
 tables=[r[0] for r in con.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'")]
 out[name]={t:con.execute('select count(*) from "'+t+'"').fetchone()[0] for t in tables}
 con.close()
r=calculate_population_dynamics(str(root/'vector_monitoring.db'),city='不存在市')
out['no_data_population']=r
out['no_data_transmission']=calculate_transmission_risk(str(root/'vector_monitoring.db'),city='不存在市')
r=evaluate_water_health_risk(city='郑州市')
out['water_summary']=r['evaluationResult']
r=analyze_sewage_lag_correlation(city='不存在市')
out['no_data_sewage']={'status':r['status'],'sampleCount':r['sampleCount'],'optimalLagWindow':r['optimalLagWindow'],'sources':r['reverseTracingSources']}
a=detect_mortality_patterns_and_rare_clusters(target_city='郑州市')
b=detect_mortality_patterns_and_rare_clusters(target_city='不存在市')
out['city_filter_ignored_mortality']={'same_clusters':a['dbscanSpatialClusters']==b['dbscanSpatialClusters'],'same_trend':a['arimaMortalityTrend']==b['arimaMortalityTrend']}
out['unknown_death_chain']=infer_underlying_cause_and_icd10(input_chain={'a':'未知原因甲','b':'未知原因乙','c':'未知原因丙','d':'未知原因丁'})
from foodborne.cgmlst_cluster import calculate_cgmlst_distance
out['cgmlst_invalid_empty_distance']=calculate_cgmlst_distance([], [1,2,3])
print(json.dumps(out,ensure_ascii=False,indent=2))
