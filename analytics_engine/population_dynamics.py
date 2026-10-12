from analytics_engine.vector_methods import forecast_capture

def calculate_population_dynamics(db_path,category='蚊',species_name=None,city=None,forecast_months=3,as_of=None,data_window=60,method_name=None,district=None):
 return forecast_capture(db_path,category,species_name,city,district,forecast_months,as_of,data_window,method_name,'ar')
