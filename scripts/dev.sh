#!/usr/bin/env bash
set -euo pipefail

# wxapp-checkin 一键启动：
# - 当前只保留 local 模式：依赖本机 MySQL，启动 Rust 后端（默认 9989）+ web dev server；
# - Java backend / Docker Compose 已从正式入口移除，不再继续维护双套启动链路；
# - 运行日志与 pid 落在 runtime 目录（优先 workspace local_dev/runtime，其次仓库 local_dev/runtime）。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/dev.sh local
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

load_cargo_env() {
  local workspace_root
  workspace_root="$(cd "${REPO_ROOT}/.." && pwd)"
  if [[ -f "${workspace_root}/.cargo/env" ]]; then
    # shellcheck disable=SC1090
    source "${workspace_root}/.cargo/env"
  elif [[ -f "${HOME}/.cargo/env" ]]; then
    # shellcheck disable=SC1090
    source "${HOME}/.cargo/env"
  fi
}

load_local_backend_port() {
  # 说明：local 模式端口以 `backend-rust/.env.local.sh` 为准（默认 9989）。
  local env_file="${REPO_ROOT}/backend-rust/.env.local.sh"
  if [[ -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    source "${env_file}"
  fi
  echo "${SERVER_PORT:-9989}"
}

start_backend_local() {
  local rt_dir="$1"
  local log_file="${rt_dir}/backend-local.log"
  local pid_file="${rt_dir}/backend-local.pid"
  local env_file="${REPO_ROOT}/backend-rust/.env.local.sh"

  load_cargo_env
  command -v cargo >/dev/null 2>&1 || {
    echo "[dev] Missing cargo. Install Rust toolchain first." >&2
    exit 1
  }

  [[ -f "${env_file}" ]] || {
    echo "[dev] Missing env file: ${env_file}. Run ./scripts/bootstrap.sh first." >&2
    exit 1
  }

  # 说明：local 模式直接运行 Rust 服务，不再走 Java / Maven / Docker。
  log "Starting backend-rust (local mode)..."
  (
    cd "${REPO_ROOT}/backend-rust"
    # shellcheck disable=SC1090
    set -a
    source "${env_file}"
    set +a
    cargo run
  ) >"${log_file}" 2>&1 &
  local pid="$!"
  echo "${pid}" >"${pid_file}"
  log "Backend PID: ${pid} (log: ${log_file})"
}

start_web_local() {
  log "Starting web dev server (local mode)..."
  ensure_web_deps
  (cd "${REPO_ROOT}/web" && npm run dev)
}

main() {
  local mode="${1:-}"
  if [[ -z "${mode}" ]]; then
    usage
    exit 2
  fi

  case "${mode}" in
    local) ;;
    *)
      usage
      exit 2
      ;;
  esac

  "${REPO_ROOT}/scripts/bootstrap.sh"

  local rt_dir
  rt_dir="$(runtime_dir)"
  mkdir -p "${rt_dir}"

  local port
  port="$(load_local_backend_port)"

  start_backend_local "${rt_dir}"
  wait_for_health "http://127.0.0.1:${port}/actuator/health" 90
  log "Backend is up: http://127.0.0.1:${port}/actuator/health"
  log "Stop: ./scripts/stop.sh"
  start_web_local
}

main "$@"
