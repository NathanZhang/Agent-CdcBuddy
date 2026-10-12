import sys
from suite_runner import run_suites
if __name__ == '__main__':
    sys.exit(run_suites('scientific', sys.argv[1:]))
