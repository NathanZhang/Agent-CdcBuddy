import unittest,sqlite3,tempfile,subprocess,os,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class Deployment(unittest.TestCase):
 def test_migrations_once_backup_restore_preserves_sessions_jobs_tickets(self):
  with tempfile.TemporaryDirectory() as tmp:
   db=Path(tmp)/'b.db';env={**os.environ,'APP_BUSINESS_DB_PATH':str(db),'DEPLOYMENT_TIER':'local'}
   processes=[subprocess.Popen(['node','scripts/migrate.cjs'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE) for _ in range(2)]
   for proc in processes:out,err=proc.communicate();self.assertEqual(proc.returncode,0,err.decode())
   c=sqlite3.connect(db);self.assertEqual(c.execute('SELECT COUNT(*) FROM _cdc_migrations').fetchone()[0],4)
   c.execute("INSERT INTO biz_chat_sessions(session_id,user_id,user_name,user_role,domain,title,created_at,updated_at) VALUES('s','u','fixture','CITY_EXPERT','vector','fixture','2023-01-01','2023-01-01')")
   c.execute("INSERT INTO biz_jobs(job_id,user_id,domain,idempotency_key,input_json,principal_json,status,created_at) VALUES('j','u','vector','fixture','{}','{}','WAITING_REVIEW',1)")
   c.execute("INSERT INTO biz_workflow_tickets VALUES('t','j','u','vector','X','Y','OPEN','u',1,NULL)");c.commit();c.close()
   backup=Path(tmp)/'snapshot';r=subprocess.run([sys.executable,'scripts/backup-business.py','--db',str(db),'--output-dir',str(backup)],cwd=ROOT,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr)
   with sqlite3.connect(backup/'business.db') as restored:
    self.assertEqual(restored.execute('SELECT title FROM biz_chat_sessions').fetchone()[0],'fixture');self.assertEqual(restored.execute('SELECT status FROM biz_jobs').fetchone()[0],'WAITING_REVIEW');self.assertEqual(restored.execute('SELECT status FROM biz_workflow_tickets').fetchone()[0],'OPEN')
 def test_pilot_never_generates_missing_fact_and_demo_generation_is_explicit(self):
  with tempfile.TemporaryDirectory() as tmp:
   target=Path(tmp)/'food.db';command=[sys.executable,'scripts/seed-demo.py','--domain','foodborne','--output',str(target),'--seed','7']
   denied=subprocess.run(command,cwd=ROOT,env={**os.environ,'DEPLOYMENT_TIER':'pilot'},capture_output=True);self.assertNotEqual(denied.returncode,0);self.assertFalse(target.exists())
   done=subprocess.run(command,cwd=ROOT,env={**os.environ,'DEPLOYMENT_TIER':'demo'},capture_output=True);self.assertEqual(done.returncode,0,done.stderr.decode());self.assertTrue(target.is_file())
