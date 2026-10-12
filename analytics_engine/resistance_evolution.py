from analytics_engine.repositories.datasets import connect_readonly
import sqlite3

def calculate_resistance_evolution(db_path,species_name='淡色库蚊',pesticide_name='氯氰菊酯',city=None,district=None,as_of=None):
 clauses=['s.species_name=?','p.pesticide_name=?'];params=[species_name,pesticide_name]
 for expr,value in [('l.city',city),('l.district',district)]:
  if value is not None:clauses.append(expr+'=?');params.append(value)
 if as_of:clauses.append('r.date_id<=?');params.append(as_of)
 with connect_readonly(db_path) as c:
  rows=c.execute('SELECT substr(r.date_id,1,4),AVG(r.corrected_mortality),AVG(r.lc50),COUNT(*) FROM fact_insecticide_resistance r JOIN dim_species s ON s.species_id=r.species_id JOIN dim_pesticide p ON p.pesticide_id=r.pesticide_id JOIN dim_location l ON l.location_id=r.location_id WHERE '+' AND '.join(clauses)+' GROUP BY substr(r.date_id,1,4) ORDER BY r.date_id',params).fetchall()
 return {'status':'INSUFFICIENT_DATA' if rows else 'NO_DATA','method':'observed-bioassay-history-v1','speciesName':species_name,'pesticideName':pesticide_name,'evolutionYears':[r[0] for r in rows],'observations':[{'year':r[0],'meanCorrectedMortality':r[1],'meanLc50':r[2],'sampleCount':r[3]} for r in rows],'kdrGeneFrequency':[None for _ in rows],'resistanceRatio':[None for _ in rows],'warningAlert':None,'qualityFlags':['genotype-data-unavailable','susceptible-lc50-reference-unavailable','no-genetic-frequency-inference-from-mortality']}
