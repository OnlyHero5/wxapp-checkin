#!/usr/bin/env bash
set -euo pipefail

# wxapp-checkin 一键停止：
# - docker：docker compose down（不报错即视为完成）
# - local：读取 runtime pid 文件安全停止（仅停止本脚本启动过的后端）
#
# 注意：
# - 为避免误杀，本脚本不会强行 kill 未知进程；
# - 若端口仍被占用，可按提示用 ss/lsof 自行排障。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() {
  echo "[stop] $*"
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

load_local_backend_port() {
  local env_file="${REPO_ROOT}/backend/.env.test.local.sh"
  if [[ -f "${env_file}" ]]; then
    # shellcheck disable=SC1090
    source "${env_file}"
  fi
  echo "${SERVER_PORT:-9989}"
}

safe_kill_pid() {
  local pid="$1"
  if ! ps -p "${pid}" >/dev/null 2>&1; then
    return 0
  fi

  local cmdline
  cmdline="$(ps -p "${pid}" -o args= || true)"
  if [[ "${cmdline}" == *"spring-boot:run"* ]] || [[ "${cmdline}" == *"wxcheckin"* ]] || [[ "${cmdline}" == *"backend-0.0.1-SNAPSHOT.jar"* ]]; then
    log "Stopping PID=${pid} (${cmdline})"
    kill "${pid}" || true
    return 0
  fi

  echo "[stop] Refuse to kill unknown PID=${pid} (${cmdline})" >&2
  return 1
}

stop_local_backend() {
  local rt_dir="$1"
  local pid_file="${rt_dir}/backend-local.pid"

  if [[ ! -f "${pid_file}" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    rm -f "${pid_file}" || true
    return 0
  fi

  safe_kill_pid "${pid}" || true

  # 说明：mvn spring-boot:run 停止需要一点时间，这里给一个短等待并提示端口排障方式。
  sleep 2
  rm -f "${pid_file}" || true

  local port
  port="$(load_local_backend_port)"
  if ss -ltnp "sport = :${port}" 2>/dev/null | tail -n +2 | grep -q .; then
    echo "[stop] Port ${port} is still in use. If needed, inspect with: ss -ltnp \"sport = :${port}\"" >&2
  fi
}

stop_docker_backend() {
  if ! command -v docker >/dev/null 2>&1; then
    return 0
  fi
  if [[ -f "${REPO_ROOT}/docker-compose.yml" ]]; then
    log "Stopping docker compose (root full stack)..."
    (cd "${REPO_ROOT}" && docker compose down) || true
  fi
  if [[ ! -f "${REPO_ROOT}/backend/docker-compose.yml" ]]; then
    return 0
  fi

  log "Stopping docker compose (backend)..."
  (cd "${REPO_ROOT}/backend" && docker compose down) || true
}

main() {
  local rt_dir
  rt_dir="$(runtime_dir)"
  mkdir -p "${rt_dir}"

  stop_docker_backend
  stop_local_backend "${rt_dir}"

  log "Done."
}

main "$@"
