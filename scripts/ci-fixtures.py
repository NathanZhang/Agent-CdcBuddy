"""CI engineering fixtures. Every domain, including vector, is explicitly Mock."""
import argparse
from pathlib import Path


def main():
    from mock_bundle import generate_bundle
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--audit-dir', type=Path)
    parser.add_argument('--retention-days', type=int, default=7)
    args = parser.parse_args()
    generate_bundle(args.output_dir, args.seed, audit_dir=args.audit_dir, retention_days=args.retention_days)
    print('CI fixtures generated: all origins mock')


if __name__ == '__main__':
    main()
