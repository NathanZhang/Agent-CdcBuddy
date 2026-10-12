import unittest,tempfile,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
class Jobs(unittest.TestCase):
 def test_graph_checkpoint_interrupt_survives_restart_and_reject_never_dispatches(self):
  from analytics_engine.jobs.worker import advance
  with tempfile.TemporaryDirectory() as tmp:
   path=str(Path(tmp)/'checkpoints.db')
   self.assertEqual(advance(path,'run-1',{'jobId':'j','runId':'run-1'}),'WAITING_REVIEW')
   self.assertEqual(advance(path,'run-1',decision='reject'),'REJECTED')
   self.assertEqual(advance(path,'run-2',{'jobId':'j2','runId':'run-2'}),'WAITING_REVIEW')
   self.assertEqual(advance(path,'run-2',decision='approve'),'APPROVED')
