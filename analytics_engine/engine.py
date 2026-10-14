import sys
import os
import json
import argparse

# 确保直接 CLI 与包调用使用同一导入路径
sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from population_dynamics import calculate_population_dynamics
from species_clustering import calculate_species_clustering
from resistance_ml import calculate_resistance_prediction
from pathogen_apriori import calculate_pathogen_risk_apriori
from density_gbdt import calculate_gbdt_density_forecast
from spatial_interpolation import calculate_spatial_idw
from transmission_risk import calculate_transmission_risk
from resistance_evolution import calculate_resistance_evolution
from satscan_cluster import calculate_satscan_spatial_clusters
from lstm_predictor import calculate_lstm_short_term_forecast

from analytics_engine.repositories.datasets import resolve_dataset_path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,ROOT)
with open(os.path.join(ROOT,'config/analytics-tasks.json')) as definition_file:
    TASK_DOMAINS = json.load(definition_file)

from analytics_engine.contracts.task import parse_task_args,json_value,task_result,DatasetRef
from analytics_engine.repositories.datasets import resolve_dataset_ref
from analytics_engine.graphs.registry import GRAPH_TASKS,invoke_graph
import contextlib

def execute_task(task,args,db_path):
    result = {}
    if task.endswith('_assessment'):
        from analytics_engine.assessments import execute
        return execute(TASK_DOMAINS[task], db_path, args)
    if task in GRAPH_TASKS:
        return invoke_graph(task,db_path,args,os.environ.get("APP_BUSINESS_DB_PATH") or os.path.join(ROOT,"app_business.db"))
    if task in ('population_dynamics','density_gbdt'):
        func=calculate_population_dynamics if task=='population_dynamics' else calculate_gbdt_density_forecast
        result=func(db_path=db_path,category=args.get('category','蚊'),city=args.get('city'),district=args.get('district'),as_of=args.get('asOf'),method_name=args.get('methodName'),data_window=int(args.get('dataWindow',60)),forecast_months=int(args.get('forecastMonths',3 if task=='population_dynamics' else 2)),species_name=args.get('speciesName'))
    elif task=='species_clustering':
        result=calculate_species_clustering(db_path,category=args.get('category','蚊'),city=args.get('city'),district=args.get('district'),as_of=args.get('asOf'),method_name=args.get('methodName'),year=args.get('year'))
    elif task=='resistance_prediction':
        result=calculate_resistance_prediction(db_path,species_name=args.get('speciesName'),pesticide_name=args.get('pesticideName'),city=args.get('city'),district=args.get('district'),as_of=args.get('asOf'))
    elif task=='pathogen_apriori':
        result=calculate_pathogen_risk_apriori(db_path,pathogen_name=args.get('pathogenName'),species_name=args.get('speciesName'),city=args.get('city'),district=args.get('district'),as_of=args.get('asOf'),from_date=args.get('from'))
    elif task=='spatial_idw':
        result=calculate_spatial_idw(db_path,city=args.get('city'),district=args.get('district'),category=args.get('category','蚊'),as_of=args.get('asOf'),from_date=args.get('from'),method_name=args.get('methodName'))
    elif task=='transmission_risk':
        result=calculate_transmission_risk(db_path,city=args.get('city'),district=args.get('district'),disease_name=args.get('diseaseName'),as_of=args.get('asOf'),from_date=args.get('from'))
    elif task=='resistance_evolution':
        result=calculate_resistance_evolution(db_path,species_name=args.get('speciesName'),pesticide_name=args.get('pesticideName'),city=args.get('city'),district=args.get('district'),as_of=args.get('asOf'))
    elif task in ('satscan_cluster','satscan_spatial','satscan_spatial_standalone'):
        result=calculate_satscan_spatial_clusters(db_path,year=int(args.get('year',2022)),month=int(args.get('month',3)),category=args.get('category','蚊'),city=args.get('city'),district=args.get('district'),method_name=args.get('methodName'),seed=int(args.get('seed',42)),num_simulations=int(args.get('numSimulations',99)),max_cluster_radius_km=float(args.get('maxClusterRadiusKm',120)),p_threshold=float(args.get('pThreshold',.05)))
    elif task in ('lstm_predictor','lstm_forecast','lstm_predictor_standalone'):
        result=calculate_lstm_short_term_forecast(db_path)
    elif task=='vector_backtest':
        from analytics_engine.vector_backtest import evaluate_vector_forecast
        result=evaluate_vector_forecast('vector-monitoring',args['asOf'],int(args.get('horizon',1)),db_path=db_path,city=args.get('city'),district=args.get('district'),method_name=args.get('methodName'),data_window=int(args.get('dataWindow',60)),model=args.get('model','ar'))
    elif task in ["foodborne_cluster_detect", "foodborne_clusters"]:
        from foodborne.outbreak_scanner import scan_outbreak_clusters
        fb_db = db_path
        result = scan_outbreak_clusters(
            db_path=fb_db,
            city=args.get("city"),
            district=args.get("district"),from_date=args.get("from"),as_of=args.get("asOf")
        )
    elif task in ["molecular_trace", "cgmlst_clustering"]:
        from foodborne.cgmlst_cluster import calculate_cgmlst_clustering
        fb_db = db_path
        result = calculate_cgmlst_clustering(
            db_path=fb_db,
            pathogen_id=args.get("pathogenId"),
            cluster_id=args.get("clusterId"),
            threshold=int(args.get("threshold", 5)),sample_limit=int(args.get("sampleLimit",40)),city=args.get("city"),district=args.get("district"),from_date=args.get("from"),as_of=args.get("asOf")
        )
    elif task in ["food_attribution", "food_risk_ranking"]:
        from foodborne.food_attribution import calculate_food_attribution
        fb_db = db_path
        result = calculate_food_attribution(
            db_path=fb_db,
            city=args.get("city"),
            top_n=int(args.get("topN", 10)),district=args.get("district"),from_date=args.get("from"),as_of=args.get("asOf")
        )
    elif task in ["foodborne_risk_forecast", "foodborne_forecast"]:
        from foodborne.risk_forecast import calculate_foodborne_risk_forecast
        fb_db = db_path
        result = calculate_foodborne_risk_forecast(
            db_path=fb_db,
            city=args.get("city"),
            pathogen=args.get("pathogenType") or args.get("speciesName") or args.get("pathogen"),
            forecast_months=int(args.get("forecastMonths", 3))
        )
    # =========================================================================
    # 环境健康风险监测预警计算任务 (Environmental Health Tasks)
    # =========================================================================
    elif task in ["water_safety_eval", "water_health_risk"]:
        from env.water_rf_kriging import evaluate_water_health_risk
        result = evaluate_water_health_risk(city=args.get("city"), district=args.get("district"), db_path=db_path,from_date=args.get("from"),as_of=args.get("asOf"))
    elif task in ["sewage_lag_tracing", "sewage_pathogen_trace"]:
        from env.sewage_lag_tracing import analyze_sewage_lag_correlation
        result = analyze_sewage_lag_correlation(city=args.get("city"), pathogen=args.get("pathogen", "诺如病毒"), db_path=db_path,district=args.get("district"),from_date=args.get("from"),as_of=args.get("asOf"),max_lag=int(args.get("maxLag",14)))
    elif task in ["air_climate_health_risk", "air_dlnm_eval"]:
        from env.air_climate_dlnm import evaluate_air_climate_health_risk
        result = evaluate_air_climate_health_risk(city=args.get("city", "焦作市"), db_path=db_path)
    elif task in ["river_basin_pollution_chain", "river_heavy_metal"]:
        from env.river_chain_autocorr import analyze_river_basin_pollution_chain
        result = analyze_river_basin_pollution_chain(basin_name=args.get("basinName"), db_path=db_path,city=args.get("city"),district=args.get("district"),from_date=args.get("from"),as_of=args.get("asOf"),weights=args.get("weights"),permutations=int(args.get("permutations",199)),seed=int(args.get("seed",42)))
    elif task in ["env_scenario_simulation", "env_policy_sim"]:
        from env.scenario_simulation import simulate_environmental_scenario
        result = simulate_environmental_scenario(
            scenario_type=args.get("scenarioType", "industrial_emission_cut"),
            reduction_percentage=float(args.get("reductionPercentage", 30.0)),
            target_area=args.get("targetArea", "焦作市中站区工业集聚区")
        )
    # =========================================================================
    # 死因、慢病及伤害综合监测预警计算任务 (Chronic & Injury Tasks)
    # =========================================================================
    elif task in ["death_cert_qc", "death_quality_check"]:
        from chronic.death_cert_qc import validate_death_certificate_quality
        result = validate_death_certificate_quality(db_path=db_path, city=args.get("city"),district=args.get("district"),from_date=args.get("from"),as_of=args.get("asOf"))
    elif task in ["icd10_nlp_inference", "icd10_inference"]:
        from chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10
        result = infer_underlying_cause_and_icd10(db_path=db_path, cert_id=args.get("certId"), input_chain=args.get("inputChain"), mode=args.get("mode", "dictionary"), text=args.get("text"), demographics=args.get("demographics"), entry_mode=args.get("entryMode", "text"))
    elif task in ["mortality_cluster_dbscan", "mortality_cluster_rare"]:
        from chronic.mortality_cluster_dbscan import detect_mortality_patterns_and_rare_clusters
        result = detect_mortality_patterns_and_rare_clusters(db_path=db_path, target_city=args.get("city"),district=args.get("district"),from_date=args.get("from"),as_of=args.get("asOf"),eps_km=float(args.get("epsKm",5)),min_samples=int(args.get("minSamples",2)))
    elif task in ["chronic_risk_forecast", "chronic_risk_gbdt"]:
        from chronic.chronic_risk_gbdt import predict_chronic_risk_and_complications
        result = predict_chronic_risk_and_complications(db_path=db_path, city=args.get("city"), target_disease=args.get("targetDisease"))
    elif task in ["injury_attribution_tree", "injury_tree_attribution"]:
        from chronic.injury_tree_attribution import analyze_injury_clusters_and_attribution
        result = analyze_injury_clusters_and_attribution(db_path=db_path, city=args.get("city"),district=args.get("district"),from_date=args.get("from"),as_of=args.get("asOf"))
    elif task in ["chronic_screening_roi", "chronic_death_report", "lifetable_4q70_roi"]:
        from chronic.lifetable_4q70_roi import calculate_lifetable_4q70_and_screening_roi
        result = calculate_lifetable_4q70_and_screening_roi(db_path=db_path, city=args.get("city"))
    else:
        result = {"error": f"Unknown task: {task}"}

    return result

def main():
    parser=argparse.ArgumentParser(description="CdcBuddy Scientific Analytics")
    parser.add_argument('--task',required=True);parser.add_argument('--args',default='{}');parser.add_argument('--db');parser.add_argument('--domain',choices=['vector','foodborne','env','chronic']);parser.add_argument('--dataset-id');parser.add_argument('--dataset-ref');parser.add_argument('--protocol',choices=['skill-result-v1']);parser.add_argument('--run-id')
    parsed=parser.parse_args()
    if parsed.task not in TASK_DOMAINS:parser.error('Unknown task')
    domain=TASK_DOMAINS[parsed.task]
    if parsed.domain and parsed.domain!=domain:parser.error('Task domain mismatch')
    try:args=parse_task_args(parsed.args)
    except ValueError as error:parser.error(str(error))
    from analytics_engine.repositories.scoped import ACTIVE_SCOPE
    if args.get('approvedScope') is not None:
        if args['approvedScope'].get('domain')!=domain:parser.error('Scope domain mismatch')
        ACTIVE_SCOPE.set(args['approvedScope'])
    db_path=parsed.db or str(resolve_dataset_path(domain,parsed.dataset_id))
    from analytics_engine.mock_lifecycle import assert_read_allowed,dataset_lease
    assert_read_allowed(db_path)
    if parsed.protocol:
        if not parsed.run_id:parser.error('Protocol requires run ID')
        try:
            ref=DatasetRef.model_validate(json.loads(parsed.dataset_ref)) if parsed.dataset_ref else resolve_dataset_ref(domain,parsed.dataset_id)
            if ref.domain!=domain or parsed.dataset_id and ref.id!=parsed.dataset_id:raise ValueError('Dataset identity mismatch')
            if ref.model_dump()!=resolve_dataset_ref(domain,parsed.dataset_id).model_dump():raise ValueError('Dataset metadata mismatch')
        except Exception as error:parser.error(str(error))
        try:
            with dataset_lease(db_path),contextlib.redirect_stdout(sys.stderr):payload=execute_task(parsed.task,args,db_path)
            result=task_result(parsed.run_id,domain,parsed.task,ref.model_dump(),payload)
        except Exception as error:
            result=task_result(parsed.run_id,domain,parsed.task,ref.model_dump(),error=str(error))
        print(json.dumps(result,ensure_ascii=False,allow_nan=False))
    else:
        with dataset_lease(db_path),contextlib.redirect_stdout(sys.stderr):result=execute_task(parsed.task,args,db_path)
        print(json.dumps(json_value(result),ensure_ascii=False,allow_nan=False))

if __name__=='__main__':main()
