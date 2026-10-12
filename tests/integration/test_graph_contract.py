import unittest,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class GraphContracts(unittest.TestCase):
 def test_registry_has_no_duplicate_hub_and_rejects_unknown_graph(self):
  from analytics_engine.graphs.registry import GRAPH_TASKS,get_graph
  self.assertEqual(len(set(GRAPH_TASKS.values())),3)
  with self.assertRaises(ValueError):get_graph('invented')
 def test_task_arguments_reject_nonfinite_and_nonobject(self):
  from analytics_engine.contracts.task import parse_task_args
  for text in ['[]','{"n":NaN}','{bad','{"n":1e999}']:
   with self.assertRaises(ValueError):parse_task_args(text)
 def test_actual_cli_protocol_and_explicit_dataset(self):
  from analytics_engine.contracts.result import SkillResult
  run='python-protocol-test'
  proc=subprocess.run([sys.executable,str(ROOT/'analytics_engine/engine.py'),'--task','water_safety_eval','--domain','env','--dataset-id','env-monitoring','--protocol','skill-result-v1','--run-id',run],capture_output=True,text=True,cwd=ROOT)
  self.assertEqual(proc.returncode,0,proc.stderr[-1000:]);result=SkillResult.model_validate(json.loads(proc.stdout))
  self.assertEqual(result.runId,run);self.assertEqual(result.datasets[0].origin,'mock');self.assertGreater(result.payload['totalSamples'],0)
 def test_protocol_cannot_spoof_dataset_origin(self):
  ref={'id':'env-monitoring','domain':'env','origin':'observed','version':'existing-snapshot-2026-10-12','asOf':'2026-10-12','schemaVersion':'1'}
  proc=subprocess.run([sys.executable,str(ROOT/'analytics_engine/engine.py'),'--task','water_safety_eval','--protocol','skill-result-v1','--run-id','spoof-test','--dataset-id','env-monitoring','--dataset-ref',json.dumps(ref)],capture_output=True,text=True,cwd=ROOT)
  self.assertEqual(proc.returncode,2);self.assertIn('metadata mismatch',proc.stderr)
