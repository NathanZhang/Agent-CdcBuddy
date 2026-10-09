#!/bin/sh
set -eu

ACTIVE_DOMAIN="${AGENT_DOMAIN:-${NEXT_PUBLIC_AGENT_DOMAIN:-vector}}"
export AGENT_DOMAIN="$ACTIVE_DOMAIN"

# 事实数据库是只读生产数据，必须由部署系统明确挂载。
case "$ACTIVE_DOMAIN" in
  vector) FACT_DATABASE=/app/vector_monitoring.db ;;
  foodborne) FACT_DATABASE=/app/foodborne_monitoring.db ;;
  env) FACT_DATABASE=/app/env_monitoring.db ;;
  chronic) FACT_DATABASE=/app/chronic_monitoring.db ;;
  *)
    echo "[ENTRYPOINT ERROR] 不支持的 AGENT_DOMAIN: $ACTIVE_DOMAIN" >&2
    exit 1
    ;;
esac

if [ ! -s "$FACT_DATABASE" ]; then
  echo "[ENTRYPOINT ERROR] Required fact database not mounted: $FACT_DATABASE" >&2
  exit 1
fi

# 检查并初始化业务持久化数据库。
APP_BUSINESS_DB_PATH="${APP_BUSINESS_DB_PATH:-/app/data/app_business.db}"
export APP_BUSINESS_DB_PATH
mkdir -p "$(dirname "$APP_BUSINESS_DB_PATH")"

# 2.0.0 之前的向量实例共用 /app/data/app_business.db。仅当新库不存在时
# 通过 SQLite backup API 复制到领域目录，保留旧文件用于回滚，并用原子重命名
# 避免半写入文件；即使旧库仍有读写连接，也能获得一致快照。
LEGACY_BUSINESS_DB=/app/data/app_business.db
if [ "$ACTIVE_DOMAIN" = vector ] && [ ! -s "$APP_BUSINESS_DB_PATH" ] && [ -s "$LEGACY_BUSINESS_DB" ] && [ "$APP_BUSINESS_DB_PATH" != "$LEGACY_BUSINESS_DB" ]; then
  echo "[ENTRYPOINT INFO] Migrating legacy business database to: $APP_BUSINESS_DB_PATH"
  python3 - "$LEGACY_BUSINESS_DB" "$APP_BUSINESS_DB_PATH" <<'PY'
import os
import sqlite3
import sys

source_path, target_path = sys.argv[1:]
temporary_path = f"{target_path}.migrating.{os.getpid()}"
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
target = sqlite3.connect(temporary_path)
source.backup(target)
source_check = source.execute("pragma quick_check").fetchone()[0]
target_check = target.execute("pragma quick_check").fetchone()[0]
target.close()
source.close()
if source_check != "ok" or target_check != "ok":
    raise RuntimeError(f"SQLite integrity check failed: source={source_check}, target={target_check}")
os.replace(temporary_path, target_path)
PY
fi

if [ ! -s "$APP_BUSINESS_DB_PATH" ]; then
  echo "[ENTRYPOINT INFO] 正在初始化业务持久化数据库: $APP_BUSINESS_DB_PATH"
  python3 /app/scripts/init_business_db.py
fi

echo "[ENTRYPOINT INFO] 启动 Next.js 独立运行服务..."
exec node /app/server.js
