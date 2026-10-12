from analytics_engine.mock_methods import scoped_rows
from collections import defaultdict
def calculate_food_attribution(db_path,city=None,pathogen_name=None,top_n=10,district=None,from_date=None,as_of=None):
 if pathogen_name:raise ValueError('Pathogen-name linkage unavailable; use scoped case queries')
 if not 1<=top_n<=100:raise ValueError('Invalid topN')
 rows,cutoff=scoped_rows('foodborne','fact_foodborne_case','visit_date',db_path,city,district,from_date,as_of);groups=defaultdict(list)
 for r in rows:groups[r['suspected_food']].append(r)
 ranking=[{'foodName':k,'caseCount':len(rs),'positiveCases':sum(r['is_pathogen_positive']==1 for r in rs),'testedStatusKnownCount':sum(r['is_pathogen_positive'] in (0,1) for r in rs),'positiveRate':sum(r['is_pathogen_positive']==1 for r in rs)/sum(r['is_pathogen_positive'] in (0,1) for r in rs)*100 if any(r['is_pathogen_positive'] in (0,1) for r in rs) else None} for k,rs in sorted(groups.items(),key=lambda item:(-len(item[1]),str(item[0])))][:top_n]
 return {'status':'SUCCESS' if rows else 'NO_DATA','method':'recorded-food-case-summary-v1','asOf':cutoff,'totalCases':len(rows),'foodRiskRanking':ranking,'oddsRatio':None,'attributableRiskPercent':None,'qualityFlags':['no-unexposed-controls-no-causal-attribution','reported-food-not-confirmed-source']}
