"""Release merge guards: active-source isolation and legacy migration preservation."""
import hashlib
import json
import os
import re
import shutil
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]

class ReleaseMerge(unittest.TestCase):
    @unittest.skipUnless(shutil.which('docker'), 'Docker Compose CLI not installed')
    def test_production_compose_preserves_ports_domains_and_workers(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'.env').write_text('')
            env={**os.environ,'DEPLOY_DIR':tmp}
            for key in ('VECTOR_PORT','FOODBORNE_PORT','ENV_PORT','CHRONIC_PORT'):
                env.pop(key,None)
            result=subprocess.run(['docker','compose','-f',str(ROOT/'compose.production.yml'),
                                   'config','--format','json'],env=env,cwd=ROOT,
                                  capture_output=True,text=True,timeout=15)
            self.assertEqual(result.returncode,0,result.stderr)
            services=json.loads(result.stdout)['services']
            for domain,port in [('vector',32112),('foodborne',32113),('env',32114),('chronic',32115)]:
                web=services[domain+'-agent']
                self.assertEqual(web['ports'][0]['published'],str(port))
                self.assertEqual(web['environment']['AGENT_DOMAIN'],domain)
                self.assertEqual(web['environment']['APP_BUSINESS_DB_PATH'],'/app/data/'+domain+'/app_business.db')
                worker=services.get(domain+'-worker')
                self.assertIsNotNone(worker,domain+' lacks a worker for its isolated queue')
                self.assertEqual(worker['environment']['CDC_PROCESS'],'worker')
                self.assertEqual(worker['environment']['AGENT_DOMAIN'],domain)
                self.assertEqual(worker['environment']['APP_BUSINESS_DB_PATH'],web['environment']['APP_BUSINESS_DB_PATH'])
                self.assertFalse(worker.get('ports'))

    def test_remote_deploy_uses_entrypoint_migration_and_public_readiness(self):
        script=(ROOT/'scripts/deploy/deploy-remote.ps1').read_text()
        self.assertLess(script.index('docker stop --time 30 agent-cdcbuddy'),script.index('docker compose --env-file deploy.env'))
        self.assertNotIn('source.backup(target)',script,'Deployment must not preempt the entrypoint paired migration')
        self.assertIn("@('/', '/api/health/ready')",script)
        self.assertNotIn("@('/', '/api/skills')",script)

    def run_entrypoint(self, directory, domain='vector', override=None):
        root = Path(directory)
        (root/'config').mkdir(exist_ok=True)
        (root/'config/datasets.json').write_text(json.dumps([
            {'id': domain, 'domain': domain, 'path': '../'+domain+'_monitoring.db'}
        ]))
        (root/'migrate.cjs').write_text("require('fs').writeFileSync('migration-ran','yes')")
        (root/'server.js').write_text("console.log(JSON.stringify({domain:process.env.AGENT_DOMAIN,tier:process.env.DEPLOYMENT_TIER}))")
        baseline=os.environ.get('CDC_ENTRYPOINT_BASELINE')
        source_script=(subprocess.check_output(['git','show',baseline+':docker/entrypoint.sh'],cwd=ROOT).decode()
                       if baseline else (ROOT/'docker/entrypoint.sh').read_text())
        script=re.sub(r'/app(?![A-Za-z0-9_])',str(root),source_script)
        (root/'entrypoint.sh').write_text(script)
        env={**os.environ, 'AGENT_DOMAIN':domain, 'DEPLOYMENT_TIER':'pilot',
             'APP_BUSINESS_DB_PATH':str(root/'data/vector/app_business.db')}
        env.pop('DATASET_MANIFEST_PATH',None)
        for item in ('vector','foodborne','env','chronic'):
            env.pop('DATASET_'+item.upper()+'_PATH',None)
        if override:env['DATASET_'+domain.upper()+'_PATH']=str(override)
        return subprocess.run(['sh',str(root/'entrypoint.sh')],cwd=root,env=env,
                              capture_output=True,text=True,timeout=15)

    def test_missing_active_source_fails_before_business_initialization(self):
        with tempfile.TemporaryDirectory() as tmp:
            result=self.run_entrypoint(tmp,'env')
            self.assertNotEqual(result.returncode,0)
            self.assertIn('Required fact database not mounted',result.stderr)
            self.assertFalse((Path(tmp)/'migration-ran').exists())
            self.assertFalse((Path(tmp)/'env_monitoring.db').exists())

    def test_custom_source_path_does_not_require_other_domain_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            source=Path(tmp)/'explicit-fact.db'
            with sqlite3.connect(source) as db:db.execute('create table probe(value text)')
            before=hashlib.sha256(source.read_bytes()).hexdigest()
            result=self.run_entrypoint(tmp,'env',source)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual(json.loads(result.stdout.splitlines()[-1]),{'domain':'env','tier':'pilot'})
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),before)
            self.assertFalse((Path(tmp)/'vector_monitoring.db').exists())

    def test_legacy_business_and_checkpoint_are_copied_with_originals_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'data').mkdir()
            with sqlite3.connect(root/'vector_monitoring.db') as db:db.execute('create table fact_probe(value text)')
            source=root/'data/app_business.db'
            checkpoint=Path(str(source)+'.checkpoints')
            for path,value in [(source,'business-preserved'),(checkpoint,'checkpoint-preserved')]:
                with sqlite3.connect(path) as db:
                    db.execute('create table migration_probe(value text)')
                    db.execute('insert into migration_probe values (?)',(value,))
            original={path:hashlib.sha256(path.read_bytes()).hexdigest() for path in (source,checkpoint)}
            result=self.run_entrypoint(tmp)
            self.assertEqual(result.returncode,0,result.stderr)
            for suffix,value in [('', 'business-preserved'),('.checkpoints','checkpoint-preserved')]:
                self.assertTrue((root/('data/vector/app_business.db'+suffix)).is_file(),suffix)
                with sqlite3.connect(root/('data/vector/app_business.db'+suffix)) as db:
                    self.assertEqual(db.execute('select value from migration_probe').fetchone()[0],value)
            for path,digest in original.items():self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),digest)
            with sqlite3.connect(root/'data/vector/app_business.db') as db:
                db.execute("update migration_probe set value='new-database-preserved'")
            again=self.run_entrypoint(tmp)
            self.assertEqual(again.returncode,0,again.stderr)
            with sqlite3.connect(root/'data/vector/app_business.db') as db:
                self.assertEqual(db.execute('select value from migration_probe').fetchone()[0],'new-database-preserved')

if __name__=='__main__':unittest.main()
