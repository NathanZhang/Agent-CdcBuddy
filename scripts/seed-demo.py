"""Explicit Mock generator; never invoked by startup."""
import argparse,os,subprocess,sys
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--domain',choices=['foodborne','env','chronic'],required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--seed',type=int,required=True);args=parser.parse_args()
if os.environ.get('DEPLOYMENT_TIER')!='demo':parser.error('Explicit DEPLOYMENT_TIER=demo required; pilot never seeds facts')
subprocess.run([sys.executable,str(Path(__file__).parent/f'init_{args.domain}_mock.py'),'--output',str(args.output),'--seed',str(args.seed)],check=True)
