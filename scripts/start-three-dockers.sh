#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WXAPP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_ROOT="$(cd "${WXAPP_ROOT}/.." && pwd)"
SUDA_UNION_ROOT="${APP_ROOT}/suda_union"
SUDA_GS_AMS_ROOT="${APP_ROOT}/suda-gs-ams"
WXAPP_ENV_FILE="${WXAPP_DOCKER_ENV_FILE:-${WXAPP_ROOT}/.env.docker}"

REBUILD_WXAPP=0
REBUILD_ALL=0

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/start-three-dockers.sh [--rebuild-wxapp] [--rebuild-all]

Options:
  --rebuild-wxapp   Rebuild wxapp-checkin before starting it.
  --rebuild-all     Rebuild all three projects before starting them.
  -h, --help        Show this help.
USAGE
}

log() {
  echo "[start-three-dockers] $*"
}

die() {
  echo "[start-three-dockers] $*" >&2
  exit 1
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --rebuild-wxapp)
        REBUILD_WXAPP=1
        ;;
      --rebuild-all)
        REBUILD_ALL=1
        REBUILD_WXAPP=1
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        die "未知参数：$1"
        ;;
    esac
    shift
  done
}

require_file() {
  local file_path="$1"
  [[ -f "${file_path}" ]] || die "缺少文件：${file_path}"
}

load_env_file() {
  local env_file="$1"
  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a
}

ensure_network() {
  local network_name="$1"
  if docker network inspect "${network_name}" >/dev/null 2>&1; then
    return 0
  fi

  log "创建 Docker 网络：${network_name}"
  docker network create "${network_name}" >/dev/null
}

wait_for_container_state() {
  local container_name="$1"
  local expected_state="$2"
  local attempts="${3:-24}"

  for _ in $(seq 1 "${attempts}"); do
    local state
    state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_name}" 2>/dev/null || true)"
    log "${container_name} 当前状态：${state}"
    if [[ "${state}" == "${expected_state}" ]]; then
      return 0
    fi
    sleep 5
  done

  docker logs --tail 120 "${container_name}" || true
  die "${container_name} 未进入预期状态：${expected_state}"
}

probe_http_status() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local actual_status

  actual_status="$(curl -sS -o /dev/null -w '%{http_code}' "${url}")"
  log "${label} HTTP ${actual_status} <- ${url}"
  [[ "${actual_status}" == "${expected_status}" ]] || die "${label} 探活失败，期望 ${expected_status}，实际 ${actual_status}"
}

start_suda_union() {
  local compose_args=(up -d)
  if [[ "${REBUILD_ALL}" -eq 1 ]]; then
    compose_args+=(--build)
  fi
  compose_args+=(suda-union)

  log "启动 suda-union"
  (
    cd "${SUDA_UNION_ROOT}"
    docker compose "${compose_args[@]}"
  )

  wait_for_container_state "suda-union" "healthy"
  probe_http_status "suda-union" "http://127.0.0.1:8088/" "404"
}

start_wxapp_checkin() {
  local compose_args=(up -d)
  if [[ "${REBUILD_WXAPP}" -eq 1 ]]; then
    compose_args+=(--build)
  fi
  compose_args+=(wxapp-checkin)

  log "启动 wxapp-checkin"
  (
    cd "${WXAPP_ROOT}"
    docker compose --env-file "${WXAPP_ENV_FILE}" "${compose_args[@]}"
  )

  wait_for_container_state "wxapp-checkin" "running" 12
  probe_http_status "wxapp-checkin web" "http://127.0.0.1:${WXAPP_HTTP_PORT:-89}/" "200"

  local api_status
  api_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${WXAPP_HTTP_PORT:-89}/api/web/activities?page=1&page_size=1")"
  log "wxapp-checkin api HTTP ${api_status} <- /api/web/activities?page=1&page_size=1"
  [[ "${api_status}" == "401" || "${api_status}" == "403" ]] || die "wxapp-checkin API 反代异常，收到 ${api_status}"
}

start_suda_gs_ams() {
  local compose_args=(up -d)
  if [[ "${REBUILD_ALL}" -eq 1 ]]; then
    compose_args+=(--build)
  fi
  compose_args+=(suda-gs-ams)

  log "启动 suda-gs-ams"
  (
    cd "${SUDA_GS_AMS_ROOT}"
    docker compose "${compose_args[@]}"
  )

  wait_for_container_state "suda-gs-ams" "running" 12
  probe_http_status "suda-gs-ams" "http://127.0.0.1:5173/" "200"
}

main() {
  parse_args "$@"

  command -v docker >/dev/null 2>&1 || die "未检测到 docker 命令"
  require_file "${WXAPP_ENV_FILE}"
  require_file "${WXAPP_ROOT}/docker-compose.yml"
  require_file "${SUDA_UNION_ROOT}/docker-compose.yml"
  require_file "${SUDA_GS_AMS_ROOT}/docker-compose.yml"

  load_env_file "${WXAPP_ENV_FILE}"
  ensure_network "${DOCKER_NETWORK:-three-projects-net}"

  start_suda_union
  start_wxapp_checkin
  start_suda_gs_ams

  log "三项目启动完成"
  log "访问地址："
  log "  suda-union      http://127.0.0.1:8088/"
  log "  wxapp-checkin   http://127.0.0.1:${WXAPP_HTTP_PORT:-89}/"
  log "  suda-gs-ams     http://127.0.0.1:5173/"
  log "常用日志命令："
  log "  docker logs -f suda-union"
  log "  docker logs -f wxapp-checkin"
  log "  docker logs -f suda-gs-ams"
}

main "$@"
