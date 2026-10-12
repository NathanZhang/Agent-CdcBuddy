from analytics_engine.repositories.datasets import connect_readonly
import sqlite3

def calculate_resistance_prediction(db_path,species_name=None,pesticide_name=None,city=None,district=None,as_of=None):
 where=['1=1'];params=[]
 for expr,value in [('s.species_name',species_name),('p.pesticide_name',pesticide_name),('l.city',city),('l.district',district)]:
  if value is not None:where.append(expr+'=?');params.append(value)
 if as_of:where.append('r.date_id<=?');params.append(as_of)
 with connect_readonly(db_path) as c:
  c.row_factory=sqlite3.Row
  rows=[dict(r) for r in c.execute('SELECT s.species_name,p.pesticide_name,l.city,r.date_id,r.resistance_level,r.lc50,r.corrected_mortality FROM fact_insecticide_resistance r JOIN dim_species s ON s.species_id=r.species_id JOIN dim_pesticide p ON p.pesticide_id=r.pesticide_id JOIN dim_location l ON l.location_id=r.location_id WHERE '+' AND '.join(where)+' ORDER BY r.date_id DESC LIMIT 100',params)]
 items=[{'speciesName':r['species_name'],'pesticideName':r['pesticide_name'],'city':r['city'],'resistanceLevel':r['resistance_level'],'predictionConfidence':None,'lc50':r['lc50'],'correctedMortality':r['corrected_mortality'],'date':r['date_id'],'sampleYear':int(r['date_id'][:4]),'guidelineRecommendation':None} for r in rows]
 return {'status':'SUCCESS' if rows else 'NO_DATA','method':'observed-bioassay-records-v1','items':items,'rotationSuggestions':[],'qualityFlags':['recorded-classification-not-ml-prediction','no-validated-rotation-recommendation']}
