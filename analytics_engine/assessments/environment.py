import numpy as np
import pandas as pd
from .common import frame, records, result, forecast, metrics


def assess(db,args):
    action=args['analysis']
    if action=='clean':
        df=frame(db,'fact_env_raw_samples',args,'monitoring_date').sort_values('monitoring_date'); logs=[]
        for (code,unit),g in df.groupby(['indicator_code','canonical_unit']):
            converted=[]
            for _,r in g.iterrows():
                factor=1 if r.raw_unit==unit else .001 if r.raw_unit in ('ug/L','μg/L') and unit=='mg/L' else None
                if factor is None:raise ValueError('UNKNOWN_UNIT_CONVERSION')
                converted.append(float(r.raw_value)*factor if pd.notna(r.raw_value) and r.raw_value>=0 else np.nan)
            filled=pd.Series(converted).interpolate(limit_direction='both')
            if filled.isna().any():raise ValueError('NO_VALID_SIMILAR_SAMPLE_FOR_IMPUTATION')
            for i,(_,r) in enumerate(g.iterrows()):logs.append({'recordId':r.record_id,'sampleCode':r.sample_code,'indicator':code,'before':None if pd.isna(r.raw_value) else r.raw_value,'beforeUnit':r.raw_unit,'after':float(filled.iloc[i]),'unit':unit,'operation':'interpolation' if np.isnan(converted[i]) else 'unit-conversion' if r.raw_unit!=unit else 'unchanged','reviewRequired':bool(np.isnan(converted[i]))})
        return result('audited-unit-linear-imputation-v1',rows=logs,originalRetained=True,completeBefore=sum(x['before'] is not None and x['before']>=0 for x in logs),completeAfter=len(logs),assumptions=['linear interpolation within indicator and unit; imputed values require review'])
    if action in ('water_risk','water_trend'):
        df=frame(db,'fact_water_monitoring',args,'monitoring_date').sort_values('monitoring_date')
        if action=='water_trend':
            models=[]
            for station,g in df.groupby('station_id'):
                g=g.assign(period=g.monitoring_date.str[:7]).groupby('period').turbidity.mean()
                if len(g)>=18:models.append({'stationId':station,**forecast(g.index,g.values,3)})
            if not models:raise ValueError('WATER_TREND_REQUIRES_18_MONTHS')
            stations=frame(db,'dim_env_stations',args)
            return result('water-lstm-v1',models=models,stations=records(stations),unit='NTU',mapPrecision='registered station coordinates; township labels require address verification')
        from sklearn.ensemble import RandomForestRegressor
        # Dose model assumptions are versioned and shown; never use stored legacy risk scores as computed results.
        dose=df[['arsenic_val','cadmium_val','lead_val']].fillna(0)*2/60
        df['computedCancerRisk']=dose.arsenic_val*1.5
        df['computedHazardQuotient']=dose.arsenic_val/.0003+dose.cadmium_val/.001
        X=pd.get_dummies(df[['water_source','disinfection_method','arsenic_val','cadmium_val','lead_val','turbidity']],dtype=float).fillna(0)
        y=df[['computedCancerRisk','computedHazardQuotient']]; split=int(.8*len(df))
        model=RandomForestRegressor(n_estimators=60,max_depth=6,random_state=42).fit(X.iloc[:split],y.iloc[:split]); p=model.predict(X.iloc[split:])
        validation={k:metrics(y.iloc[split:,i],p[:,i]) for i,k in enumerate(y.columns)}
        model.fit(X,y); latest=df.groupby('station_id').tail(1).copy(); pred=model.predict(X.loc[latest.index]); latest['rfCancerRisk']=pred[:,0];latest['rfHazardQuotient']=pred[:,1]
        return result('water-dose-random-forest-v1',rows=records(latest[['record_id','station_id','monitoring_date','computedCancerRisk','computedHazardQuotient','rfCancerRisk','rfHazardQuotient']]),validation=validation,features=list(X.columns),featureImportance=model.feature_importances_.tolist(),assumptions={'version':'demo-adult-dose-v1','waterLitresPerDay':2,'bodyWeightKg':60,'arsenicSlopeFactor':1.5,'arsenicRfD':.0003,'cadmiumRfD':.001,'scope':'demonstration coefficients; professional toxicology review required; RF approximates dose formula, not clinical outcomes'})
    if action=='sewage_source':
        from sklearn.cluster import KMeans
        sewage=frame(db,'fact_sewage_monitoring',args,'monitoring_date'); network=frame(db,'fact_sewage_network',args,'monitoring_date'); stations=frame(db,'dim_env_stations',args)
        values=sewage.groupby('plant_id').norovirus_copies_l.mean().rename('concentration').reset_index()
        values=values.merge(stations[['station_id','latitude','longitude']],left_on='plant_id',right_on='station_id',how='left')
        if values[['latitude','longitude']].isna().any().any():raise ValueError('SEWAGE_STATION_COORDINATES_REQUIRED')
        values['spatialCluster']=KMeans(n_clusters=min(3,len(values)),random_state=42,n_init=10).fit_predict(values[['latitude','longitude']])
        cutoff=float(values.concentration.quantile(.75)); high=set(values[values.concentration>=cutoff].plant_id); traces=[]
        for node in high:
            seen={node}; frontier=[node]
            while frontier:
                down=frontier.pop()
                for _,edge in network[network.downstream_node==down].iterrows():
                    traces.append({'highNode':node,'upstream':edge.upstream_node,'downstream':down,'flow':edge.flow_m3_day,'travelHours':edge.travel_hours})
                    if edge.upstream_node not in seen:seen.add(edge.upstream_node);frontier.append(edge.upstream_node)
        return result('sewage-spatial-cluster-upstream-traversal-v1',stations=records(values),highThreshold=cutoff,traceEdges=traces,assumptions=['upstream topology identifies candidate sources, not confirmed source attribution'])
    if action in ('venue_risk','venue_grade'):
        scores=frame(db,'fact_venue_scores',args,'inspection_date'); venues=frame(db,'fact_public_venue_inspection',args,'inspection_date')
        df=scores.merge(venues,on=['venue_id','city','district'],suffixes=('','_inspection')); fields=['management','staff','disclosure','testing','smoking','facilities']
        df['totalScore']=df[fields].mean(axis=1); df['calculatedGrade']=pd.cut(df.totalScore,[-1,60,85,101],labels=['C','B','A'],right=False).astype(str)
        df['symptomRate']=df.symptom_reports/df.visitor_count
        if action=='venue_grade':return result('six-dimension-equal-weight-grading-v1',rows=records(df[['venue_id','venue_name',*fields,'totalScore','calculatedGrade','rule_version']]),rule={'version':'demo-equal-weight-v1','weights':[1/6]*6,'A':'>=85','B':'>=60','C':'<60'})
        from sklearn.linear_model import Ridge
        fields=['chlorine_residual','coliform_detected','microclimate_score','totalScore']; X=df[fields].fillna(0); split=max(2,int(len(df)*.75))
        if split>=len(df):raise ValueError('VENUE_HEALTH_MAPPING_REQUIRES_FOUR_VENUES')
        model=Ridge(alpha=1).fit(X.iloc[:split],df.symptomRate.iloc[:split]); p=np.clip(model.predict(X.iloc[split:]),0,1)
        validation=metrics(df.symptomRate.iloc[split:],p);model.fit(X,df.symptomRate);df['estimatedSymptomRate']=np.clip(model.predict(X),0,1)
        return result('venue-environment-health-ridge-v1',rows=records(df[['venue_id','venue_name',*fields,'visitor_count','symptom_reports','symptomRate','estimatedSymptomRate']]),validation=validation,coefficients=dict(zip(fields,model.coef_.tolist())),assumptions=['reported symptoms / visitors; ecological association, not causal diagnosis'])
    if action in ('exposure','heat','scenario'):
        air=frame(db,'fact_air_climate_monitoring',args,'date').groupby('date')[['pm25','temp_max','pediatric_resp_outpatient','elderly_cardio_outpatient']].mean().reset_index()
        activity=frame(db,'fact_env_activity',args,'monitoring_date'); df=activity.merge(air,left_on='monitoring_date',right_on='date').sort_values('date')
        if action=='scenario':
            sources=frame(db,'fact_env_intervention_inputs',args,'monitoring_date'); reduction=float(args.get('reductionPercentage',50))/100
            if not 0<=reduction<=1:raise ValueError('REDUCTION_OUT_OF_RANGE')
            baseline=float(air.pm25.mean()); sourceShare=float(args.get('sourceShare',.2)); beta=float(args.get('healthBeta',.001))
            if not 0<=sourceShare<=1 or not 0<=beta<=.1:raise ValueError('SCENARIO_ASSUMPTIONS_INVALID')
            delta=baseline*sourceShare*reduction; cases=float(air.pediatric_resp_outpatient.sum()); avoided=cases*(1-np.exp(-beta*delta))
            return result('explicit-emission-health-scenario-v1',sources=records(sources),baselinePm25=baseline,scenarioPm25=baseline-delta,pm25Reduction=delta,baselineVisits=cases,estimatedAvoidedVisits=float(avoided),assumptions={'sourceContribution':sourceShare,'reductionFraction':reduction,'logRelativeRiskPerUgM3':beta,'source':'user-editable demo assumptions; not fitted causal policy effect'},sensitivity=[{'sourceShare':s,'deltaPm25':baseline*s*reduction} for s in [.1,.2,.3]])
        if df.empty:raise ValueError('MATCHED_ACTIVITY_AIR_DATA_REQUIRED')
        df['dailyExposure']=(df.pm25*df.outdoor_hours+df.indoor_pm25*df.indoor_hours)/24
        if action=='exposure':
            daily=df.groupby('date')[['dailyExposure','pediatric_resp_outpatient']].mean()
            model=forecast(daily.index,daily.pediatric_resp_outpatient.values,3,'lstm',daily[['dailyExposure']].values)
            return result('activity-weighted-exposure-lstm-v1',rows=records(df[['date','population_group','outdoor_hours','indoor_hours','dailyExposure']]),unit='ug/m3 time-weighted daily concentration',forecast=model,peak=max(model['forecasts'],key=lambda x:x['value']),correlation=float(daily.corr().iloc[0,1]),assumptions=['outdoor+indoor activity must cover 24 hours; forecast exposure held constant'])
        from sklearn.ensemble import GradientBoostingRegressor
        # Split whole dates to avoid leakage between age groups on the same day.
        df['deathRatePer100k']=df.cardiovascular_deaths/df.population*100000
        dates=sorted(df.date.unique()); cut=dates[int(len(dates)*.8)]; train=df.date<cut
        fields=['temp_max','pm25','dailyExposure']; model=GradientBoostingRegressor(n_estimators=60,max_depth=2,random_state=42).fit(df.loc[train,fields],df.loc[train,'deathRatePer100k'])
        validation=metrics(df.loc[~train,'deathRatePer100k'],model.predict(df.loc[~train,fields]));model.fit(df[fields],df.deathRatePer100k); forecasts=[]
        for group,g in df.groupby('population_group'):
            last=g.iloc[-1]
            for h in (24,48,72):
                X=pd.DataFrame([[last[f'forecast_temp_{h}h'],last.pm25,last.dailyExposure]],columns=fields)
                rate=max(0,float(model.predict(X)[0]));forecasts.append({'group':group,'leadHours':h,'forecastTemperature':last[f'forecast_temp_{h}h'],'deathRatePer100k':rate,'alert':bool(last[f'forecast_temp_{h}h']>=35),'advice':'减少高温时段户外活动；建立重点人群随访与异常转诊任务'})
        return result('heat-gradient-boosting-72h-v1',forecastIssuedAt=str(df.date.max()),forecasts=forecasts,validation=validation,featureImportance=model.feature_importances_.tolist(),features=fields,assumptions=['weather forecast comes from dataset; mock weather is explicitly synthetic'])
    if action in ('cross_media','river_health'):
        df=frame(db,'fact_river_basin_monitoring',args,'monitoring_date'); cols=['water_pb','water_cd','soil_cd','crop_pb','hepatic_cancer_incidence']; corr=df[cols].corr().fillna(0)
        payload={'rows':records(df[['section_name','basin_name',*cols]]),'correlations':[{ 'from':a,'to':b,'pearson':float(corr.loc[a,b])} for a,b in [('water_cd','soil_cd'),('soil_cd','crop_pb'),('crop_pb','hepatic_cancer_incidence')]],'assumptions':['association does not establish cross-media causal transfer']}
        if action=='river_health':
            edges=frame(db,'fact_river_adjacency',args,'monitoring_date'); g=df.groupby('section_name').hepatic_cancer_incidence.mean(); names=list(g.index); W=np.zeros((len(g),len(g)))
            for _,e in edges.iterrows():
                if e.section_a in names and e.section_b in names:i,j=names.index(e.section_a),names.index(e.section_b);W[i,j]=W[j,i]=1
            if W.sum()==0:raise ValueError('RIVER_ADJACENCY_REQUIRED')
            z=g.values-g.mean(); denom=float(z@z)
            stat=lambda v:float(len(v)/W.sum()*(v@W@v)/(v@v)) if v@v else 0
            I=stat(z);rng=np.random.default_rng(42); null=[stat(rng.permutation(z)) for _ in range(199)]
            payload.update({'moranI':I,'permutationP':(1+sum(abs(x)>=abs(I) for x in null))/200,'weightsSource':'fact_river_adjacency; supplied topology, not inferred administrative boundaries','localCandidates':[{'section':name,'centeredIncidence':float(z[i]),'neighborCenteredIncidence':float((W@z)[i]/max(W[i].sum(),1)),'highHigh':bool(z[i]>0 and (W@z)[i]>0)} for i,name in enumerate(names)],'adjacencyEdges':records(edges)})
        return result('cross-media-pearson-moran-v1',**payload)
    raise ValueError('UNKNOWN_ENVIRONMENT_ANALYSIS')
