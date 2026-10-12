"""Shared strict unittest selection; an empty run is never successful."""
import re
import sys
import unittest
from pathlib import Path

def run_suites(kind, selectors):
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    directory = Path(__file__).resolve().parent / kind
    suite = unittest.TestSuite()
    if selectors:
        for selector in selectors:
            if not re.fullmatch(r'[A-Za-z0-9_]+(?:\.py)?', selector):
                print(f'Unknown suite: {selector}', file=sys.stderr)
                return 2
            stem = selector.removesuffix('.py')
            candidates = [directory / f'{stem}.py', directory / f'test_{stem}.py']
            selected = next((p for p in candidates if p.is_file()), None)
            if not selected:
                print(f'Unknown suite: {selector}', file=sys.stderr)
                return 2
            suite.addTests(unittest.defaultTestLoader.discover(str(directory), pattern=selected.name))
    else:
        suite = unittest.defaultTestLoader.discover(str(directory), pattern='test_*.py')
    if suite.countTestCases() == 0:
        print('No tests selected', file=sys.stderr)
        return 2
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1
