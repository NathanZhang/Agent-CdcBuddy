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
    else:
        result = {"error": f"Unknown task: {task}"}

    def sanitize_for_json(obj):
        import math
        if isinstance(obj, dict):
            return {str(k): sanitize_for_json(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [sanitize_for_json(v) for v in obj]
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        elif hasattr(obj, "item"): # numpy types
            val = obj.item()
            return sanitize_for_json(val)
        return obj

    clean_result = sanitize_for_json(result)
    try:
        print(json.dumps(clean_result, ensure_ascii=False, allow_nan=False))
    except Exception:
        # fallback with string replacement
        s = json.dumps(clean_result, ensure_ascii=False, default=str)
        s = s.replace(": NaN", ": null").replace(": Infinity", ": null").replace(": -Infinity", ": null")
        print(s)

if __name__ == "__main__":
    main()
