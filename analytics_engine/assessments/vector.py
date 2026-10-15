import numpy as np
import pandas as pd
from .common import frame, records, result, forecast, classifier, require_columns
from analytics_engine.repositories.datasets import connect_readonly
from analytics_engine.vector_methods import load_capture_history
from analytics_engine.input_errors import InputDataError


def assess(db,args):
    action=args['analysis']
    if action in ('population','density'):
        rows=load_capture_history(db,args.get('to') or args.get('asOf'),int(args.get('dataWindow',60)),category=args.get('category','蚊'),species_name=args.get('speciesName'),city=args.get('city'),district=args.get('district'),method_name=args.get('methodName','诱蚊灯法'))
        if not rows:raise InputDataError('NO_MATCHING_INPUT','当前范围内没有对应采样方法的病媒监测记录，请调整范围或补充监测数据。')
        if len(set(r['methodName'] for r in rows))!=1:raise ValueError('ONE_SAMPLING_METHOD_REQUIRED')
        available=rows; cov=None; weather_features=[]
        # Univariate ARIMA/LSTM need only capture history and sampling effort.
        if action=='density':
            exposure=frame(db,'fact_vector_exposure',args,'monitoring_date',columns=['temperature_c','rainfall_mm'])
            exposure['month']=exposure.monitoring_date.str[:7]
            weather=exposure.groupby('month')[['temperature_c','rainfall_mm']].mean()
            available=[r for r in rows if r['period'] in weather.index]
            if len(available)<18:raise ValueError('MATCHED_WEATHER_HISTORY_REQUIRED')
            cov=weather.loc[[r['period'] for r in available]].values;weather_features=list(weather.columns)
        target=[r['samplingUnitRatio'] for r in available]
        if any(x is None for x in target):raise ValueError('SAMPLING_EFFORT_REQUIRED')
        periods=[r['period'] for r in available]
        calendar=pd.period_range(periods[0],periods[-1],freq='M').astype(str).tolist()
        cutoff=(args.get('to') or args.get('asOf') or periods[-1])[:7]
        if periods!=calendar or periods[-1]!=cutoff:raise ValueError('FORECAST_CALENDAR_REQUIRED')
        models=['arima','lstm'] if action=='population' else ['gbdt']
        return result('vector-'+action+'-v2',unit='captures/sampling-unit',samplingMethod=rows[0]['methodName'],
            models=[forecast(periods,target,args.get('forecastMonths',3 if action=='population' else 2),m,cov) for m in models],
            assumptions=['sampling_unit must represent comparable effort; Mock effort is synthetic']+(['forecast weather uses persistence'] if weather_features else ['univariate capture history; no weather inputs required']),weatherFeatures=weather_features)
    if action=='resistance':
        with connect_readonly(db) as c:
            df=pd.read_sql_query('SELECT r.*,s.species_name,p.pesticide_name,l.city,l.district FROM fact_insecticide_resistance r JOIN dim_species s USING(species_id) JOIN dim_pesticide p USING(pesticide_id) JOIN dim_location l USING(location_id)',c)
        for k in ('city','district','speciesName','pesticideName'):
            col={'speciesName':'species_name','pesticideName':'pesticide_name'}.get(k,k)
            if args.get(k):df=df[df[col]==args[k]]
        if args.get('asOf'):df=df[df.date_id<=args['asOf']]
        # Lagged bioassay values: target mortality is never a predictor of itself.
        input_rows=len(df)
        df=df.dropna(subset=['corrected_mortality']).sort_values('date_id'); keys=['species_id','pesticide_id','location_id']
        df['previous_mortality']=df.groupby(keys).corrected_mortality.shift(1)
        df['target']=pd.cut(df.corrected_mortality,[-1,90,98,101],labels=['高抗','中抗','敏感'],right=False).astype(str)
        df=df.dropna(subset=['previous_mortality']); features=['previous_mortality','test_temp','pesticide_name','city','district']
        df=df.dropna(subset=[*features,'target'])
        if len(df)<16 or df.target.iloc[:int(.75*len(df))].nunique()<2:
            from analytics_engine.resistance_ml import calculate_resistance_prediction
            observed=calculate_resistance_prediction(db,species_name=args.get('speciesName'),pesticide_name=args.get('pesticideName'),city=args.get('city'),district=args.get('district'),as_of=args.get('asOf'))
            return {**observed,'status':'INSUFFICIENT_DATA','reason':'缺少足够的重复生测记录或训练段未覆盖两类结局，未生成抗性预测。'}
        model,X,meta=classifier(df,features,'target','rf')
        latest=df.groupby(keys).tail(1).copy(); latest['previous_mortality']=latest.corrected_mortality
        latestX=pd.get_dummies(latest[features],dtype=float).reindex(columns=X.columns,fill_value=0).fillna(0)
        latest['predictedGrade']=model.predict(latestX)
        return result('lagged-bioassay-random-forest-v1',**meta,inputRows=input_rows,excludedIncompleteOrUnpairedRows=input_rows-len(df), predictions=records(latest[['resistance_id','species_name','pesticide_name','city','district','date_id','corrected_mortality','predictedGrade']]),gradeRule='demo: mortality <90 high, 90–98 moderate, >=98 susceptible',assumptions=['WHO-style thresholds are configurable demo rules; not a dosing recommendation'])
    exposure=frame(db,'fact_vector_exposure',args,'monitoring_date')
    if exposure.empty:raise ValueError('EXPOSURE_OR_GENOTYPE_DATA_REQUIRED')
    if action=='evolution':
        require_columns(exposure,['pesticide_applications','tested_alleles','resistant_alleles'],'抗性演化输入')
        from scipy.stats import beta
        rows=[]; posterior={}
        # Beta-Binomial conditional network: application stratum -> allele frequency.
        for group,d in exposure.groupby('pesticide_applications'):
            a=1+int(d.resistant_alleles.sum()); b=1+int((d.tested_alleles-d.resistant_alleles).sum()); posterior[int(group)]=(a,b)
        latest=exposure.sort_values('monitoring_date').iloc[-1]; planned=int(args.get('applications',latest.pesticide_applications));
        if planned not in posterior:raise InputDataError('NO_MATCHING_INPUT','缺少所选施药次数对应的基因检测样本，无法估计抗性频率。')
        a,b=posterior[planned]
        for i in range(1,13):
            rows.append({'month':(pd.Timestamp(latest.monitoring_date)+pd.DateOffset(months=i)).strftime('%Y-%m'), 'applications':planned,'frequency':a/(a+b),'lower95':float(beta.ppf(.025,a,b)),'upper95':float(beta.ppf(.975,a,b))})
        return result('conditional-beta-binomial-network-v1',history=records(exposure),posterior=[{'applications':k,'alpha':a,'beta':b} for k,(a,b) in posterior.items()],forecasts=rows, assumptions=['conditional stationarity over 12 months; no evolutionary selection coefficient inferred','Beta(1,1) prior; frequency is resistant alleles / tested alleles'],warning=a/(a+b)>.5)
    if action=='transmission':
        require_columns(exposure,['population','outdoor_person_hours'],'人群暴露输入')
        if exposure.population.sum()<=0:raise InputDataError('INVALID_DENOMINATOR','缺少有效人口分母，无法计算暴露比例。')
        with connect_readonly(db) as c:
            density=c.execute('SELECT SUM(capture_count)*1.0/NULLIF(SUM(sampling_unit),0) FROM fact_monitoring').fetchone()[0]
            positive,total=c.execute("SELECT SUM(CASE WHEN pcr_result='阳性' THEN 1 ELSE 0 END),COUNT(*) FROM fact_pathogen_detection WHERE pcr_result IN ('阳性','阴性')").fetchone()
        if not total or density is None:raise InputDataError('NO_MATCHING_INPUT','缺少有效PCR检测记录或采样投入分母，不能把缺测当作零风险。')
        rate=(positive or 0)/total; fraction=float(exposure.outdoor_person_hours.sum()/(24*exposure.population.sum()))
        index=float(density or 0)*rate*fraction
        return result('density-pcr-exposure-index-v1',density=density,pcrPositiveRate=rate,pcrSamples=total,outdoorExposureFraction=fraction,exposureIndex=index,formula='capture/effort × PCR positive record fraction × outdoor person-hours/(population×24)',assumptions=['relative exposure index, not individual infection probability','PCR pooled record positivity is not individual prevalence'])
    raise ValueError('UNKNOWN_VECTOR_ANALYSIS')
