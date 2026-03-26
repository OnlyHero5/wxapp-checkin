#!/usr/bin/env bash
set -euo pipefail

# 云服务器一键 Docker 启动脚本：
# - 从 `.env.docker` 读取 suda-union 账号、密码、端口和签名密钥；
# - 若联调网络不存在则自动创建，避免第一次上机时还要手动补命令；
# - 只负责拉起当前 `wxapp-checkin` 容器，不额外启动其它服务。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${WXAPP_DOCKER_ENV_FILE:-${REPO_ROOT}/.env.docker}"

log() {
  echo "[docker-prod] $*"
}

die() {
  echo "[docker-prod] $*" >&2
  exit 1
}

require_file() {
  local file_path="$1"
  [[ -f "${file_path}" ]] || die "缺少配置文件：${file_path}，请先参考 .env.docker.example 创建"
}

load_env() {
  local env_file="$1"
  # `.env.docker` 采用 `KEY=VALUE` / `export KEY=VALUE` 形式；
  # 这里直接 source，便于后续做最小预检并复用给 docker compose --env-file。
  # shellcheck disable=SC1090
  set -a
  source "${env_file}"
  set +a
}

require_var() {
  local name="$1"
  local value="${!name:-}"
  [[ -n "${value}" ]] || die "配置文件缺少必填项：${name}"
}

ensure_network() {
  local network_name="$1"
  if docker network inspect "${network_name}" >/dev/null 2>&1; then
    return 0
  fi
  log "创建 Docker 网络：${network_name}"
  docker network create "${network_name}" >/dev/null
}

main() {
  command -v docker >/dev/null 2>&1 || die "未检测到 docker 命令"
  require_file "${ENV_FILE}"
  load_env "${ENV_FILE}"

  require_var "SUDA_UNION_DB_HOST"
  require_var "SUDA_UNION_DB_PORT"
  require_var "SUDA_UNION_DB_NAME"
  require_var "SUDA_UNION_DB_USER"
  require_var "SUDA_UNION_DB_PASSWORD"
  require_var "WXAPP_QR_SIGNING_KEY"

  local network_name="${DOCKER_NETWORK:-three-projects-net}"
  ensure_network "${network_name}"

  log "使用配置文件：${ENV_FILE}"
  log "目标 suda-union：${SUDA_UNION_DB_HOST}:${SUDA_UNION_DB_PORT}/${SUDA_UNION_DB_NAME}"
  log "开始构建并启动 wxapp-checkin 容器"
  (
    cd "${REPO_ROOT}"
    docker compose --env-file "${ENV_FILE}" up -d --build wxapp-checkin
  )
  log "启动完成，可用以下命令查看紫色/蓝色关键日志："
  log "  docker logs -f wxapp-checkin"
}

main "$@"
