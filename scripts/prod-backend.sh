#!/usr/bin/env bash
set -euo pipefail

# 生产环境一键启动（Rust 后端）：
# - 只做“加载生产 env + 启动 release 二进制”，不会做任何数据初始化；
# - 默认只认 `suda_union`，不再接入 `wxcheckin_ext` / 双库同步 / Java jar；
# - 该脚本不负责构建二进制，也不负责部署 web 静态资源。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend-rust"

log() {
  echo "[prod] $*"
}

die() {
  echo "[prod] $*" >&2
  exit 1
}

detect_env_file() {
  # 说明：
  # - 生产推荐把敏感配置落到 /etc 下（权限与审计更可控）；
  # - 仓库内的 backend-rust/.env.prod 仅用于“单机演示/排障”；
  # - 如果你有更标准的运维体系，请直接用 WXAPP_PROD_ENV_FILE 指向实际文件。
  if [[ -n "${WXAPP_PROD_ENV_FILE:-}" ]]; then
    echo "${WXAPP_PROD_ENV_FILE}"
    return 0
  fi
  if [[ -f "/etc/wxcheckin/backend-rust.prod.env" ]]; then
    echo "/etc/wxcheckin/backend-rust.prod.env"
    return 0
  fi
  if [[ -f "${BACKEND_DIR}/.env.prod" ]]; then
    echo "${BACKEND_DIR}/.env.prod"
    return 0
  fi
  echo ""
}

load_env() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || die "Missing env file: ${env_file}"

  # 说明：
  # - set -a 会把后续 source 产生的变量自动 export；
  # - 生产 env 文件通常是 `KEY=VALUE` 或 `export KEY=VALUE` 形式；
  # - 不在这里做复杂解析，失败时让 bash 报错即可（比“吞错继续启动”更安全）。
  # shellcheck disable=SC1090
  set -a
  source "${env_file}"
  set +a
}

require_var() {
  # 说明：启动前的最小预检，避免“跑起来才发现缺配置”。
  local name="$1"
  local value="${!name:-}"
  if [[ -z "${value}" ]]; then
    die "Missing required env: ${name}"
  fi
}

find_binary() {
  if [[ -n "${BINARY_PATH:-}" ]]; then
    echo "${BINARY_PATH}"
    return 0
  fi
  local binary
  binary="${BACKEND_DIR}/target/release/wxapp-checkin-backend-rust"
  if [[ -x "${binary}" ]]; then
    echo "${binary}"
    return 0
  fi
  echo ""
}

main() {
  local env_file
  env_file="$(detect_env_file)"
  [[ -n "${env_file}" ]] || die "No env file found. Set WXAPP_PROD_ENV_FILE or create /etc/wxcheckin/backend-rust.prod.env"

  load_env "${env_file}"

  # 生产最小预检：Rust 正式链路只需要单库 `suda_union` 和签名密钥。
  require_var "DATABASE_URL"
  require_var "QR_SIGNING_KEY"

  local binary
  binary="$(find_binary)"
  [[ -n "${binary}" ]] || die "Missing release binary under ${BACKEND_DIR}/target/release. Build first: (cd backend-rust && cargo build --release)"

  log "Env file: ${env_file}"
  log "Binary: ${binary}"
  log "Starting backend-rust (prod)..."
  exec "${binary}"
}

main "$@"
