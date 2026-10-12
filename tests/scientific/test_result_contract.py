import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'analytics_engine'))
from contracts.result import SkillResult
class ResultContractTests(unittest.TestCase):
    def sample(self):
        return {'schemaVersion':'1','runId':'python-test','domain':'env','status':'SUCCESS','method':'water-summary-v1','datasets':[{'id':'env-fixture','domain':'env','origin':'mock','version':'1','asOf':'2026-08-31','schemaVersion':'1'}],'payload':{'samples':3},'metrics':{},'qualityFlags':[]}
    def test_actual_payload_and_origin_retained(self):
        result=SkillResult.model_validate(self.sample()).model_dump()
        self.assertEqual(result['payload'],{'samples':3})
        self.assertEqual(result['datasets'][0]['origin'],'mock')
    def test_invalid_success_and_unvalidated_metrics_rejected(self):
        invalid=self.sample(); invalid['payload']=None
        with self.assertRaises(ValueError): SkillResult.model_validate(invalid)
        invalid=self.sample(); invalid['metrics']={'accuracy':{'value':0.965,'evaluationKind':'unvalidated','datasetIds':['env-fixture'],'definition':'unmeasured'}}
        with self.assertRaises(ValueError): SkillResult.model_validate(invalid)
    def test_nonfinite_payload_rejected(self):
        invalid=self.sample(); invalid['payload']={'metric':float('nan')}
        with self.assertRaises(ValueError): SkillResult.model_validate(invalid)
