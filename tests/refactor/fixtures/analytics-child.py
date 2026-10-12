import argparse,json,time,sys
p=argparse.ArgumentParser()
p.add_argument('--task');p.add_argument('--args');p.add_argument('--db');p.add_argument('--domain');p.add_argument('--dataset-id');p.add_argument('--dataset-ref');p.add_argument('--run-id');p.add_argument('--protocol');a=p.parse_args();args=json.loads(a.args)
if args.get('fork'):
 import subprocess
 subprocess.Popen([sys.executable,'-c',"import signal,time,pathlib;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(1);pathlib.Path("+repr(args['childOutput'])+").write_text('survived');time.sleep(10)"])
 print('spawned',file=sys.stderr,flush=True)
if args.get('delay'):time.sleep(args['delay'])
if args.get('mode')=='overflow':print('x'*100000);sys.exit(0)
if args.get('mode')=='stderr':sys.stderr.write('x'*100000);sys.stderr.flush();time.sleep(1)
if args.get('mode')=='invalid':print('{"payload":NaN}');sys.exit(0)
if args.get('mode')=='noise':print('unstructured log')
ref=json.loads(a.dataset_ref)
result={'schemaVersion':'1','runId':a.run_id,'domain':a.domain,'status':'SUCCESS','method':'controlled-runner-fixture','datasets':[ref],'payload':{'type':'RUNNER_FIXTURE','value':args.get('value',0)*2,'datasetId':a.dataset_id},'metrics':{},'qualityFlags':[]}
if args.get('mode')=='wrong-run':result['runId']='different'
print(json.dumps(result,allow_nan=False))
