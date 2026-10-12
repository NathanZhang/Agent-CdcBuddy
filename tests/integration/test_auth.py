"""Actual HTTP identity matrix against an isolated Next process; no production accounts."""
import unittest,tempfile,subprocess,os,json,time,urllib.request,urllib.error,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
class HttpAuth(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.generated={p:p.read_bytes() for p in [ROOT/'next-env.d.ts',ROOT/'tsconfig.json']};cls.tmp=tempfile.TemporaryDirectory();cls.base='http://localhost:9681';cls.env={**os.environ,'DEPLOYMENT_TIER':'pilot','AGENT_DOMAIN':'vector','APP_ORIGIN':cls.base,'APP_BUSINESS_DB_PATH':str(Path(cls.tmp.name)/'business.db'),'NEXT_BUILD_DIR':'.next_auth_http_'+Path(cls.tmp.name).name}
  for name,role,scope,review in [('viewer','PUBLIC_VIEWER',{},False),('expert','CITY_EXPERT',{'city':'郑州市'},True),('collector','DISTRICT_SURVEILLANCE',{'city':'郑州市','district':'金水区'},False)]:
   file=Path(cls.tmp.name)/'identity.json';file.write_text(json.dumps({'username':name,'password':'isolated-test-pass-12345','role':role,'organizationId':'test','domainGrants':['vector'],'jurisdiction':scope,'professionalReview':review}));file.chmod(0o600)
   proc=subprocess.run(['node','scripts/create-user.cjs'],cwd=ROOT,env={**cls.env,'CDC_IDENTITY_FILE':str(file)},capture_output=True,text=True);assert proc.returncode==0,proc.stderr
  cls.log=open(Path(cls.tmp.name)/'server.log','w');cls.server=subprocess.Popen(['node','node_modules/next/dist/bin/next','dev','-p','9681'],cwd=ROOT,env=cls.env,stdout=cls.log,stderr=cls.log)
  for _ in range(90):
   try:
    cls.request('/api/auth/me');break
   except (ConnectionError,OSError):time.sleep(.5)
  else:raise RuntimeError('Auth HTTP server did not start')
 @classmethod
 def tearDownClass(cls):
  cls.server.terminate()
  try:cls.server.wait(timeout=10)
  except subprocess.TimeoutExpired:cls.server.kill();cls.server.wait()
  cls.log.close();import shutil;shutil.rmtree(ROOT/cls.env['NEXT_BUILD_DIR'],ignore_errors=True);cls.tmp.cleanup()
  for p,contents in cls.generated.items():p.write_bytes(contents)
 @classmethod
 def request(cls,path,body=None,cookie=None,csrf=None,origin=True):
  headers={'Content-Type':'application/json'}
  if origin:headers['Origin']=cls.base
  if cookie:headers['Cookie']=cookie
  if csrf:headers['X-CSRF-Token']=csrf
  req=urllib.request.Request(cls.base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
  try:r=urllib.request.urlopen(req,timeout=90)
  except urllib.error.HTTPError as e:r=e
  return r.status,dict(r.headers),json.loads(r.read())
 def auth(self,name):
  status,headers,body=self.request('/api/auth/login',{'username':name,'password':'isolated-test-pass-12345'});self.assertEqual(status,200);cookie=headers.get('Set-Cookie') or headers.get('set-cookie');self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=strict',cookie);return cookie.split(';')[0],body['csrfToken']
 def test_anonymous_all_business_adapters_require_identity(self):
  for path,body in [('/api/sessions',{}),('/api/v1/mobile/record',{'city':'郑州市'}),('/api/jobs',{}),('/api/skills',{'skillId':'skill_monitoring_data_table','args':{}}),('/api/agent/stream-dispatch',{'promptText':'查询'})]:
   with self.subTest(path=path):self.assertEqual(self.request(path,body)[0],401)
 def test_public_body_cannot_promote_role_and_csrf_required(self):
  cookie,csrf=self.auth('viewer');body={'skillId':'skill_meta_custom_builder','args':{'skillName':'bad','sqlQuery':'SELECT COUNT(*) n FROM fact_monitoring'},'userRole':'PROVINCIAL_ADMIN'}
  self.assertEqual(self.request('/api/skills',body,cookie,csrf)[0],403)
  self.assertEqual(self.request('/api/skills',body,cookie,None)[0],403)
  self.assertEqual(self.request('/api/skills',body,cookie,csrf,False)[0],403)
 def test_city_and_district_conflicts_rejected_before_llm(self):
  cookie,csrf=self.auth('expert');self.assertEqual(self.request('/api/skills',{'skillId':'skill_monitoring_data_table','args':{'sql':'SELECT COUNT(*) n FROM fact_monitoring','city':'南阳市'}},cookie,csrf)[0],403)
  cookie,csrf=self.auth('collector');self.assertEqual(self.request('/api/v1/mobile/record',{'city':'郑州市','district':'二七区','category':'蚊','speciesName':'白纹伊蚊','captureCount':0},cookie,csrf)[0],403)
 def test_logout_invalidates_cookie_and_originless_login_denied(self):
  self.assertEqual(self.request('/api/auth/login',{'username':'viewer','password':'isolated-test-pass-12345'},origin=False)[0],403)
  cookie,csrf=self.auth('viewer');self.assertEqual(self.request('/api/auth/logout',{},cookie,csrf)[0],200);self.assertEqual(self.request('/api/auth/me',cookie=cookie)[0],401)
