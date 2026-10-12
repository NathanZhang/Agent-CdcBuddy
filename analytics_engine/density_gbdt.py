from analytics_engine.vector_methods import forecast_capture

def calculate_gbdt_density_forecast(db_path,category='蚊',city=None,forecast_months=2,as_of=None,data_window=60,method_name=None,district=None,species_name=None):
 return forecast_capture(db_path,category,species_name,city,district,forecast_months,as_of,data_window,method_name,'gbdt')
