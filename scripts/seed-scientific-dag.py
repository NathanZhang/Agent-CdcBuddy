#!/usr/bin/env python3
"""Generate an isolated reproducible four-domain Mock bundle for the scientific DAG."""
import argparse
from pathlib import Path
from mock_bundle import generate_bundle

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--audit-dir', type=Path)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--retention-days', type=int, default=7)
    args = parser.parse_args()
    generate_bundle(args.output_dir, args.seed, 'scientific-dag', args.audit_dir,
                    args.retention_days, vector_profile='scientific-dag')
    print(f'Scientific DAG Mock bundle: {args.output_dir}')
