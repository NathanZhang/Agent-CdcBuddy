import importlib
import importlib.util
import os
import sys
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ANALYTICS_DIR = PROJECT_ROOT / "analytics_engine"


@contextmanager
def temporary_environment(name: str, value: str):
    original = os.environ.get(name)
    os.environ[name] = value
    try:
        yield
    finally:
        if original is None:
            os.environ.pop(name, None)
        else:
            os.environ[name] = original


class AnalyticsImportTests(unittest.TestCase):
    def test_lstm_predictor_imports_without_annotation_name_errors(self) -> None:
        sys.path.insert(0, str(ANALYTICS_DIR))
        try:
            importlib.import_module("lstm_predictor")
        finally:
            sys.path.pop(0)

    def test_business_database_initializer_honors_runtime_path(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_dir:
            expected_path = Path(temporary_dir) / "app_business.db"
            with temporary_environment("APP_BUSINESS_DB_PATH", str(expected_path)):
                module_path = PROJECT_ROOT / "scripts" / "init_business_db.py"
                spec = importlib.util.spec_from_file_location("init_business_db_test", module_path)
                self.assertIsNotNone(spec)
                self.assertIsNotNone(spec.loader)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)

                self.assertEqual(Path(module.db_path), expected_path)
                module.init_db()
                self.assertTrue(expected_path.is_file())


if __name__ == "__main__":
    unittest.main()
