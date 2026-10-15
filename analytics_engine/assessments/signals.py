"""Versioned, inspectable demo warning policies; outputs never imply external delivery."""
import numpy as np
import pandas as pd
from .common import frame, records, result, forecast

POLICIES={
 'vector':{'topic':'病媒','steps':['核对监测点与采样方法','登记积水清理和环境整治任务','按登记方法复测并提交审核'],'reference':'本地演示处置流程 vector-v1；专业消杀规范由机构维护'},
 'foodborne':{'topic':'食源性聚集','steps':['核对共同饮食暴露与病例清单','登记食品及环境采样、批次留样任务','匹配历史事件并追踪调查结论'],'reference':'本地演示处置流程 foodborne-v1；机构专业审批后执行'},
 'env':{'topic':'环境风险','steps':['饮水：复核采样、核查处理设施与异常指标','空气：通知监测责任人并登记重点人群暴露核查','热浪：登记重点人群随访及防护告知任务'],'reference':'本地演示处置流程 env-v1；不是正式卫生标准'},
 'chronic':{'topic':'死因慢病伤害','steps':['死因：核对罕见死因聚集与登记编码','慢病：建立高风险随访和筛查转介清单','伤害：核查儿童跌倒场所及交通风险点，追踪设施改进'],'reference':'本地演示处置流程 chronic-v1；不替代个体诊疗建议'}
}

def assess(domain,db,args):
    if domain=='vector':
        from analytics_engine.repositories.datasets import connect_readonly
        with connect_readonly(db) as c: df=pd.read_sql_query('SELECT f.date_id AS date,l.city,l.district,f.capture_count AS value,f.weather_temp AS cofactor FROM fact_monitoring f JOIN dim_location l USING(location_id)',c)
        unit='captures/record';threshold=float(args.get('threshold',30))
    elif domain=='env':
        air=frame(db,'fact_air_climate_monitoring',args,'date',columns=['city','district','pm25','temp_max']);df=air.rename(columns={'pm25':'value','temp_max':'cofactor'});unit='ug/m3';threshold=float(args.get('threshold',75))
    elif domain=='foodborne':
        df=frame(db,'fact_foodborne_case',args,'visit_date',columns=['city','district','case_id','is_pathogen_positive']).rename(columns={'visit_date':'date'});df['cofactor']=df.is_pathogen_positive
        df=df.groupby(['date','city','district']).agg(value=('case_id','count'),cofactor=('cofactor','sum')).reset_index();unit='cases/day';threshold=float(args.get('threshold',5))
    else:
        df=frame(db,'fact_death_registry',args,'death_date',columns=['city','district','icd10_category','death_cert_id']).rename(columns={'death_date':'date'});df['cofactor']=(df.icd10_category=='罕见死因').astype(int)
        df=df.groupby(['date','city','district']).agg(value=('death_cert_id','count'),cofactor=('cofactor','sum')).reset_index();unit='deaths/day';threshold=float(args.get('threshold',5))
    for key in ('city','district'):
        if args.get(key):df=df[df[key]==args[key]]
    if args.get('from'):df=df[df.date>=args['from']]
    if args.get('to'):df=df[df.date<=args['to']]
    if args.get('eventDate'):df=df[df.date.str[:10]==args['eventDate']]
    if df.empty:raise ValueError('SIGNAL_INPUTS_REQUIRED')
    grouped=df.groupby(['city','district']).agg(value=('value','mean'),peak=('value','max'),cofactor=('cofactor','mean')).reset_index()
    # Multiplicative cofactor is explicitly a demonstration policy, not learned causation.
    if domain=='env':
        water=frame(db,'fact_water_monitoring',args,'monitoring_date',columns=['city','district','arsenic_val','lead_val','turbidity']);water['exceeded']=((water.arsenic_val>.01)|(water.lead_val>.01)|(water.turbidity>1)).astype(int)
        water=water.groupby(['city','district']).agg(waterExceedFraction=('exceeded','mean'),maxArsenicMgL=('arsenic_val','max')).reset_index()
        grouped=grouped.merge(water,on=['city','district'],how='left').fillna({'waterExceedFraction':0})
    grouped['index']=grouped.peak/threshold*(1+np.minimum(grouped.cofactor.clip(lower=0)/100,.5))
    if domain=='env':grouped['index']+=grouped.waterExceedFraction
    grouped['level']=pd.cut(grouped['index'],[-np.inf,1,2,np.inf],labels=['一般','较重','严重'],right=False).astype(str)
    grouped['recipientLevel']=grouped.level.map({'一般':'基层医疗机构','较重':'市级疾控','严重':'省级疾控及卫生健康行政部门'})
    daily=df.groupby('date').value.mean().sort_index();trend=forecast(daily.index,daily.values,3,'lstm' if domain=='chronic' else 'arima') if len(daily)>=18 else {'status':'INSUFFICIENT_DATA','requiredPeriods':18}
    history=[]
    if domain=='foodborne':
        events=frame(db,'fact_outbreak_event',{},'start_time',columns=['disposal_status','cluster_id','event_title','trace_conclusion'],allow_empty=True)
        current_start=args.get('eventDate') or args.get('from') or str(df.date.min())
        # Only historical events before the current window can be matched as prior cases.
        history=records(events[(events.start_time.str[:10]<current_start)&(events.disposal_status=='closed')][['cluster_id','event_title','start_time','trace_conclusion']],5)
    return result('versioned-'+domain+'-warning-policy-v1',signals=records(grouped),threshold=threshold,unit=unit,trend=trend,policyVersion='demo-threshold-trend-cofactor-v1',steps=POLICIES[domain]['steps'],reference=POLICIES[domain]['reference'],historicalCases=history,channels={'inApp':'requires approved task','sms':'not-configured','appPush':'not-configured'},assumptions=['risk levels from explicit demo policy; professional thresholds require local approval','No external notification has been sent'])
