#!/usr/bin/env python3
"""Generate isolated sources and an explicit demo-only workflow configuration."""
import argparse
import json
from pathlib import Path
from mock_bundle import generate_bundle


def write_simulation_config(output):
    output = Path(output).resolve()
    value = {'purpose': 'requirement-acceptance-simulation',
             'manifestPath': str(output / 'manifest.json'),
             'businessPath': str(output / 'simulation-business.db')}
    (output / 'simulation.json').write_text(json.dumps(value, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--audit-dir', type=Path)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()
    generate_bundle(args.output_dir, args.seed, 'requirement-acceptance', args.audit_dir, vector_profile='scientific-dag')
    write_simulation_config(args.output_dir)
    print(f'Acceptance bundle: {args.output_dir.resolve()}')
