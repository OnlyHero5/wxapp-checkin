#!/usr/bin/env bash
set -euo pipefail

# wxapp-checkin 一键 bootstrap：
# - 只负责“生成 Rust 后端/前端本地配置文件与运行目录”，不启动服务；
# - 幂等：仅在文件缺失时创建，绝不覆盖已有本地配置；
# - 默认把配置/产物落在仓库内（或多项目工作区的 local_dev/runtime 下），避免写到 ~ / /tmp。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() {
  echo "[bootstrap] $*"
}

ensure_dir() {
  local dir_path="$1"
  if [[ ! -d "${dir_path}" ]]; then
    mkdir -p "${dir_path}"
  fi
}

runtime_dir() {
  # 说明：
  # - 多项目工作区推荐写到 workspace 根目录的 local_dev/runtime/ 下，便于集中管理联调日志；
  # - 若不存在该目录，则 fallback 到仓库内 local_dev/runtime/，并由 .gitignore 忽略。
  local workspace_root
  workspace_root="$(cd "${REPO_ROOT}/.." && pwd)"
  if [[ -d "${workspace_root}/local_dev" ]]; then
    echo "${workspace_root}/local_dev/runtime/wxapp-checkin"
    return 0
  fi
  echo "${REPO_ROOT}/local_dev/runtime"
}

ensure_file() {
  local target_path="$1"
  local template_path="$2"
  if [[ -f "${target_path}" ]]; then
    log "Skip (exists): ${target_path}"
    return 0
  fi
  if [[ ! -f "${template_path}" ]]; then
    echo "[bootstrap] Missing template: ${template_path}" >&2
    exit 1
  fi
  cp "${template_path}" "${target_path}"
  log "Created: ${target_path}"
}

main() {
  local backend_env="${REPO_ROOT}/backend-rust/.env.local.sh"
  local backend_env_example="${REPO_ROOT}/backend-rust/.env.example"
  local backend_prod_env="${REPO_ROOT}/backend-rust/.env.prod"
  local backend_prod_env_example="${REPO_ROOT}/backend-rust/.env.prod.example"

  local web_env_local="${REPO_ROOT}/web/.env.local"
  local web_env_example="${REPO_ROOT}/web/.env.example"

  local rt_dir
  rt_dir="$(runtime_dir)"

  ensure_dir "${rt_dir}"
  ensure_file "${backend_env}" "${backend_env_example}"
  ensure_file "${backend_prod_env}" "${backend_prod_env_example}"
  ensure_file "${web_env_local}" "${web_env_example}"

  log "Runtime dir: ${rt_dir}"
  log "Next:"
  log "  ./scripts/dev.sh local      # 本机 MySQL + Rust 后端 9989 + web dev"
  log "  ./scripts/prod-backend.sh   # 启动 release 版 Rust 后端"
}

main "$@"
