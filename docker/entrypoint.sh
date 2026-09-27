#!/bin/sh
set -eu

ACTIVE_DOMAIN="${AGENT_DOMAIN:-${NEXT_PUBLIC_AGENT_DOMAIN:-vector}}"
export AGENT_DOMAIN="$ACTIVE_DOMAIN"

# 检查并初始化业务持久化数据库
APP_BUSINESS_DB_PATH="${APP_BUSINESS_DB_PATH:-/app/data/app_business.db}"
export APP_BUSINESS_DB_PATH
mkdir -p "$(dirname "$APP_BUSINESS_DB_PATH")"

if [ ! -s "$APP_BUSINESS_DB_PATH" ]; then
  echo "[ENTRYPOINT INFO] 正在初始化业务持久化数据库: $APP_BUSINESS_DB_PATH"
  python3 /app/scripts/init_business_db.py
fi

# 仅检查或初始化当前容器所属领域的事实底座，避免跨领域写入。
case "$ACTIVE_DOMAIN" in
  vector)
    if [ ! -f /app/vector_monitoring.db ]; then
      echo "[ENTRYPOINT WARN] /app/vector_monitoring.db 未检测到挂载。" >&2
    fi
    ;;
  foodborne)
    if [ ! -f /app/foodborne_monitoring.db ] && [ -f /app/scripts/init_foodborne_mock.py ]; then
      echo "[ENTRYPOINT INFO] 正在初始化食源性疾病监测底座: foodborne_monitoring.db"
      python3 /app/scripts/init_foodborne_mock.py
    fi
    ;;
  env)
    if [ ! -f /app/env_monitoring.db ] && [ -f /app/scripts/init_env_mock.py ]; then
      echo "[ENTRYPOINT INFO] 正在初始化环境健康监测底座: env_monitoring.db"
      python3 /app/scripts/init_env_mock.py
    fi
    ;;
  chronic)
    if [ ! -f /app/chronic_monitoring.db ] && [ -f /app/scripts/init_chronic_mock.py ]; then
      echo "[ENTRYPOINT INFO] 正在初始化死因慢病伤害监测底座: chronic_monitoring.db"
      python3 /app/scripts/init_chronic_mock.py
    fi
    ;;
  *)
    echo "[ENTRYPOINT ERROR] 不支持的 AGENT_DOMAIN: $ACTIVE_DOMAIN" >&2
    exit 1
    ;;
esac

echo "[ENTRYPOINT INFO] 启动 Next.js 独立运行服务..."
exec node /app/server.js
