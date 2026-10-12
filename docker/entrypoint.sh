#!/bin/sh
set -eu
cd /app
export DEPLOYMENT_TIER="${DEPLOYMENT_TIER:-pilot}"
export AGENT_DOMAIN="${AGENT_DOMAIN:-${NEXT_PUBLIC_AGENT_DOMAIN:-vector}}"
export APP_BUSINESS_DB_PATH="${APP_BUSINESS_DB_PATH:-/app/data/app_business.db}"
case "$DEPLOYMENT_TIER" in local|demo|pilot) ;; *) echo 'Invalid DEPLOYMENT_TIER' >&2; exit 2;; esac
case "$AGENT_DOMAIN" in vector|foodborne|env|chronic) ;; *) echo 'Invalid AGENT_DOMAIN' >&2; exit 2;; esac

# Resolve the same active source as the application; never seed missing facts.
FACT_DATABASE="$(node - "$AGENT_DOMAIN" <<'JS'
const fs=require('fs'),path=require('path');
const domain=process.argv[2];
const manifest=process.env.DATASET_MANIFEST_PATH || path.join(process.cwd(),'config/datasets.json');
const matches=JSON.parse(fs.readFileSync(manifest,'utf8')).filter(item=>item.domain===domain);
if(matches.length!==1)throw new Error('Expected one configured dataset for '+domain);
const selected=process.env['DATASET_'+domain.toUpperCase()+'_PATH'] || matches[0].path;
console.log(path.resolve(path.dirname(manifest),selected));
JS
)"
if [ ! -s "$FACT_DATABASE" ]; then
  echo "[ENTRYPOINT ERROR] Required fact database not mounted: $FACT_DATABASE" >&2
  exit 1
fi

mkdir -p "$(dirname "$APP_BUSINESS_DB_PATH")"
LEGACY_BUSINESS_DB=/app/data/app_business.db
if [ "$AGENT_DOMAIN" = vector ] && [ -s "$LEGACY_BUSINESS_DB" ] && [ "$APP_BUSINESS_DB_PATH" != "$LEGACY_BUSINESS_DB" ]; then
  # Stop old writers before upgrading; preserve the original pair for rollback.
  python3 - "$LEGACY_BUSINESS_DB" "$APP_BUSINESS_DB_PATH" <<'PY'
import fcntl
import os
import sqlite3
import sys

source_path, target_path = sys.argv[1:]
with open(target_path + '.migration.lock', 'a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    if not os.path.exists(target_path) or os.path.getsize(target_path) == 0:
        pairs = [(source_path, target_path)]
        if os.path.isfile(source_path + '.checkpoints'):
            pairs.insert(0, (source_path + '.checkpoints', target_path + '.checkpoints'))
        staged = []
        try:
            for source_file, target_file in pairs:
                temporary = target_file + '.migrating.' + str(os.getpid())
                staged.append((temporary, target_file))
                with sqlite3.connect('file:' + source_file + '?mode=ro', uri=True) as source:
                    with sqlite3.connect(temporary) as target:
                        source.backup(target)
                        if source.execute('pragma quick_check').fetchone()[0] != 'ok' or target.execute('pragma quick_check').fetchone()[0] != 'ok':
                            raise RuntimeError('Legacy SQLite integrity check failed')
                os.chmod(temporary, 0o600)
            # Business file is published last, so competing starts cannot see half a pair.
            for temporary, target_file in staged:
                os.replace(temporary, target_file)
        finally:
            for temporary, _ in staged:
                if os.path.exists(temporary):
                    os.unlink(temporary)
PY
fi

# Use only versioned migrations; no historical business/demo initializer.
node /app/migrate.cjs
if [ "${CDC_PROCESS:-web}" = worker ]; then exec node /app/job-worker.cjs; fi
exec node /app/server.js
