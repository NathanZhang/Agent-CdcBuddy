import subprocess
import sys
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
class RunnerTests(unittest.TestCase):
    def test_unknown_selection_is_not_a_success(self):
        for runner in ['run_scientific.py', 'run_integration.py']:
            result = subprocess.run([sys.executable, str(ROOT / 'tests' / runner), 'nonexistent_suite'], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Unknown', result.stderr)
    def test_empty_selected_suite_fails(self):
        # A valid named module containing no tests is still a failure.
        result = subprocess.run([sys.executable, str(ROOT / 'tests/run_integration.py'), '__init__'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('No tests', result.stderr)
