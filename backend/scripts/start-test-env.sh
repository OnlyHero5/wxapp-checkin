#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_ENV_FILE="${PROJECT_ROOT}/.env.test.local.sh"
LEGACY_ENV_FILE="${HOME}/.wxapp-checkin-test-env.sh"

# 说明：
# - 该脚本现在只负责加载“仓库内的本地联调环境变量”并启动后端；
# - 已明确移除任何 legacy(suda_union) / 扩展库重置逻辑，避免仓库继续携带毁库能力；
# - 为避免误连远程数据库，这个入口只允许 loopback 主机，超出范围请改用更显式的手工启动方式。
ENV_FILE="${WXAPP_TEST_ENV_FILE:-}"
if [[ -z "${ENV_FILE}" ]]; then
  if [[ -f "${DEFAULT_ENV_FILE}" ]]; then
    ENV_FILE="${DEFAULT_ENV_FILE}"
  elif [[ -f "${LEGACY_ENV_FILE}" ]]; then
    ENV_FILE="${LEGACY_ENV_FILE}"
    echo "[start-test-env] Detected legacy env file: ${LEGACY_ENV_FILE}" >&2
    echo "[start-test-env] Recommended: cp scripts/test-env.example.sh ${DEFAULT_ENV_FILE}" >&2
  else
    ENV_FILE="${DEFAULT_ENV_FILE}"
  fi
fi

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
else
  echo "[start-test-env] Missing env file: ${ENV_FILE}" >&2
  echo "[start-test-env] Please create it first:" >&2
  echo "[start-test-env]   cd ${PROJECT_ROOT}" >&2
  echo "[start-test-env]   cp scripts/test-env.example.sh .env.test.local.sh" >&2
  exit 1
fi

export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-dev}"
export SERVER_PORT="${SERVER_PORT:-9989}"
export LEGACY_SYNC_ENABLED="${LEGACY_SYNC_ENABLED:-true}"
export LEGACY_SYNC_INTERVAL_MS="${LEGACY_SYNC_INTERVAL_MS:-2000}"
export OUTBOX_RELAY_ENABLED="${OUTBOX_RELAY_ENABLED:-true}"
export OUTBOX_RELAY_INTERVAL_MS="${OUTBOX_RELAY_INTERVAL_MS:-2000}"

DB_HOST="${DB_HOST:-127.0.0.1}"
LEGACY_DB_URL="${LEGACY_DB_URL:-}"

is_local_host() {
  case "${1:-}" in
    ""|127.0.0.1|localhost|::1) return 0 ;;
    *) return 1 ;;
  esac
}

extract_jdbc_host() {
  local jdbc_url="${1:-}"
  if [[ -z "${jdbc_url}" ]]; then
    echo ""
    return 0
  fi
  sed -n 's#^jdbc:mysql://\([^/:?]*\).*#\1#p' <<<"${jdbc_url}" | head -n 1
}

extract_pid_on_port() {
  local port="$1"
  local ss_line
  ss_line="$(ss -ltnp "sport = :${port}" 2>/dev/null | tail -n +2 | head -n 1 || true)"
  if [[ -z "${ss_line}" ]]; then
    return 1
  fi
  sed -n "s/.*pid=\\([0-9][0-9]*\\).*/\\1/p" <<<"${ss_line}" | head -n 1
}

stop_existing_backend_on_port() {
  local port="$1"
  local pid
  pid="$(extract_pid_on_port "${port}" || true)"
  if [[ -z "${pid}" ]]; then
    return 0
  fi

  local cmdline
  cmdline="$(ps -p "${pid}" -o args= || true)"
  if [[ "${cmdline}" == *"wxcheckin"* ]] || [[ "${cmdline}" == *"spring-boot:run"* ]]; then
    echo "[start-test-env] Port ${port} occupied by existing backend PID=${pid}, stopping it."
    kill "${pid}"
    sleep 1
  else
    echo "[start-test-env] Port ${port} is occupied by PID=${pid} (${cmdline})." >&2
    echo "[start-test-env] Refuse to kill unknown process. Please free the port manually." >&2
    exit 1
  fi
}

ensure_safe_local_targets() {
  # 说明：
  # - local 启动入口只服务于“本机回环地址上的自管环境”；
  # - 如果 DB/legacy 指向远程主机，虽然本脚本已不再重置数据，但仍可能把联调流量打到真实环境；
  # - 因此这里直接拒绝，避免把“方便启动”误用成“远程环境运维入口”。
  if [[ "${SPRING_PROFILES_ACTIVE}" == "prod" ]]; then
    echo "[start-test-env] Refuse to run in prod profile." >&2
    exit 1
  fi
  if ! is_local_host "${DB_HOST}"; then
    echo "[start-test-env] DB_HOST=${DB_HOST} is not local. This entry only supports loopback databases." >&2
    exit 1
  fi

  local legacy_host
  legacy_host="$(extract_jdbc_host "${LEGACY_DB_URL}")"
  if [[ -n "${legacy_host}" ]] && ! is_local_host "${legacy_host}"; then
    echo "[start-test-env] LEGACY_DB_URL host=${legacy_host} is not local. This entry only supports loopback legacy DB." >&2
    exit 1
  fi
}

echo "[start-test-env] Profile: ${SPRING_PROFILES_ACTIVE}"
echo "[start-test-env] Port: ${SERVER_PORT}"
echo "[start-test-env] Legacy sync: ${LEGACY_SYNC_ENABLED} (${LEGACY_SYNC_INTERVAL_MS} ms)"
echo "[start-test-env] Outbox relay: ${OUTBOX_RELAY_ENABLED} (${OUTBOX_RELAY_INTERVAL_MS} ms)"
echo "[start-test-env] Safe mode: no database reset, no legacy reseed."

ensure_safe_local_targets
stop_existing_backend_on_port "${SERVER_PORT}"

cd "${PROJECT_ROOT}"
exec ./scripts/start-dev.sh
