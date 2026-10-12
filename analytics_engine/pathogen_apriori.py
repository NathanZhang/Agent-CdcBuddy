"""Observed PCR record positivity and pair association support; not predictive disease risk."""
import sqlite3
from analytics_engine.repositories.datasets import connect_readonly

def pair_rules(transactions,min_count=2):
 if not transactions:return []
 n=len(transactions);counts={}
 for t in transactions:
  for item in t:counts[item]=counts.get(item,0)+1
 rules=[]
 for a,ac in sorted(counts.items()):
  if not a.startswith('物种:'):continue
  for b,bc in sorted(counts.items()):
   if not b.startswith('阳性:'):continue
   both=sum(a in t and b in t for t in transactions)
   if both>=min_count:rules.append({'antecedent':a[3:],'consequent':b[3:],'support':both/n,'confidence':both/ac,'lift':both*n/(ac*bc),'jointCount':both,'transactionCount':n})
 return sorted(rules,key=lambda r:(-r['confidence'],-r['lift'],r['antecedent'],r['consequent']))

def calculate_pathogen_risk_apriori(db_path,pathogen_name=None,species_name=None,city=None,district=None,as_of=None,from_date=None):
 where=["d.pcr_result IN ('阳性','阴性')"];params=[]
 for col,val in [('p.pathogen_name',pathogen_name),('s.species_name',species_name),('l.city',city),('l.district',district)]:
  if val is not None:where.append(col+'=?');params.append(val)
 if as_of:where.append('d.date_id<=?');params.append(as_of)
 if from_date:where.append('d.date_id>=?');params.append(from_date)
 with connect_readonly(db_path) as c:
  c.row_factory=sqlite3.Row
  rows=[dict(r) for r in c.execute(f"SELECT p.pathogen_name,s.species_name,l.city,l.district,d.pcr_result FROM fact_pathogen_detection d JOIN dim_pathogen p ON p.pathogen_id=d.pathogen_id JOIN dim_species s ON s.species_id=d.species_id JOIN dim_location l ON l.location_id=d.location_id WHERE {' AND '.join(where)} ORDER BY d.date_id",params)]
 counts={};transactions=[]
 for r in rows:
  key=(r['pathogen_name'],r['species_name'],r['city'],r['district']);t,pos=counts.get(key,(0,0));counts[key]=(t+1,pos+(r['pcr_result']=='阳性'))
  trans={'物种:'+r['species_name']}
  if r['pcr_result']=='阳性':trans.add('阳性:'+r['pathogen_name'])
  transactions.append(trans)
 items=[{'pathogenName':k[0],'speciesName':k[1],'city':k[2],'district':k[3],'testedCount':t,'positiveCount':pos,'positivityRate':100*pos/t,'riskLevel':None} for k,(t,pos) in counts.items()]
 return {'status':'SUCCESS' if rows else 'NO_DATA','method':'pcr-record-pair-association-v1','items':items,'highRiskLocations':[],'associationRules':pair_rules(transactions),'transactionCount':len(rows),'summaryAdvice':None,'qualityFlags':['pcr-record-positivity-not-individual-prevalence','pair-associations-not-causal-or-disease-risk','not-full-apriori-itemset-search']}
