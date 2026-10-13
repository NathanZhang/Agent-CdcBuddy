"""Preview or remove only registered, inactive, unmodified Mock snapshots."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from analytics_engine.mock_lifecycle import cleanup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-dir', type=Path, required=True)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument('--dataset-id')
    selection.add_argument('--expired', action='store_true')
    parser.add_argument('--apply', action='store_true', help='Default is a non-destructive preview')
    parser.add_argument('--active-manifest', type=Path, help='Manifest currently configured by the running deployment')
    args = parser.parse_args()
    try:
        results = cleanup(args.audit_dir, args.dataset_id, args.expired, args.apply, args.active_manifest)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    print(json.dumps({'apply': args.apply, 'results': results}, ensure_ascii=False, indent=2))
    return 1 if any(r['status'] == 'REFUSED' for r in results) else 0


if __name__ == '__main__':
    sys.exit(main())
