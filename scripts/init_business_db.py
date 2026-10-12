"""Compatibility schema initializer. No business demonstration data is seeded."""
import os,subprocess,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
db_path=os.environ.get('APP_BUSINESS_DB_PATH') or str(ROOT/'app_business.db')
def init_db():
 subprocess.run(['node',str(ROOT/'scripts/migrate.cjs')],cwd=ROOT,env={**os.environ,'APP_BUSINESS_DB_PATH':db_path},check=True)
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();db_path=str(args.output.resolve());init_db()
