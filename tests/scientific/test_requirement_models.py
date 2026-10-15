"""Tests of actual fitted models and numerical invariants, not input availability."""
import unittest
import numpy as np
from analytics_engine.assessments.common import forecast, classifier
import pandas as pd

class RequirementModels(unittest.TestCase):
    def test_recursive_holdout_does_not_train_on_future_targets_or_covariates(self):
        periods=[f'{2023+i//12}-{i%12+1:02d}' for i in range(30)]
        values=10+np.sin(np.arange(30)*np.pi/6); cov=np.column_stack([np.arange(30),np.ones(30)])
        for method in ['arima','lstm','gbdt']:
            a=forecast(periods,values,3,method,cov)
            future=values.copy();future[-6:]+=100;changed=cov.copy();changed[-6:]+=500
            b=forecast(periods,future,3,method,changed)
            self.assertEqual([r['predicted'] for r in a['validation']['rows']],[r['predicted'] for r in b['validation']['rows']],method)
            self.assertEqual(len(a['forecasts']),3);self.assertEqual(a['forecasts'][0]['period'],'2025-07')
            self.assertEqual(a['validation']['trainEnd'],'2024-12')
            self.assertTrue(all(np.isfinite(r['value']) and r['value']>=0 for r in a['forecasts']))
    def test_classifier_measures_heldout_outcomes_and_exposes_tree(self):
        d=pd.DataFrame({'age':np.arange(80),'equipment':np.arange(80)%2,'target':np.arange(80)%2})
        _,_,r=classifier(d,['age','equipment'],'target','tree')
        self.assertEqual(r['validation']['trainRows'],60);self.assertEqual(r['validation']['testRows'],20)
        self.assertGreaterEqual(r['validation']['accuracy'],.8)
        self.assertIn('equipment',r['decisionTree'])
    def test_insufficient_and_nonfinite_series_are_not_fake_forecasts(self):
        for values in [[1]*10,[1]*19+[float('nan')]]:
            with self.assertRaises(ValueError):forecast([str(i) for i in range(len(values))],values)
        with self.assertRaises(ValueError):forecast(['2024-01']*20,[1]*20,0)

    def test_cause_graph_never_approves_unknown_relationships(self):
        from analytics_engine.chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10
        known=infer_underlying_cause_and_icd10(input_chain={'a':'呼吸衰竭','b':'肺癌'},mode='graph')
        self.assertEqual(known['status'],'REVIEW_REQUIRED')
        self.assertIsNone(known['inferredUnderlyingCause'])
        self.assertEqual(len(known['causeGraph']['reportedEdges']),1)
        unknown=infer_underlying_cause_and_icd10(input_chain={'a':'脑出血','b':'肺癌'},mode='graph')
        self.assertIsNone(unknown['inferredUnderlyingCause'])
        self.assertFalse(unknown['causeGraph']['selectionSupported'])
        self.assertIsNone(unknown['accuracyRate'])

    def test_quality_reports_zero_matches_as_executed_rules_and_keeps_candidates(self):
        from unittest.mock import patch
        from analytics_engine.assessments.chronic import assess
        base={'patient_name':'合成测试','gender':'男','age':68,'city':'郑州市','district':'金水区','death_date':'2026-08-18','cause_chain_a':'呼吸衰竭','cause_chain_b':'肺癌','cause_chain_c':'','cause_chain_d':'','underlying_cause':'肺癌','icd10_code':'C34'}
        rows=pd.DataFrame([{**base,'death_cert_id':'MOCK-A'},{**base,'death_cert_id':'MOCK-B'},{**base,'patient_name':'缺项测试','death_cert_id':'MOCK-C','underlying_cause':'','icd10_code':''}])
        with patch('analytics_engine.assessments.chronic.frame',return_value=rows):out=assess('unused',{'analysis':'quality'})
        counts={r['rule']:r['matches'] for r in out['checks']}
        self.assertEqual(counts['possible-duplicate-person-date'],2);self.assertEqual(counts['missing-cause-or-code'],1);self.assertEqual(counts['sex-cause-conflict'],0)
        self.assertTrue(all(r['checkedRecords']==3 for r in out['checks']))
        self.assertTrue(all(r['requiresReview'] for r in out['defects']))

    def test_tumor_screening_separates_registry_population_and_hypothetical_benefit(self):
        from unittest.mock import patch
        from analytics_engine.assessments.chronic import assess
        followup=pd.DataFrame([{'record_id':str(i),'monitoring_date':f'2025-{i//12+1:02d}-01','city':'郑州市','district':'金水区','age':40+i%40,'smoking':i%2,'family_history':i%3,'systolic_bp':110+i%60,'disease_name':'肿瘤' if i%3 else '糖尿病','outcome_event':i%2,'screened':1,'detected':int(i%5==0),'screening_cost_yuan':150,'treatment_cost_yuan':10000} for i in range(120)])
        registry=pd.DataFrame([{'city':'郑州市','district':'金水区','disease_name':'肺癌高危随访'},{'city':'郑州市','district':'金水区','disease_name':'糖尿病'}])
        population=pd.DataFrame([{'city':'郑州市','district':'金水区','population':100000}])
        frames={'fact_chronic_followup':followup,'fact_chronic_cases':registry,'dim_districts':population}
        with patch('analytics_engine.assessments.chronic.frame',side_effect=lambda db,table,args,date=None,**kwargs:frames[table].copy()):
            out=assess('unused',{'analysis':'screening','riskThreshold':0,'avoidedCostFraction':.25})
        self.assertEqual(out['screened'],80)
        self.assertTrue(all(r['disease_name']=='肿瘤' for r in out['highRiskList']))
        self.assertEqual(out['regionalRegistry'][0]['registeredCandidates'],1)
        self.assertEqual(out['regionalRegistry'][0]['population'],100000)
        self.assertAlmostEqual(out['detectionRate'],out['detected']/80)
        self.assertAlmostEqual(out['benefitCostRatio'],out['estimatedTreatmentCostYuan']*.25/(80*150))
        self.assertIn('hypothetical',out['assumptions'][1])
