#!/bin/sh
set -eu
export DEPLOYMENT_TIER="${DEPLOYMENT_TIER:-pilot}"
export APP_BUSINESS_DB_PATH="${APP_BUSINESS_DB_PATH:-/app/data/app_business.db}"
case "$DEPLOYMENT_TIER" in local|demo|pilot) ;; *) echo 'Invalid DEPLOYMENT_TIER' >&2; exit 2;; esac
mkdir -p "$(dirname "$APP_BUSINESS_DB_PATH")"
node /app/migrate.cjs
# Facts must be mounted explicitly; no startup generator or synthetic business seeds.
if [ "${CDC_PROCESS:-web}" = worker ]; then exec node /app/job-worker.cjs; fi
exec node /app/server.js
