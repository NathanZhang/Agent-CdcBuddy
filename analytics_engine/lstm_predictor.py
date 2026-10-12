"""No trained weights or validated evaluation exist; random weights cannot be a predictor."""
def calculate_lstm_short_term_forecast(db_path,target_cities=None,category='蚊',forecast_days=7,start_date_str=None,**kwargs):
 return {'status':'FAILED','payload':None,'method':'unavailable-lstm','predictionsByCity':{},'predictions_by_city':{},'qualityFlags':['trained-lstm-model-unavailable'],'error':{'code':'CAPABILITY_UNAVAILABLE','message':'未提供训练完成且通过回测的 LSTM 权重，不能生成随机预测','retryable':False}}
def run_lstm_predictor_standalone(db_path,**kwargs):return calculate_lstm_short_term_forecast(db_path,**kwargs)
