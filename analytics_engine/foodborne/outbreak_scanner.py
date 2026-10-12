from analytics_engine.mock_methods import scoped_rows,window_candidates
def scan_outbreak_clusters(db_path,city=None,district=None,window_days=14,min_cluster_size=3,from_date=None,as_of=None):
 if not 1<=window_days<=30 or not 2<=min_cluster_size<=100:raise ValueError('Invalid scan parameters')
 rows,cutoff=scoped_rows('foodborne','fact_foodborne_case','visit_date',db_path,city,district,from_date,as_of)
 candidates=window_candidates(rows,'visit_date',['city','district','dining_place_type','suspected_food','pathogen_id'],window_days,min_cluster_size)
 return {'status':'SUCCESS' if rows else 'NO_DATA','method':'food-exposure-window-candidates-v1','asOf':cutoff,'totalCases':len(rows),'dynamicClusters':candidates,'qualityFlags':['place-type-not-venue-identity','candidate-not-confirmed-outbreak','no-satscan-or-relative-risk-baseline']}
