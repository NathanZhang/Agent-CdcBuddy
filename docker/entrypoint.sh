#!/bin/sh
set -eu

if [ ! -f /app/vector_monitoring.db ]; then
  echo "ERROR: /app/vector_monitoring.db is not mounted" >&2
  exit 1
fi

APP_BUSINESS_DB_PATH="${APP_BUSINESS_DB_PATH:-/app/data/app_business.db}"
export APP_BUSINESS_DB_PATH
mkdir -p "$(dirname "$APP_BUSINESS_DB_PATH")"

if [ ! -s "$APP_BUSINESS_DB_PATH" ]; then
  echo "Initializing $APP_BUSINESS_DB_PATH"
  python3 /app/scripts/init_business_db.py
fi

exec node /app/server.js
