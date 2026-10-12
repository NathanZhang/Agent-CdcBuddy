#!/usr/bin/env bash
set -euo pipefail
npm run lint
./node_modules/.bin/tsc --noEmit --incremental false
npm test
