#!/usr/bin/env bash
set -euo pipefail

# 生产环境一键启动（后端）：
# - 只做“加载生产 env + 预检 + 启动 jar”，不会做任何测试数据重置；
# - 默认强制使用 `SPRING_PROFILES_ACTIVE=prod`，由后端自动完成 wxcheckin_ext 迁移；
# - legacy `suda_union` 必须预先存在（仅连接，不做 schema 迁移）。
#
# 维护提示：
# - 该脚本不负责构建 jar，也不负责部署 web 静态资源（避免把“打包/发布策略”写死在脚本里）。
# - 若你在生产机器上需要 systemd，请优先按 backend/README.md 的 systemd 方案落地。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"

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
  # - 仓库内的 backend/.env.prod 仅用于“单机演示/排障”，不建议长期保留在代码目录；
  # - 如果你有更标准的运维体系（K8s Secret、Vault 等），请直接用 WXAPP_PROD_ENV_FILE 指向实际文件。
  if [[ -n "${WXAPP_PROD_ENV_FILE:-}" ]]; then
    echo "${WXAPP_PROD_ENV_FILE}"
    return 0
  fi
  if [[ -f "/etc/wxcheckin/backend.prod.env" ]]; then
    echo "/etc/wxcheckin/backend.prod.env"
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

ensure_boolean_true() {
  # 说明：生产环境要求开启双向同步（安全护栏也会在后端校验）。
  local name="$1"
  local value="${!name:-}"
  if [[ "${value}" != "true" ]]; then
    die "Production requires ${name}=true (current: ${value:-<empty>})"
  fi
}

find_jar() {
  # 说明：
  # - 生产环境 jar 通常由 CI/CD 放置到固定路径并由 systemd 托管；
  # - 这里提供一个“仓库内启动”的兜底能力：优先使用 JAR_PATH，其次读取 backend/target 下构建产物。
  if [[ -n "${JAR_PATH:-}" ]]; then
    echo "${JAR_PATH}"
    return 0
  fi
  local jar
  jar="$(ls -1 "${BACKEND_DIR}/target"/backend-*.jar 2>/dev/null | head -n 1 || true)"
  echo "${jar}"
}

main() {
  local env_file
  env_file="$(detect_env_file)"
  [[ -n "${env_file}" ]] || die "No env file found. Set WXAPP_PROD_ENV_FILE or create /etc/wxcheckin/backend.prod.env"

  load_env "${env_file}"

  # 说明：强制 prod profile，避免误用 dev/test 配置导致跑出“带演示数据/重置脚本”的行为。
  export SPRING_PROFILES_ACTIVE="prod"

  # 生产最小预检（更严格的校验在后端 Production*SafetyGuard 内完成）
  # - 扩展库：wxcheckin_ext（允许自动迁移/可选自动建库）
  # - legacy：suda_union（必须预存在，只读/回写，不做 schema 迁移）
  # - Redis：用于会话与同步相关能力
  # - QR_SIGNING_KEY：动态码验签密钥（生产必须强随机）
  require_var "DB_HOST"
  require_var "DB_PORT"
  require_var "DB_NAME"
  require_var "DB_USER"
  require_var "LEGACY_DB_URL"
  require_var "LEGACY_DB_USER"
  require_var "REDIS_HOST"
  require_var "REDIS_PORT"
  require_var "QR_SIGNING_KEY"
  # 生产必须开启双向同步（否则会触发后端启动时的安全校验失败）
  ensure_boolean_true "LEGACY_SYNC_ENABLED"
  ensure_boolean_true "OUTBOX_RELAY_ENABLED"

  local jar
  jar="$(find_jar)"
  # jar 产物通常由 CI 构建并部署；这里仅作为“仓库内启动”的最小可用路径。
  [[ -n "${jar}" ]] || die "Missing backend jar under ${BACKEND_DIR}/target. Build first: (cd backend && ./mvnw -DskipTests clean package)"

  log "Env file: ${env_file}"
  log "Jar: ${jar}"
  # 启动后可用以下方式验证：
  # - 健康检查：curl http://127.0.0.1:${SERVER_PORT:-8080}/actuator/health
  # - systemd 部署：优先用 journalctl 查看日志（避免把日志落到代码目录）
  log "Starting backend (prod)..."
  exec java ${JAVA_OPTS:-} -jar "${jar}"
}

main "$@"
