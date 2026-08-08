#!/usr/bin/env bash

# ==============================================================================
# CdcBuddy 疾控病媒生物监测预警智能体 - 统一运维管理脚本
# 用法:
#   ./server.sh start [dev|prod]   - 启动服务 (默认 dev 开发模式)
#   ./server.sh stop               - 停止服务
#   ./server.sh restart [dev|prod] - 重启服务
#   ./server.sh status             - 查看运行状态
#   ./server.sh logs               - 实时查看运行日志
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${PROJECT_ROOT}"

PID_FILE="${PROJECT_ROOT}/.server.pid"
LOG_DIR="${PROJECT_ROOT}/logs"
LOG_FILE="${LOG_DIR}/server.log"
PORT=3000

# 颜色输出定义
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m" # No Color

mkdir -p "${LOG_DIR}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}==>${NC} $1"
}

# 检查环境与数据库依赖
check_environment() {
    log_step "检查运行环境与数据库依赖..."

    # 1. 检查 Node.js / npm
    if ! command -v node &> /dev/null; then
        log_error "未找到 Node.js，请先安装 Node.js (推荐 v18+)"
        exit 1
    fi

    # 2. 检查并初始化 Python 独立虚拟环境
    if [ ! -d "${PROJECT_ROOT}/.venv" ]; then
        log_info "未检测到 Python 虚拟环境，正在自动创建 .venv 并安装依赖..."
        python3 -m venv "${PROJECT_ROOT}/.venv"
        "${PROJECT_ROOT}/.venv/bin/pip" install --upgrade pip -q || true
        if [ -f "${PROJECT_ROOT}/requirements.txt" ]; then
            "${PROJECT_ROOT}/.venv/bin/pip" install -r "${PROJECT_ROOT}/requirements.txt" -q || true
        fi
    fi

    PY_BIN="${PROJECT_ROOT}/.venv/bin/python3"
    if [ ! -f "${PY_BIN}" ]; then
        PY_BIN="python3"
    fi
    log_info "使用 Python 运行环境: ${PY_BIN}"

    # 3. 检查监测数据集库
    if [ ! -f "${PROJECT_ROOT}/vector_monitoring.db" ]; then
        if [ -f "${PROJECT_ROOT}/../Agent-CdcBuddy-DataMock/vector_monitoring.db" ]; then
            log_info "发现 DataMock 数据集，正在复制只读底座 vector_monitoring.db..."
            cp "${PROJECT_ROOT}/../Agent-CdcBuddy-DataMock/vector_monitoring.db" "${PROJECT_ROOT}/vector_monitoring.db"
        else
            log_warn "未检测到 vector_monitoring.db，分析引擎将尝试查找上级目录。"
        fi
    fi

    # 4. 检查并初始化独立应用业务数据库
    if [ ! -f "${PROJECT_ROOT}/app_business.db" ]; then
        log_info "正在初始化应用业务数据库 (app_business.db)..."
        ${PY_BIN} "${PROJECT_ROOT}/scripts/init_business_db.py"
    fi
}

# 检查服务是否正在运行
is_running() {
    if [ -f "${PID_FILE}" ]; then
        local pid
        pid=$(cat "${PID_FILE}")
        if ps -p "${pid}" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# 释放端口占用
clean_port() {
    local occupied_pid
    occupied_pid=$(lsof -ti tcp:"${PORT}" 2>/dev/null || true)
    if [ -n "${occupied_pid}" ]; then
        log_warn "检测到端口 ${PORT} 被进程 ${occupied_pid} 占用，正在释放..."
        kill -9 ${occupied_pid} 2>/dev/null || true
        sleep 1
    fi
}

# 启动服务
start_server() {
    local mode="${1:-dev}"

    if is_running; then
        local current_pid
        current_pid=$(cat "${PID_FILE}")
        log_warn "CdcBuddy 服务已在运行中 (PID: ${current_pid})，访问地址: http://localhost:${PORT}"
        exit 0
    fi

    clean_port
    check_environment

    echo "=================================================================="
    echo -e "${GREEN} 🚀 正在启动 CdcBuddy 疾控病媒生物监测预警智能体系统...${NC}"
    echo -e " 运行模式 : ${BLUE}${mode}${NC}"
    echo -e " 监听端口 : ${CYAN}${PORT}${NC}"
    echo -e " 日志文件 : ${LOG_FILE}"
    echo "=================================================================="

    NEXT_CLI="${PROJECT_ROOT}/node_modules/next/dist/bin/next"

    if [ "${mode}" = "prod" ]; then
        log_step "执行生产环境打包编译..."
        if [ -f "${NEXT_CLI}" ]; then
            node "${NEXT_CLI}" build >> "${LOG_FILE}" 2>&1
            log_step "启动生产服务 (next start)..."
            nohup node "${NEXT_CLI}" start -p "${PORT}" >> "${LOG_FILE}" 2>&1 &
        else
            nohup npm run start -- -p "${PORT}" >> "${LOG_FILE}" 2>&1 &
        fi
    else
        log_step "启动开发模式服务 (next dev)..."
        if [ -f "${NEXT_CLI}" ]; then
            nohup node "${NEXT_CLI}" dev -p "${PORT}" >> "${LOG_FILE}" 2>&1 &
        else
            nohup npm run dev >> "${LOG_FILE}" 2>&1 &
        fi
    fi

    local server_pid=$!
    echo "${server_pid}" > "${PID_FILE}"

    # 等待服务就绪 (三重校验: lsof / HTTP ping / 日志 Ready)
    local max_wait=30
    local waited=0
    log_step "等待服务就绪..."

    while [ "${waited}" -lt "${max_wait}" ]; do
        # 1. 检查进程是否存在
        if ! ps -p "${server_pid}" > /dev/null 2>&1; then
            echo ""
            log_error "服务进程异常退出，请查看日志: ${LOG_FILE}"
            exit 1
        fi

        # 2. 检查 HTTP 探活或日志已就绪
        local is_ready=0
        if curl -s -m 1 -o /dev/null "http://127.0.0.1:${PORT}" 2>/dev/null; then
            is_ready=1
        elif lsof -ti tcp:"${PORT}" > /dev/null 2>&1; then
            is_ready=1
        elif grep -E "Ready in|started server on|Local:" "${LOG_FILE}" 2>/dev/null | tail -n 5 | grep -q "${PORT}"; then
            is_ready=1
        fi

        if [ "${is_ready}" -eq 1 ]; then
            echo ""
            echo "=================================================================="
            echo -e "${GREEN} ✨ CdcBuddy 智能体服务启动成功！${NC}"
            echo -e " 🌐 系统访问地址 : ${BLUE}http://localhost:${PORT}${NC}"
            echo -e " 📋 业务库路径   : ${CYAN}${PROJECT_ROOT}/app_business.db${NC}"
            echo -e " 📊 数据集库路径 : ${CYAN}${PROJECT_ROOT}/vector_monitoring.db${NC}"
            echo -e " 📄 服务进程 PID : ${GREEN}${server_pid}${NC}"
            echo "=================================================================="
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
        echo -n "."
    done

    echo ""
    log_error "服务启动超时，请查看日志: ${LOG_FILE}"
    exit 1
}

# 停止服务
stop_server() {
    log_step "正在停止 CdcBuddy 智能体服务..."

    if [ -f "${PID_FILE}" ]; then
        local pid
        pid=$(cat "${PID_FILE}")
        if ps -p "${pid}" > /dev/null 2>&1; then
            kill -15 "${pid}" 2>/dev/null || true
            sleep 2
            if ps -p "${pid}" > /dev/null 2>&1; then
                kill -9 "${pid}" 2>/dev/null || true
            fi
        fi
        rm -f "${PID_FILE}"
    fi

    clean_port
    log_info "CdcBuddy 服务已成功停止。"
}

# 查看状态
status_server() {
    if is_running; then
        local pid
        pid=$(cat "${PID_FILE}")
        echo -e "${GREEN}● CdcBuddy 服务正在正常运行${NC}"
        echo -e "  - PID      : ${GREEN}${pid}${NC}"
        echo -e "  - 端口     : ${BLUE}${PORT}${NC}"
        echo -e "  - 访问地址 : ${CYAN}http://localhost:${PORT}${NC}"
        echo -e "  - 日志位置 : ${LOG_FILE}"
    else
        echo -e "${RED}○ CdcBuddy 服务未运行${NC}"
    fi
}

# 实时日志
show_logs() {
    if [ ! -f "${LOG_FILE}" ]; then
        touch "${LOG_FILE}"
    fi
    log_info "正在实时跟踪服务日志 (Ctrl+C 退出)..."
    tail -f -n 50 "${LOG_FILE}"
}

# 主入口分发
case "${1}" in
    start)
        start_server "${2:-dev}"
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 1
        start_server "${2:-dev}"
        ;;
    status)
        status_server
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "CdcBuddy 疾控病媒生物监测预警智能体统一管理工具"
        echo ""
        echo "用法: $0 {start [dev|prod]|stop|restart [dev|prod]|status|logs}"
        echo ""
        echo "命令说明:"
        echo "  start [dev|prod]   启动服务 (默认 dev 开发模式，prod 为生产模式)"
        echo "  stop               优雅停止运行中的服务"
        echo "  restart [dev|prod] 重启服务"
        echo "  status             检查当前服务运行状态"
        echo "  logs               实时滚动查看运行日志"
        exit 1
        ;;
esac
