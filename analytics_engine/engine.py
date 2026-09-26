import sys
import os
import json
import argparse

# 确保导入同目录模块
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
from satscan_lstm_pipeline import run_satscan_kmeans_lstm_pipeline
from daemon_surveillance import run_daemon_surveillance_cycle

candidate_paths = [
    os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../vector_monitoring.db")),
    "/Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy/vector_monitoring.db",
    os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Agent-CdcBuddy-DataMock/vector_monitoring.db")),
    "/Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy-DataMock/vector_monitoring.db"
]
DEFAULT_DATASET_PATH = candidate_paths[0]
for p in candidate_paths:
    if os.path.exists(p) and os.access(p, os.R_OK):
        DEFAULT_DATASET_PATH = p
        break

def main():
    parser = argparse.ArgumentParser(description="CDC Vector Monitoring Scientific Analytics Engine")
    parser.add_argument("--task", required=True, help="Task name")
    parser.add_argument("--args", default="{}", help="JSON string arguments")
    parser.add_argument("--db", default=DEFAULT_DATASET_PATH, help="Path to vector_monitoring.db")

    parsed = parser.parse_args()
    task = parsed.task
    try:
        args = json.loads(parsed.args)
    except Exception:
        args = {}
    db_path = parsed.db

    result = {}
    if task == "population_dynamics":
        result = calculate_population_dynamics(
            db_path=db_path,
            category=args.get("category", "蚊"),
            species_name=args.get("speciesName"),
            city=args.get("city"),
            forecast_months=int(args.get("forecastMonths", 3))
        )
    elif task == "species_clustering":
        result = calculate_species_clustering(
            db_path=db_path,
            category=args.get("category", "蚊"),
            city=args.get("city"),
            year=args.get("year")
        )
    elif task == "resistance_prediction":
        result = calculate_resistance_prediction(
            db_path=db_path,
            species_name=args.get("speciesName"),
            pesticide_name=args.get("pesticideName"),
            city=args.get("city")
        )
    elif task == "pathogen_apriori":
        result = calculate_pathogen_risk_apriori(
            db_path=db_path,
            pathogen_name=args.get("pathogenName"),
            species_name=args.get("speciesName"),
            city=args.get("city")
        )
    elif task == "density_gbdt":
        result = calculate_gbdt_density_forecast(
            db_path=db_path,
            category=args.get("category", "蚊"),
            city=args.get("city"),
            forecast_months=int(args.get("forecastMonths", 2))
        )
    elif task == "spatial_idw":
        result = calculate_spatial_idw(
            db_path=db_path,
            city=args.get("city"),
            category=args.get("category", "蚊"),
            district=args.get("district")
        )
    elif task == "transmission_risk":
        result = calculate_transmission_risk(
            db_path=db_path,
            city=args.get("city", "郑州市"),
            disease_name=args.get("diseaseName", "登革热 (Dengue Fever)")
        )
    elif task == "resistance_evolution":
        result = calculate_resistance_evolution(
            db_path=db_path,
            species_name=args.get("speciesName", "淡色库蚊"),
            pesticide_name=args.get("pesticideName", "氯氰菊酯")
        )
    elif task == "satscan_cluster":
        result = calculate_satscan_spatial_clusters(
            db_path=db_path,
            year=int(args.get("year", 2022)),
            month=int(args.get("month", 3)),
            category=args.get("category", "蚊"),
            max_cluster_radius_km=float(args.get("maxClusterRadiusKm", 120.0)),
            p_threshold=float(args.get("pThreshold", 0.05))
        )
    elif task == "lstm_predictor":
        result = calculate_lstm_short_term_forecast(
            db_path=db_path,
            target_cities=args.get("targetCities"),
            category=args.get("category", "蚊"),
            forecast_days=int(args.get("forecastDays", 7)),
            start_date_str=args.get("startDateStr", "2022-04-01")
        )
    elif task in ["satscan_cluster", "satscan_spatial", "satscan_spatial_standalone"]:
        from satscan_cluster import run_satscan_spatial_standalone
        result = run_satscan_spatial_standalone(
            db_path=db_path,
            year=int(args.get("year", 2022)),
            month=int(args.get("month", 6)),
            category=args.get("category", "蚊"),
            max_cluster_radius_km=float(args.get("maxRadiusKm", 120.0)),
            p_threshold=float(args.get("pThreshold", 0.05))
        )
    elif task in ["lstm_predictor", "lstm_forecast", "lstm_predictor_standalone"]:
        from lstm_predictor import run_lstm_predictor_standalone
        result = run_lstm_predictor_standalone(
            db_path=db_path,
            target_cities=args.get("targetCities"),
            city=args.get("city"),
            category=args.get("category", "蚊"),
            forecast_days=int(args.get("forecastDays", 7)),
            start_date_str=args.get("startDateStr", "2022-06-01")
        )
    elif task == "satscan_kmeans_lstm_pipeline":
        result = run_satscan_kmeans_lstm_pipeline(
            db_path=db_path,
            year=int(args.get("year", 2022)),
            month=int(args.get("month", 3)),
            category=args.get("category", "蚊"),
            forecast_days=int(args.get("forecastDays", 7)),
            p_threshold=float(args.get("pThreshold", 0.05))
        )
    elif task in ["composable_workflow", "dynamic_workflow"]:
        from composable_workflow import run_dynamic_composable_workflow
        result = run_dynamic_composable_workflow(
            db_path=db_path,
            workflow_name=args.get("workflowName", "多技能动态协同工作流"),
            steps=args.get("steps", []),
            initial_context=args.get("initialContext", {})
        )
    elif task in ["daemon_surveillance", "daemon_surveillance_cycle"]:
        biz_db = os.environ.get("APP_BUSINESS_DB_PATH") or os.path.abspath(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "../app_business.db")
        )
        result = run_daemon_surveillance_cycle(
            monitoring_db_path=db_path,
            business_db_path=args.get("businessDbPath", biz_db),
            prompt_policy=args.get("promptPolicy") or args.get("prompt_policy"),
            trigger_source=args.get("triggerSource") or args.get("trigger_source", "timer_scheduled")
        )
    elif task in ["foodborne_cluster_detect", "foodborne_clusters"]:
        from foodborne.outbreak_scanner import scan_outbreak_clusters
        fb_db = db_path
        if "vector_monitoring.db" in fb_db:
            fb_db = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../foodborne_monitoring.db"))
        result = scan_outbreak_clusters(
            db_path=fb_db,
            city=args.get("city"),
            district=args.get("district")
        )
    elif task in ["molecular_trace", "cgmlst_clustering"]:
        from foodborne.cgmlst_cluster import calculate_cgmlst_clustering
        fb_db = db_path
        if "vector_monitoring.db" in fb_db:
            fb_db = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../foodborne_monitoring.db"))
        result = calculate_cgmlst_clustering(
            db_path=fb_db,
            pathogen_id=args.get("pathogenId"),
            cluster_id=args.get("clusterId"),
            threshold=int(args.get("threshold", 5))
        )
    elif task in ["food_attribution", "food_risk_ranking"]:
        from foodborne.food_attribution import calculate_food_attribution
        fb_db = db_path
        if "vector_monitoring.db" in fb_db:
            fb_db = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../foodborne_monitoring.db"))
        result = calculate_food_attribution(
            db_path=fb_db,
            city=args.get("city"),
            top_n=int(args.get("topN", 10))
        )
    elif task in ["foodborne_risk_forecast", "foodborne_forecast"]:
        from foodborne.risk_forecast import calculate_foodborne_risk_forecast
        fb_db = db_path
        if "vector_monitoring.db" in fb_db:
            fb_db = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../foodborne_monitoring.db"))
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
        result = evaluate_water_health_risk(city=args.get("city"), district=args.get("district"))
    elif task in ["sewage_lag_tracing", "sewage_pathogen_trace"]:
        from env.sewage_lag_tracing import analyze_sewage_lag_correlation
        result = analyze_sewage_lag_correlation(city=args.get("city", "郑州市"), pathogen=args.get("pathogen", "诺如病毒"))
    elif task in ["air_climate_health_risk", "air_dlnm_eval"]:
        from env.air_climate_dlnm import evaluate_air_climate_health_risk
        result = evaluate_air_climate_health_risk(city=args.get("city", "焦作市"))
    elif task in ["river_basin_pollution_chain", "river_heavy_metal"]:
        from env.river_chain_autocorr import analyze_river_basin_pollution_chain
        result = analyze_river_basin_pollution_chain(basin_name=args.get("basinName", "黄河流域河南段"))
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
        result = validate_death_certificate_quality(city=args.get("city"))
    elif task in ["icd10_nlp_inference", "icd10_inference"]:
        from chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10
        result = infer_underlying_cause_and_icd10(cert_id=args.get("certId"), input_chain=args.get("inputChain"))
    elif task in ["mortality_cluster_dbscan", "mortality_cluster_rare"]:
        from chronic.mortality_cluster_dbscan import detect_mortality_patterns_and_rare_clusters
        result = detect_mortality_patterns_and_rare_clusters(target_city=args.get("city"))
    elif task in ["chronic_risk_forecast", "chronic_risk_gbdt"]:
        from chronic.chronic_risk_gbdt import predict_chronic_risk_and_complications
        result = predict_chronic_risk_and_complications(city=args.get("city"), target_disease=args.get("targetDisease"))
    elif task in ["injury_attribution_tree", "injury_tree_attribution"]:
        from chronic.injury_tree_attribution import analyze_injury_clusters_and_attribution
        result = analyze_injury_clusters_and_attribution(city=args.get("city"))
    elif task in ["chronic_screening_roi", "chronic_death_report", "lifetable_4q70_roi"]:
        from chronic.lifetable_4q70_roi import calculate_lifetable_4q70_and_screening_roi
        result = calculate_lifetable_4q70_and_screening_roi(city=args.get("city"))
    else:
        result = {"error": f"Unknown task: {task}"}

    def sanitize_for_json(obj):
        import math
        try:
            import pandas as pd
            if pd.isna(obj):
                return None
        except Exception:
            pass
        if isinstance(obj, dict):
            return {str(k): sanitize_for_json(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [sanitize_for_json(v) for v in obj]
        elif isinstance(obj, (float, int)):
            if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
                return None
            return obj
        elif hasattr(obj, "item"): # numpy types
            val = obj.item()
            return sanitize_for_json(val)
        return obj

    clean_result = sanitize_for_json(result)
    import re
    s = json.dumps(clean_result, ensure_ascii=False, default=str)
    s = re.sub(r':\s*NaN\b', ': null', s)
    s = re.sub(r':\s*Infinity\b', ': null', s)
    s = re.sub(r':\s*-Infinity\b', ': null', s)
    print(s)

if __name__ == "__main__":
    main()
