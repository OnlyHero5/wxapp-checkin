#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${WXAPP_TEST_ENV_FILE:-$HOME/.wxapp-checkin-test-env.sh}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
else
  echo "[start-test-env] Missing env file: ${ENV_FILE}" >&2
  echo "[start-test-env] Please create it first (example: ~/.wxapp-checkin-test-env.sh)." >&2
  exit 1
fi

export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-dev}"
export SERVER_PORT="${SERVER_PORT:-1455}"
export LEGACY_SYNC_ENABLED="${LEGACY_SYNC_ENABLED:-true}"
export LEGACY_SYNC_INTERVAL_MS="${LEGACY_SYNC_INTERVAL_MS:-2000}"
export OUTBOX_RELAY_ENABLED="${OUTBOX_RELAY_ENABLED:-true}"
export OUTBOX_RELAY_INTERVAL_MS="${OUTBOX_RELAY_INTERVAL_MS:-2000}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
EXT_SCHEMA="${DB_NAME:-wxcheckin_ext}"

MYSQL_ARGS=(-h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}")
if [[ -n "${DB_PASSWORD}" ]]; then
  MYSQL_ARGS+=(-p"${DB_PASSWORD}")
fi

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

table_exists() {
  local table_name="$1"
  local count
  count="$(mysql "${MYSQL_ARGS[@]}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${EXT_SCHEMA}' AND table_name='${table_name}'" 2>/dev/null || echo 0)"
  [[ "${count}" == "1" ]]
}

reset_wx_identity_bindings() {
  if ! table_exists "wx_user_auth_ext"; then
    echo "[start-test-env] Skip wx identity reset: ${EXT_SCHEMA}.wx_user_auth_ext not found."
    return 0
  fi

  echo "[start-test-env] Resetting WeChat identity bindings in ${EXT_SCHEMA}."
  local reset_tables=(
    wx_session
    wx_user_activity_status
    wx_checkin_event
    wx_qr_issue_log
    wx_replay_guard
    wx_sync_outbox
    wx_user_auth_ext
  )

  for table_name in "${reset_tables[@]}"; do
    if table_exists "${table_name}"; then
      mysql "${MYSQL_ARGS[@]}" -D "${EXT_SCHEMA}" -e "DELETE FROM \`${table_name}\`;"
    fi
  done
}

echo "[start-test-env] Profile: ${SPRING_PROFILES_ACTIVE}"
echo "[start-test-env] Port: ${SERVER_PORT}"
echo "[start-test-env] Legacy sync: ${LEGACY_SYNC_ENABLED} (${LEGACY_SYNC_INTERVAL_MS} ms)"
echo "[start-test-env] Outbox relay: ${OUTBOX_RELAY_ENABLED} (${OUTBOX_RELAY_INTERVAL_MS} ms)"

stop_existing_backend_on_port "${SERVER_PORT}"

"${SCRIPT_DIR}/reset-suda-union-test-data.sh"
reset_wx_identity_bindings

cd "${PROJECT_ROOT}"
exec ./scripts/start-dev.sh
