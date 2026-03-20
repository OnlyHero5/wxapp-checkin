#!/usr/bin/env bash
set -euo pipefail

# wxapp-checkin 一键启动：
# - local：依赖本机 MySQL/Redis，安全地启动后端（默认 9989）+ web dev server；
# - docker：使用 backend/docker-compose.yml 启动 MySQL/Redis/backend（默认 8080）+ web dev server；
# - 运行日志与 pid 落在 runtime 目录（优先 workspace local_dev/runtime，其次仓库 local_dev/runtime）。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/dev.sh local
  ./scripts/dev.sh docker
USAGE
}

log() {
  echo "[dev] $*"
}

runtime_dir() {
  local workspace_root
  workspace_root="$(cd "${REPO_ROOT}/.." && pwd)"
  if [[ -d "${workspace_root}/local_dev" ]]; then
    echo "${workspace_root}/local_dev/runtime/wxapp-checkin"
    return 0
  fi
  echo "${REPO_ROOT}/local_dev/runtime"
}

wait_for_health() {
  local url="$1"
  local max_seconds="${2:-60}"

  local start_ts
  start_ts="$(date +%s)"

  while true; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    local now_ts
    now_ts="$(date +%s)"
    if (( now_ts - start_ts >= max_seconds )); then
      echo "[dev] Backend health check timeout: ${url}" >&2
      return 1
    fi
    sleep 1
  done
}

ensure_web_deps() {
  # 说明：首次启动通常需要安装依赖；若 node_modules 已存在则跳过。
  if [[ -d "${REPO_ROOT}/web/node_modules" ]]; then
    return 0
  fi
  log "Installing web dependencies (npm install)..."
  (cd "${REPO_ROOT}/web" && npm install)
}

load_local_backend_port() {
  # 说明：local 模式端口以 `backend/.env.test.local.sh` 为准（默认 9989）。
  local env_file="${REPO_ROOT}/backend/.env.test.local.sh"
  if [[ -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    source "${env_file}"
  fi
  echo "${SERVER_PORT:-9989}"
}

load_docker_backend_port() {
  # 说明：
  # - docker compose 默认端口映射是 8080:8080；
  # - 不 source backend/.env（里面有 & 等字符，不是安全的 shell 脚本）。
  local env_file="${REPO_ROOT}/backend/.env"
  local port
  port="$(sed -n 's/^SERVER_PORT=//p' "${env_file}" 2>/dev/null | tail -n 1 || true)"
  if [[ -n "${port}" ]]; then
    echo "${port}"
    return 0
  fi
  echo "8080"
}

start_backend_local() {
  local rt_dir="$1"
  local log_file="${rt_dir}/backend-local.log"
  local pid_file="${rt_dir}/backend-local.pid"

  # 说明：local 模式现在只启动后端，不再附带任何数据库重置动作。
  log "Starting backend (local, safe mode)..."
  (cd "${REPO_ROOT}/backend" && ./scripts/start-test-env.sh) >"${log_file}" 2>&1 &
  local pid="$!"
  echo "${pid}" >"${pid_file}"
  log "Backend PID: ${pid} (log: ${log_file})"
}

start_backend_docker() {
  log "Starting backend (docker compose)..."
  (cd "${REPO_ROOT}/backend" && docker compose up -d --build)
}

start_web_local() {
  log "Starting web dev server (local mode)..."
  ensure_web_deps
  (cd "${REPO_ROOT}/web" && npm run dev)
}

start_web_docker() {
  log "Starting web dev server (docker mode)..."
  ensure_web_deps
  (cd "${REPO_ROOT}/web" && npm run dev -- --mode docker)
}

main() {
  local mode="${1:-}"
  if [[ -z "${mode}" ]]; then
    usage
    exit 2
  fi

  case "${mode}" in
    local|docker) ;;
    *)
      usage
      exit 2
      ;;
  esac

  "${REPO_ROOT}/scripts/bootstrap.sh"

  local rt_dir
  rt_dir="$(runtime_dir)"
  mkdir -p "${rt_dir}"

  if [[ "${mode}" == "local" ]]; then
    local port
    port="$(load_local_backend_port)"

    start_backend_local "${rt_dir}"
    wait_for_health "http://127.0.0.1:${port}/actuator/health" 90
    log "Backend is up: http://127.0.0.1:${port}/actuator/health"
    log "Stop: ./scripts/stop.sh"
    start_web_local
    return 0
  fi

  local port
  port="$(load_docker_backend_port)"

  start_backend_docker
  wait_for_health "http://127.0.0.1:${port}/actuator/health" 90
  log "Backend is up: http://127.0.0.1:${port}/actuator/health"
  log "Stop: ./scripts/stop.sh"
  start_web_docker
}

main "$@"
