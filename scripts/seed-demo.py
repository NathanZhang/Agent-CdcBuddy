"""Explicit Mock generator; never invoked by startup."""
import argparse
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--domain', choices=['vector', 'foodborne', 'env', 'chronic', 'all'], required=True)
    destination = parser.add_mutually_exclusive_group(required=True)
    destination.add_argument('--output', type=Path)
    destination.add_argument('--output-dir', type=Path)
    parser.add_argument('--seed', type=int, required=True)
    parser.add_argument('--audit-dir', type=Path)
    parser.add_argument('--retention-days', type=int, default=7)
    args = parser.parse_args()
    if os.environ.get('DEPLOYMENT_TIER') != 'demo':
        parser.error('Explicit DEPLOYMENT_TIER=demo required; pilot never seeds facts')
    if args.domain == 'all':
        if args.output_dir is None:
            parser.error('--domain all requires --output-dir')
        from mock_bundle import generate_bundle
        generate_bundle(args.output_dir, args.seed, kind='demo', audit_dir=args.audit_dir, retention_days=args.retention_days)
        print(f'Mock demo bundle generated: {args.output_dir.resolve()}')
    else:
        if args.output is None:
            parser.error('Single-domain generation requires --output')
        command = [sys.executable, str(Path(__file__).parent / f'init_{args.domain}_mock.py'),
                   '--output', str(args.output), '--seed', str(args.seed), '--retention-days', str(args.retention_days)]
        if args.audit_dir:
            command += ['--audit-dir', str(args.audit_dir)]
        subprocess.run(command, check=True)


if __name__ == '__main__':
    main()
