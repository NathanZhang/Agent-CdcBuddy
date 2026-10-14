import numpy as np
import pandas as pd
from .common import frame, records, result, forecast


def assess(db,args):
    action=args['analysis']; cases=frame(db,'fact_foodborne_case',args,'visit_date')
    if action=='forecast':
        weather=frame(db,'fact_food_forecast_inputs',args,'monitoring_date').assign(period=lambda d:d.monitoring_date.str[:7]); models=[]; excluded=[]
        for (city,pathogen),g in cases.groupby(['city','pathogen_id']):
            observed=g.assign(period=g.visit_date.str[:7]).groupby('period').size(); w=weather[weather.city==city].groupby('period')[['temperature_c','rainfall_mm','population','transport_daily_passengers']].mean(); matched=observed.index.intersection(w.index)
            if len(matched)<18:
                excluded.append({'city':city,'pathogenId':pathogen,'reason':'MATCHED_HISTORY_UNDER_18_MONTHS'});continue
            cutoff=(args.get('to') or args.get('asOf') or '')[:7]
            if cutoff and matched[-1]!=cutoff:
                excluded.append({'city':city,'pathogenId':pathogen,'reason':'LATEST_PERIOD_NOT_COVERED','latestPeriod':str(matched[-1]),'requestedCutoff':cutoff});continue
            series=observed.loc[matched];cov=w.loc[matched]; f=forecast(matched,series.values,int(args.get('forecastMonths',1)),'lstm',cov.values)
            value=f['forecasts'][0]['value']; population=float(cov.population.iloc[-1]); mobility=float(cov.transport_daily_passengers.iloc[-1])/population
            models.append({'city':city,'pathogenId':pathogen,'expectedCases':value,'expectedPer100k':value/population*100000,'mobilityProxy':mobility,'spreadIndex':value/population*100000*(1+mobility),'riskLevel':'严重' if value>series.quantile(.9) else '较重' if value>series.median() else '一般',**f})
        if not models:raise ValueError('FOOD_FORECAST_REQUIRES_18_MATCHED_MONTHS')
        return result('food-weather-lstm-spread-v1',models=models,excludedSeries=excluded,assumptions=['risk grades use historical local quantiles; mobility proxy is daily passengers/population'])
    if action=='clusters':
        groups=[];minimum=int(args.get('minCases',3));hours=int(args.get('windowHours',48))
        for keys,g in cases.groupby(['city','district','dining_place_type','suspected_food']):
            g=g.sort_values('symptom_onset_time');times=pd.to_datetime(g.symptom_onset_time)
            # Historical daily baseline within the selected scope, configurable minimum.
            daily=times.dt.date.value_counts();dynamic=max(minimum,int(np.ceil(daily.median()+2*np.sqrt(daily.median()))))
            for start in times.unique():
                hits=g[(times>=start)&(times<start+pd.Timedelta(hours=hours))]
                if len(hits)>=dynamic:groups.append(dict(zip(['city','district','placeType','food'],keys),cases=len(hits),threshold=dynamic,start=str(start),caseIds=hits.case_id.tolist()));break
        matched_ids={case_id for group in groups for case_id in group['caseIds']}
        details=cases[cases.case_id.isin(matched_ids)][['case_id','city','district','visit_date','symptom_onset_time','main_symptoms','suspected_food','dining_place_type','pathogen_id']]
        return result('adaptive-food-exposure-window-v1',clusters=groups,caseDetails=records(details),matchedCaseCount=len(details),rule={'minimumCases':minimum,'windowHours':hours,'dynamic':'max(minimum, ceil(median daily count+2sqrt(median)))'})
    if action=='trace':
        from analytics_engine.foodborne.cgmlst_cluster import calculate_cgmlst_clustering
        molecular=calculate_cgmlst_clustering(db,threshold=int(args.get('threshold',5)),city=args.get('city'),district=args.get('district'),from_date=args.get('from'),as_of=args.get('to'),sample_limit=int(args.get('sampleLimit',40)),pathogen_id=args.get('pathogenId'),cluster_id=args.get('clusterId'))
        exposure=frame(db,'fact_food_exposure',args,'exposure_date');edges=[]; associations=[]
        for _,r in exposure.iterrows():
            edges.extend([{'from':r.cluster_id,'to':r.cohort_id,'relation':'case-exposure-cohort'},{'from':r.cohort_id,'to':r.batch_id,'relation':'consumed-batch'},{'from':r.batch_id,'to':r.supplier,'relation':'supplier'}])
            exposed=r.exposed_ill/r.exposed_count; unexposed=r.unexposed_ill/r.unexposed_count
            associations.append({'food':r.food_name,'cohort':r.cohort_id,'exposedAttackRate':exposed,'unexposedAttackRate':unexposed,'riskRatio':exposed/unexposed if unexposed else None})
        return result('molecular-exposure-supply-graph-v1',molecular=molecular,edges=edges,associations=associations,caseLinks=records(cases[cases.cluster_id.isin(exposure.cluster_id)][['case_id','cluster_id','pathogen_id','city','district','visit_date','symptom_onset_time','main_symptoms','suspected_food']]),exposureDetails=records(exposure),assumptions=['graph edges require recorded keys; shared supplier does not prove source'])
    if action=='dashboard':
        drill_city=args.get('drilldownCity')
        drill=cases[cases.city==drill_city] if drill_city else cases.iloc[:0]
        events=frame(db,'fact_outbreak_event',args,'start_time')
        return result('food-dashboard-drilldown-v1',filters={k:args[k] for k in ['from','to','asOf'] if args.get(k)},cities=records(cases.groupby('city').size().rename('cases').reset_index()),districts=records(cases.groupby(['city','district']).size().rename('cases').reset_index()),trend=records(cases.assign(period=cases.visit_date.str[:7]).groupby('period').size().rename('cases').reset_index()),foodTop10=records(cases.groupby('suspected_food').size().rename('cases').reset_index().sort_values('cases',ascending=False),10),events=records(events),details=records(cases[['case_id','city','district','visit_date','main_symptoms','suspected_food']],50),refreshedAt=pd.Timestamp.now(tz='UTC').isoformat(),drilldown={'city':drill_city,'status':'SUCCESS' if len(drill) else 'NO_DATA','details':records(drill[['case_id','city','district','visit_date','main_symptoms','suspected_food']])})
    raise ValueError('UNKNOWN_FOOD_ANALYSIS')
