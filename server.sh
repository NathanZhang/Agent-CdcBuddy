#!/usr/bin/env bash

# ==============================================================================
# CdcBuddy 疾控全域四智能体平台 - 统一运维管理脚本 (Multi-Agent Cluster Manager)
# 用法:
#   ./server.sh start [vector|foodborne|env|chronic|all] [dev|prod]
#   ./server.sh stop [vector|foodborne|env|chronic|all]
#   ./server.sh restart [vector|foodborne|env|chronic|all] [dev|prod]
#   ./server.sh status [vector|foodborne|env|chronic|all]
#   ./server.sh test [vector|foodborne|env|chronic|all]
#   ./server.sh logs [vector|foodborne|env|chronic]
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${PROJECT_ROOT}"

LOG_DIR="${PROJECT_ROOT}/logs"
mkdir -p "${LOG_DIR}"

# 颜色输出定义
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
MAGENTA="\033[0;35m"
NC="\033[0m" # No Color

ALL_DOMAINS=("vector" "foodborne" "env" "chronic")

get_timestamp() {
    date "+%Y-%m-%d %H:%M:%S"
}

log_info() {
    echo -e "${GREEN}[$(get_timestamp)] [INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(get_timestamp)] [WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(get_timestamp)] [ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[$(get_timestamp)] ==>${NC} $1"
}

# 获取智能体对应端口
get_domain_port() {
    local domain="$1"
    case "${domain}" in
        vector) echo 3001 ;;
        foodborne) echo 3002 ;;
        env) echo 3003 ;;
        chronic) echo 3004 ;;
        *) echo 3000 ;;
    esac
}

# 获取智能体中文名
get_domain_name() {
    local domain="$1"
    case "${domain}" in
        vector) echo "病媒生物与宿主动物监测预警智能体" ;;
        foodborne) echo "食源性疾病监测预警智能体" ;;
        env) echo "环境健康风险监测预警智能体" ;;
        chronic) echo "死因、慢病及伤害综合监测预警智能体" ;;
        *) echo "CDC 智能体" ;;
    esac
}

# 获取 PID 文件
get_domain_pid_file() {
    local domain="$1"
    echo "${PROJECT_ROOT}/.server_${domain}.pid"
}

# 获取日志文件
get_domain_log_file() {
    local domain="$1"
    echo "${LOG_DIR}/server_${domain}.log"
}

# 获取数据集路径
get_domain_dataset_path() {
    local domain="$1"
    case "${domain}" in
        vector) echo "${PROJECT_ROOT}/vector_monitoring.db" ;;
        foodborne) echo "${PROJECT_ROOT}/foodborne_monitoring.db" ;;
        env) echo "${PROJECT_ROOT}/env_monitoring.db" ;;
        chronic) echo "${PROJECT_ROOT}/chronic_monitoring.db" ;;
        *) echo "${PROJECT_ROOT}/vector_monitoring.db" ;;
    esac
}

# 检查环境与数据库依赖
check_environment() {
    log_step "检查基础运行环境与数据库依赖..."

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

    # 3. 检查病媒监测数据集底座 (向后兼容)
    if [ ! -f "${PROJECT_ROOT}/vector_monitoring.db" ]; then
        if [ -f "${PROJECT_ROOT}/../Agent-CdcBuddy-DataMock/vector_monitoring.db" ]; then
            log_info "发现 DataMock 数据集，正在复制只读底座 vector_monitoring.db..."
            cp "${PROJECT_ROOT}/../Agent-CdcBuddy-DataMock/vector_monitoring.db" "${PROJECT_ROOT}/vector_monitoring.db"
        elif [ -f "${PROJECT_ROOT}/../Agent-CdcBuddy-DataMock/data/vector/vector_monitoring.db" ]; then
            log_info "发现 DataMock 数据集，正在复制只读底座 vector_monitoring.db..."
            cp "${PROJECT_ROOT}/../Agent-CdcBuddy-DataMock/data/vector/vector_monitoring.db" "${PROJECT_ROOT}/vector_monitoring.db"
        fi
    fi

    # 4. 检查业务数据库
    if [ ! -f "${PROJECT_ROOT}/app_business.db" ]; then
        log_info "正在初始化主应用业务数据库 (app_business.db)..."
        ${PY_BIN} "${PROJECT_ROOT}/scripts/init_business_db.py"
    fi
}

# 检查指定智能体是否运行中
is_domain_running() {
    local domain="$1"
    local pid_file
    pid_file=$(get_domain_pid_file "${domain}")
    local port
    port=$(get_domain_port "${domain}")

    local port_pid
    port_pid=$(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)
    if [ -n "${port_pid}" ]; then
        echo "${port_pid}" > "${pid_file}"
        return 0
    fi

    if [ -f "${pid_file}" ]; then
        local pid
        pid=$(cat "${pid_file}")
        if [ -n "${pid}" ]; then
            local check_out
            check_out=$(kill -0 "${pid}" 2>&1 || true)
            if [ -z "${check_out}" ] || [[ "${check_out}" == *"Operation not permitted"* ]]; then
                return 0
            fi
        fi
    fi

    return 1
}

# 释放指定端口
clean_port() {
    local port="$1"
    local occupied_pid
    occupied_pid=$(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)
    if [ -n "${occupied_pid}" ]; then
        log_warn "检测到端口 ${port} 被进程 ${occupied_pid} 占用，正在释放..."
        kill -9 ${occupied_pid} 2>/dev/null || true
        sleep 1
    fi
}

# 启动单个智能体服务
start_single_agent() {
    local domain="$1"
    local mode="${2:-dev}"
    local port
    port=$(get_domain_port "${domain}")
    local name
    name=$(get_domain_name "${domain}")
    local pid_file
    pid_file=$(get_domain_pid_file "${domain}")
    local log_file
    log_file=$(get_domain_log_file "${domain}")

    if is_domain_running "${domain}"; then
        local current_pid
        current_pid=$(cat "${pid_file}")
        log_warn "【${name}】服务已在运行中 (PID: ${current_pid})，访问地址: http://localhost:${port}"
        return 0
    fi

    clean_port "${port}"

    # 严格注入智能体所属域环境变量，驱动 next.config.ts 隔离 .next_${domain} 构建目录
    export NEXT_PUBLIC_AGENT_DOMAIN="${domain}"
    export AGENT_DOMAIN="${domain}"
    export PORT="${port}"

    echo "=================================================================="
    echo -e "${GREEN} 🚀 正在启动 【${name}】 (${domain})...${NC}"
    echo -e " 智能体域 : ${MAGENTA}${domain}${NC} (NEXT_PUBLIC_AGENT_DOMAIN=${domain})"
    echo -e " 运行模式 : ${BLUE}${mode}${NC}"
    echo -e " 监听端口 : ${CYAN}${port}${NC}"
    echo -e " 构建目录 : ${YELLOW}.next_${domain}${NC} (完全隔离)"
    echo -e " 日志文件 : ${log_file}"
    echo "=================================================================="

    NEXT_CLI="${PROJECT_ROOT}/node_modules/next/dist/bin/next"
    NODE_BIN="$(which node 2>/dev/null || echo "/opt/homebrew/bin/node")"
    echo "=== Starting ${name} ($(date '+%Y-%m-%d %H:%M:%S')) [DOMAIN=${domain}, PORT=${port}] ===" > "${log_file}"

    if [ "${mode}" = "prod" ]; then
        log_step "执行生产环境打包编译 (Next.js build - distDir: .next_${domain})..."
        "${NODE_BIN}" "${NEXT_CLI}" build >> "${log_file}" 2>&1 || true
        CMD="export NEXT_PUBLIC_AGENT_DOMAIN='${domain}' AGENT_DOMAIN='${domain}' PORT='${port}'; exec '${NODE_BIN}' '${NEXT_CLI}' start -p '${port}'"
    else
        CMD="export NEXT_PUBLIC_AGENT_DOMAIN='${domain}' AGENT_DOMAIN='${domain}' PORT='${port}'; exec '${NODE_BIN}' '${NEXT_CLI}' dev -p '${port}'"
    fi

    nohup /bin/bash -c "export PATH=\"/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$PATH\"; export NEXT_PUBLIC_AGENT_DOMAIN='${domain}' AGENT_DOMAIN='${domain}' PORT='${port}'; ${CMD} >> '${log_file}' 2>&1" < /dev/null > /dev/null 2>&1 &

    local server_pid=$!
    disown "${server_pid}" 2>/dev/null || true
    echo "${server_pid}" > "${pid_file}"

    # 如果是 vector 智能体，同时也保持主 .server.pid 兼容
    if [ "${domain}" = "vector" ]; then
        echo "${server_pid}" > "${PROJECT_ROOT}/.server.pid"
    fi

    local max_wait=25
    local waited=0
    log_step "等待【${name}】服务就绪 (Port: ${port})..."

    while [ "${waited}" -lt "${max_wait}" ]; do
        local check_out
        check_out=$(kill -0 "${server_pid}" 2>&1 || true)
        if [ -n "${check_out}" ] && [[ "${check_out}" != *"Operation not permitted"* ]]; then
            echo ""
            log_error "【${name}】进程异常退出，请查看日志: ${log_file}"
            return 1
        fi

        if grep -E "Ready in|started server on" "${log_file}" 2>/dev/null | grep -q -E "Ready in|started server on"; then
            echo ""
            echo -e "${GREEN} ✨ 【${name}】启动成功！访问地址: http://localhost:${port} (PID: ${server_pid})${NC}"
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
        echo -n "."
    done

    echo ""
    log_error "【${name}】启动超时，请查看日志: ${log_file}"
    return 1
}

# 停止单个智能体
stop_single_agent() {
    local domain="$1"
    local name
    name=$(get_domain_name "${domain}")
    local pid_file
    pid_file=$(get_domain_pid_file "${domain}")
    local port
    port=$(get_domain_port "${domain}")

    log_step "正在停止【${name}】(${domain})..."

    if [ -f "${pid_file}" ]; then
        local pid
        pid=$(cat "${pid_file}")
        if kill -0 "${pid}" 2>/dev/null; then
            kill -15 "${pid}" 2>/dev/null || true
            sleep 1
            if kill -0 "${pid}" 2>/dev/null; then
                kill -9 "${pid}" 2>/dev/null || true
            fi
        fi
        rm -f "${pid_file}"
    fi

    if [ "${domain}" = "vector" ]; then
        rm -f "${PROJECT_ROOT}/.server.pid"
    fi

    clean_port "${port}"
    log_info "【${name}】已停止。"
}

# 查看运行状态矩阵
status_agents() {
    local target_domain="${1:-all}"
    echo "=========================================================================================="
    echo -e "${MAGENTA} 📊 CDC 全域四智能体平台运行状态矩阵 (Cluster Status)${NC}"
    echo "=========================================================================================="
    printf "%-12s %-6s %-8s %-16s %-32s\n" "智能体标识" "端口" "PID" "运行状态" "访问地址"
    echo "------------------------------------------------------------------------------------------"

    local domains_to_check=()
    if [ "${target_domain}" = "all" ]; then
        domains_to_check=("${ALL_DOMAINS[@]}")
    else
        domains_to_check=("${target_domain}")
    fi

    for dom in "${domains_to_check[@]}"; do
        local port
        port=$(get_domain_port "${dom}")
        local pid_file
        pid_file=$(get_domain_pid_file "${dom}")
        if is_domain_running "${dom}"; then
            local pid
            pid=$(cat "${pid_file}")
            printf "%-12s %-6s %-8s ${GREEN}%-16s${NC} ${CYAN}%-32s${NC}\n" "${dom}" "${port}" "${pid}" "RUNNING (正常)" "http://localhost:${port}"
        else
            printf "%-12s %-6s %-8s ${RED}%-16s${NC} %-32s\n" "${dom}" "${port}" "-" "STOPPED (未启动)" "-"
        fi
    done
    echo "=========================================================================================="
}

# 运行自动化测试
run_agent_tests() {
    local domain="${1:-vector}"
    check_environment
    export AGENT_DOMAIN="${domain}"
    export NEXT_PUBLIC_AGENT_DOMAIN="${domain}"

    echo "=================================================================="
    echo -e "${MAGENTA} 🧪 正在执行智能体自动化测试套件 (Test Runner)...${NC}"
    echo "=================================================================="

    case "${domain}" in
        vector)
            log_step "执行病媒生物监测预警自动化测试 (序号 23 ~ 35)..."
            "${PY_BIN}" "${PROJECT_ROOT}/tests/automated_test_suite.py"
            ;;
        foodborne)
            log_step "执行食源性疾病监测预警自动化测试 (序号 36 ~ 41)..."
            if [ -f "${PROJECT_ROOT}/tests/suites/test_suite_foodborne.py" ]; then
                "${PY_BIN}" "${PROJECT_ROOT}/tests/suites/test_suite_foodborne.py"
            else
                log_warn "测试套件即将在此模块落地阶段引入。"
            fi
            ;;
        env)
            log_step "执行环境健康监测预警自动化测试 (序号 42 ~ 58)..."
            if [ -f "${PROJECT_ROOT}/tests/suites/test_suite_env.py" ]; then
                "${PY_BIN}" "${PROJECT_ROOT}/tests/suites/test_suite_env.py"
            else
                log_warn "测试套件即将在此模块落地阶段引入。"
            fi
            ;;
        chronic)
            log_step "执行死因慢病伤害监测预警自动化测试 (序号 59 ~ 76)..."
            if [ -f "${PROJECT_ROOT}/tests/suites/test_suite_chronic.py" ]; then
                "${PY_BIN}" "${PROJECT_ROOT}/tests/suites/test_suite_chronic.py"
            else
                log_warn "测试套件即将在此模块落地阶段引入。"
            fi
            ;;
        all)
            log_step "一键执行全域自动化回归测试..."
            "${PY_BIN}" "${PROJECT_ROOT}/tests/automated_test_suite.py"
            if [ -f "${PROJECT_ROOT}/tests/run_all_agent_tests.py" ]; then
                "${PY_BIN}" "${PROJECT_ROOT}/tests/run_all_agent_tests.py"
            fi
            ;;
        *)
            log_error "未知测试目标: ${domain} (可选: vector | foodborne | env | chronic | all)"
            ;;
    esac
}

# 跟踪日志
show_agent_logs() {
    local domain="${1:-vector}"
    local log_file
    log_file=$(get_domain_log_file "${domain}")
    local name
    name=$(get_domain_name "${domain}")
    if [ ! -f "${log_file}" ]; then
        touch "${log_file}"
    fi
    log_info "正在实时跟踪【${name}】运行日志: ${log_file} (Ctrl+C 退出)..."
    tail -f -n 50 "${log_file}"
}

# 参数解析与分发
ACTION="${1:-help}"
PARAM2="${2:-}"
PARAM3="${3:-}"

# 智能识别参数：若第二个参数是 dev 或 prod，则 domain 默认 vector，mode 是该参数
TARGET_DOMAIN="vector"
RUN_MODE="dev"

if [[ "${PARAM2}" == "dev" || "${PARAM2}" == "prod" ]]; then
    TARGET_DOMAIN="vector"
    RUN_MODE="${PARAM2}"
elif [[ -n "${PARAM2}" ]]; then
    TARGET_DOMAIN="${PARAM2}"
    if [[ "${PARAM3}" == "dev" || "${PARAM3}" == "prod" ]]; then
        RUN_MODE="${PARAM3}"
    fi
elif [[ "${ACTION}" == "status" ]]; then
    TARGET_DOMAIN="all"
fi

case "${ACTION}" in
    start)
        check_environment
        if [ "${TARGET_DOMAIN}" = "all" ]; then
            for dom in "${ALL_DOMAINS[@]}"; do
                start_single_agent "${dom}" "${RUN_MODE}"
            done
            status_agents "all"
        else
            start_single_agent "${TARGET_DOMAIN}" "${RUN_MODE}"
        fi
        ;;
    stop)
        if [ "${TARGET_DOMAIN}" = "all" ]; then
            for dom in "${ALL_DOMAINS[@]}"; do
                stop_single_agent "${dom}"
            done
            # 兼容老版 .server.pid
            if [ -f "${PROJECT_ROOT}/.server.pid" ]; then
                kill -9 "$(cat "${PROJECT_ROOT}/.server.pid")" 2>/dev/null || true
                rm -f "${PROJECT_ROOT}/.server.pid"
            fi
        else
            stop_single_agent "${TARGET_DOMAIN}"
        fi
        ;;
    restart)
        check_environment
        if [ "${TARGET_DOMAIN}" = "all" ]; then
            for dom in "${ALL_DOMAINS[@]}"; do
                stop_single_agent "${dom}"
            done
            sleep 1
            for dom in "${ALL_DOMAINS[@]}"; do
                start_single_agent "${dom}" "${RUN_MODE}"
            done
            status_agents "all"
        else
            stop_single_agent "${TARGET_DOMAIN}"
            sleep 1
            start_single_agent "${TARGET_DOMAIN}" "${RUN_MODE}"
        fi
        ;;
    status)
        status_agents "${TARGET_DOMAIN}"
        ;;
    test)
        run_agent_tests "${TARGET_DOMAIN}"
        ;;
    logs)
        show_agent_logs "${TARGET_DOMAIN}"
        ;;
    *)
        echo "=================================================================="
        echo -e "${GREEN} CDC 全域四智能体平台运维管理工具 (Agent Cluster Manager)${NC}"
        echo "=================================================================="
        echo "用法: $0 {start|stop|restart|status|test|logs} [vector|foodborne|env|chronic|all] [dev|prod]"
        echo ""
        echo "命令示例:"
        echo "  $0 start vector dev      - 启动病媒智能体开发服务 (Port: 3001)"
        echo "  $0 start foodborne dev   - 启动食源性智能体开发服务 (Port: 3002)"
        echo "  $0 start env dev         - 启动环境健康智能体开发服务 (Port: 3003)"
        echo "  $0 start chronic dev     - 启动死因慢病智能体开发服务 (Port: 3004)"
        echo "  $0 start all dev         - 一键启动全部 4 个智能体集群服务"
        echo "  $0 stop [domain|all]     - 停止指定或全部智能体服务"
        echo "  $0 status [domain|all]   - 查看智能体集群运行矩阵"
        echo "  $0 test [domain|all]     - 执行指定或全量自动化测试套件"
        echo "  $0 logs [domain]         - 查看指定智能体实时日志"
        echo "=================================================================="
        exit 1
        ;;
esac
