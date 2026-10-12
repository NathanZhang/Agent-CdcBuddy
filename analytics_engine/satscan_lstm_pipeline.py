"""Legacy full pipeline entry: a missing trained LSTM cannot yield scientific success."""
def run_satscan_kmeans_lstm_pipeline(db_path,**kwargs):
 return {'status':'FAILED','success':False,'payload':None,'method':'unavailable-satscan-kmeans-lstm-pipeline','kmeans_subgroups':[],'qualityFlags':['trained-lstm-model-unavailable','full-pipeline-not-validated'],'error':{'code':'CAPABILITY_UNAVAILABLE','message':'完整流水线依赖训练及验证后的 LSTM 模型，当前不能执行或生成替代画像','retryable':False}}
