import numpy as np
import pandas as pd
from .common import frame, records, result, forecast, classifier


def assess(db,args):
    action=args['analysis']
    if action in ('risk','complications','screening'):
        df=frame(db,'fact_chronic_followup',args,'monitoring_date').sort_values(['monitoring_date','record_id'])
        if action=='screening':df=df[df.disease_name.str.contains('肿瘤|癌',na=False)].copy()
        features=['age','smoking','family_history','systolic_bp']; model,X,meta=classifier(df,features,'outcome_event')
        df['eventProbability']=model.predict_proba(X)[:,list(model.classes_).index(1)]
        if action=='risk':
            grouped=df.groupby('monitoring_date').agg(observedEvents=('outcome_event','sum'),people=('record_id','count'),expectedEvents=('eventProbability','sum')).reset_index()
            grouped['expectedEventRate']=grouped.expectedEvents/grouped.people
            return result('followup-gradient-boosting-risk-v1',**meta,individuals=records(df[['record_id',*features,'followup_months','eventProbability']]),population=records(grouped),assumptions=['risk horizon equals followup_months (24 months in demo); not a validated 10-year risk score','population projection applies to sampled followup cohort only'])
        if action=='complications':
            rules=[];n=len(df)
            for disease,g in df.groupby('disease_name'):
                for complication,count in g.complication.value_counts().items():
                    if complication=='无':continue
                    baseline=float((df.complication==complication).mean()); confidence=count/len(g)
                    rules.append({'disease':disease,'complication':complication,'jointCount':int(count),'support':count/n,'confidence':confidence,'lift':confidence/baseline if baseline else None})
            return result('chronic-complication-association-v1',rules=rules,denominator=n,assumptions=['association from observed followups; no causal claim'])
        high=df[df.eventProbability>=float(args.get('riskThreshold',.2))]; screened=df[df.screened==1]; totalcost=float(screened.screening_cost_yuan.sum()); detected=int(screened.detected.sum())
        registry=frame(db,'fact_chronic_cases',args,'diagnosed_date')
        registry=registry[registry.disease_name.str.contains('肿瘤|癌',na=False)]
        population=frame(db,'dim_districts',args)
        regions=registry.groupby(['city','district']).size().rename('registeredCandidates').reset_index().merge(population[['city','district','population']],on=['city','district'],how='left')
        treatment=float(screened.loc[screened.detected==1,'treatment_cost_yuan'].sum())
        fraction=float(args.get('avoidedCostFraction',.25))
        if not 0<=fraction<=1:raise ValueError('INVALID_AVOIDED_COST_FRACTION')
        benefit=treatment*fraction
        return result('risk-prioritized-screening-cost-v1',highRiskList=records(high[['record_id','city','district','age','disease_name','eventProbability']].sort_values('eventProbability',ascending=False)),regionalRegistry=records(regions),screened=len(screened),detected=detected,detectionRate=detected/len(screened) if len(screened) else None,screeningCostYuan=totalcost,costPerDetectedCaseYuan=totalcost/detected if detected else None,estimatedTreatmentCostYuan=treatment,avoidedCostFraction=fraction,assumedBenefitYuan=benefit,benefitCostRatio=benefit/totalcost if totalcost else None,assumptions=['tumor cohort selected from registered disease labels containing 肿瘤 or 癌; high-risk registrations are candidates, not confirmed cancer incidence','cost-benefit ratio uses a hypothetical avoidable fraction of detected treatment cost, not realized savings or causal benefit','population is a fixed district denominator; followup risk applies only to sampled cohort'],**meta)
    if action in ('mortality','rare'):
        df=frame(db,'fact_death_registry',args,'death_date'); pop=frame(db,'dim_districts',args)
        if action=='rare':
            rows=[]
            for (city,district,code),g in df[df.icd10_category=='罕见死因'].groupby(['city','district','icd10_code']):
                g=g.sort_values('death_date'); times=pd.to_datetime(g.death_date)
                for start in times.unique():
                    hits=g[(times>=start)&(times<start+pd.Timedelta(days=7))]
                    if len(hits)>=3:rows.append({'city':city,'district':district,'icd10':code,'windowStart':str(start)[:10],'cases':len(hits),'certificateIds':hits.death_cert_id.tolist()});break
            return result('rare-cause-seven-day-threshold-v1',clusters=rows,rule={'minimumCases':3,'windowDays':7,'sameCodeAndDistrict':True})
        from sklearn.cluster import DBSCAN
        by=df.groupby(['city','district']).size().rename('deaths').reset_index().merge(pop,on=['city','district']);by['mortalityPer100k']=by.deaths/by.population*100000
        by['spatialCluster']=DBSCAN(eps=10/6371,min_samples=2,metric='haversine').fit_predict(np.radians(by[['latitude','longitude']]))
        monthly=df.assign(period=df.death_date.str[:7]).groupby('period').size(); rate=monthly/float(pop.population.sum())*100000
        return result('mortality-arima-dbscan-v1',trend=forecast(rate.index,rate.values,3,'arima'),districts=records(by),unit='deaths per 100000 population per month',assumptions=['fixed denominator from dim_districts; geographic DBSCAN groups neighboring areas, rate identifies high-risk members'])
    if action in ('injury_clusters','injury_tree','injury_events'):
        df=frame(db,'fact_injury_surveillance',args,'injury_time')
        if action=='injury_events':
            events=[]
            for keys,g in df.groupby(['city','district','injury_place','injury_type']):
                times=pd.to_datetime(g.injury_time);order=np.argsort(times.values);g=g.iloc[order];times=times.iloc[order]
                for start in times.unique():
                    hit=g[(times>=start)&(times<start+pd.Timedelta(hours=24))]
                    if len(hit)>=5:events.append(dict(zip(['city','district','place','type'],keys),start=str(start),caseCount=len(hit),injuryIds=hit.injury_id.tolist(),causes=hit.injury_cause_factor.value_counts().to_dict()));break
            return result('same-place-injury-24h-v1',events=events,rule={'minimumCases':5,'hours':24,'samePlaceAndType':True})
        if action=='injury_tree':
            inputs=frame(db,'fact_injury_risk_inputs',args,'monitoring_date');df=df.merge(inputs,on=['injury_id','city','district'])
            df=df.sort_values('injury_time');model,X,meta=classifier(df,['age','protective_equipment','rural','surface_wet'],'injury_type','tree')
            return result('injury-decision-tree-v1',**meta,caseCount=len(df),observedAssociations=records(df.groupby(['protective_equipment','rural','injury_type']).size().rename('count').reset_index()),assumptions=['case-only classification, not causal attribution or population relative risk'])
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler
        df['hour']=pd.to_datetime(df.injury_time).dt.hour;df['month']=pd.to_datetime(df.injury_time).dt.month
        X=pd.get_dummies(df[['age','hour','month','injury_place','injury_type']],dtype=float);scaled=StandardScaler().fit_transform(X)
        df['cluster']=KMeans(n_clusters=min(5,len(df)),n_init=10,random_state=42).fit_predict(scaled)
        summary=[]
        for k,g in df.groupby('cluster'):summary.append({'cluster':int(k),'cases':len(g),'meanAge':float(g.age.mean()),'meanHour':float(g.hour.mean()),'types':g.injury_type.value_counts().head(3).to_dict(),'places':g.injury_place.value_counts().head(3).to_dict()})
        return result('injury-mixed-feature-kmeans-v1',clusters=summary,features=list(X.columns),seed=42)
    if action=='quality':
        from sklearn.ensemble import IsolationForest
        from analytics_engine.chronic.death_cert_qc import GENDER_EXCLUSIVE_CAUSES, AGE_RESTRICTED_CAUSES
        df=frame(db,'fact_death_registry',args,'death_date'); defects=[]
        duplicated=df.duplicated(['patient_name','gender','age','city','district','death_date'],keep=False)
        unusual=IsolationForest(contamination=.02,random_state=42).fit_predict(df[['age']])==-1
        for i,r in df.iterrows():
            rules=[]
            chain=' '.join(str(r[k] or '') for k in ['cause_chain_a','cause_chain_b','cause_chain_c','cause_chain_d','underlying_cause'])
            if any(term in chain for term in GENDER_EXCLUSIVE_CAUSES.get(r.gender,[])):rules.append('sex-cause-conflict')
            if any(rule['keyword'] in chain and r.age<rule['min_age'] for rule in AGE_RESTRICTED_CAUSES):rules.append('age-cause-conflict')
            if r.age<0 or r.age>120:rules.append('invalid-age')
            if not r.icd10_code or not r.underlying_cause:rules.append('missing-cause-or-code')
            if duplicated.loc[i]:rules.append('possible-duplicate-person-date')
            if r.age<5 and ('老年' in r.underlying_cause or r.icd10_code.startswith('I25')):rules.append('age-cause-conflict')
            if unusual[i]:rules.append('age-distribution-outlier')
            if rules:defects.append({'certificateId':r.death_cert_id,'rules':rules,'requiresReview':True})
        definitions={'sex-cause-conflict':'性别与登记死因相容性规则','age-cause-conflict':'年龄与登记死因相容性规则','invalid-age':'年龄必须位于允许范围','missing-cause-or-code':'根本死因或编码为空','possible-duplicate-person-date':'姓名、性别、年龄、城市、区县、死亡日期相同的候选重复','age-distribution-outlier':'IsolationForest年龄分布异常候选'}
        checks=[{'rule':rule,'definition':definition,'matches':sum(rule in d['rules'] for d in defects),'checkedRecords':len(df)} for rule,definition in definitions.items()]
        return result('death-rules-isolation-forest-v1',checked=len(df),checks=checks,defects=defects[:200],defectCount=len(defects),assumptions=['anomaly candidates require review; detection >=98% requires labeled external validation'])
    if action=='cause':
        from analytics_engine.chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10
        df=frame(db,'fact_death_registry',args,'death_date'); rows=[]
        for _,r in df.head(20).iterrows():
            chain=' -> '.join(str(r[k]) for k in ['cause_chain_a','cause_chain_b','cause_chain_c','cause_chain_d'] if r[k])
            inferred=infer_underlying_cause_and_icd10(db_path=db,input_chain={k:str(r['cause_chain_'+k] or '') for k in 'abcd'})
            rows.append({'certificateId':r.death_cert_id,'chain':chain,'candidate':inferred,'reviewRequired':True})
        return result('death-chain-dictionary-review-v1',rows=rows,assumptions=['candidate extraction uses local ICD dictionary; normative causal knowledge graph and replacement of manual coding require approved rules'])
    raise ValueError('UNKNOWN_CHRONIC_ANALYSIS')
