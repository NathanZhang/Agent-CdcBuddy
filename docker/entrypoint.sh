#!/bin/sh
set -eu

# 检查病媒生物监测事实库
if [ ! -f /app/vector_monitoring.db ]; then
  echo "[ENTRYPOINT WARN] /app/vector_monitoring.db 未检测到挂载。若运行病媒生物智能体(vector)，建议挂载该数据库。" >&2
fi

# 检查并初始化业务持久化数据库
APP_BUSINESS_DB_PATH="${APP_BUSINESS_DB_PATH:-/app/data/app_business.db}"
export APP_BUSINESS_DB_PATH
mkdir -p "$(dirname "$APP_BUSINESS_DB_PATH")"

if [ ! -s "$APP_BUSINESS_DB_PATH" ]; then
  echo "[ENTRYPOINT INFO] 正在初始化业务持久化数据库: $APP_BUSINESS_DB_PATH"
  python3 /app/scripts/init_business_db.py
fi

# 自动检测并初始化其余领域事实底座（若未挂载且脚本存在）
if [ ! -f /app/foodborne_monitoring.db ] && [ -f /app/scripts/init_foodborne_mock.py ]; then
  echo "[ENTRYPOINT INFO] 正在初始化食源性疾病监测底座: foodborne_monitoring.db"
  python3 /app/scripts/init_foodborne_mock.py || true
fi

if [ ! -f /app/env_monitoring.db ] && [ -f /app/scripts/init_env_mock.py ]; then
  echo "[ENTRYPOINT INFO] 正在初始化环境健康监测底座: env_monitoring.db"
  python3 /app/scripts/init_env_mock.py || true
fi

if [ ! -f /app/chronic_monitoring.db ] && [ -f /app/scripts/init_chronic_mock.py ]; then
  echo "[ENTRYPOINT INFO] 正在初始化死因慢病伤害监测底座: chronic_monitoring.db"
  python3 /app/scripts/init_chronic_mock.py || true
fi

echo "[ENTRYPOINT INFO] 启动 Next.js 独立运行服务..."
exec node /app/server.js
