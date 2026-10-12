"""Stop workers/reviews before snapshotting business + separate checkpoints together."""
import argparse,sqlite3,json,os
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--db',type=Path,required=True);p.add_argument('--output-dir',type=Path,required=True);args=p.parse_args();args.output_dir.mkdir(parents=True,exist_ok=False);summary={}
for source,name in [(args.db,'business.db'),(Path(str(args.db)+'.checkpoints'),'checkpoints.db')]:
 if not source.is_file():
  if name=='business.db':raise FileNotFoundError(source)
  continue
 target=args.output_dir/name
 with sqlite3.connect(source.resolve().as_uri()+'?mode=ro',uri=True) as a,sqlite3.connect(target) as b:
  a.backup(b);assert b.execute('PRAGMA integrity_check').fetchone()[0]=='ok';summary[name]={table:b.execute('SELECT COUNT(*) FROM "'+table.replace('"','""')+'"').fetchone()[0] for table, in b.execute("SELECT name FROM sqlite_master WHERE type='table'")}
 os.chmod(target,0o600)
(args.output_dir/'manifest.json').write_text(json.dumps(summary,indent=2));print(json.dumps({'backedUp':list(summary)}))
