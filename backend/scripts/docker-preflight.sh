#!/bin/sh
set -eu

# 这层脚本存在的目的不是替代 Spring Boot 健康检查，
# 而是把“容器为什么现在就不该继续启动”提前讲清楚。
# 维护时应优先保留清晰诊断和快速失败，不要把这里膨胀成业务逻辑入口。
PURPLE='\033[35m'
RESET='\033[0m'
PREFIX='[wxcheckin-preflight]'

LEGACY_DB_HOST=''
LEGACY_DB_PORT=''
LEGACY_DB_SCHEMA=''
LEGACY_DB_USERNAME=''
LEGACY_DB_PASSWORD_VALUE=''

log_info() {
  printf '%b%s %s%b\n' "${PURPLE}" "${PREFIX}" "$1" "${RESET}"
}

fail() {
  log_info "$1"
  exit 1
}

require_env() {
  variable_name="$1"
  eval "variable_value=\${${variable_name}-}"

  # 这里不做复杂格式校验，只兜住“根本没配”的高价值问题；
  # 更细的格式错误交给后续专门检查（例如 JDBC URL 解析）处理。
  if [ -z "${variable_value}" ]; then
    fail "缺少环境变量：${variable_name}"
  fi
}

ensure_command() {
  command_name="$1"
  display_name="$2"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    fail "${display_name}：容器内缺少 ${command_name} 命令"
  fi
}

first_non_blank() {
  for candidate in "$@"; do
    if [ -n "${candidate}" ]; then
      printf '%s' "${candidate}"
      return 0
    fi
  done
  printf '%s' ''
}

parse_host_with_optional_port() {
  raw_host="$1"
  default_port="$2"
  error_message="$3"

  # 外部 legacy 配置现在允许直接写成 host:port；
  # 这里保持 shell 侧只做最小拆分，具体合法性仍交给 mysql 客户端报错。
  case "${raw_host}" in
    *:*)
      parsed_host="${raw_host%%:*}"
      parsed_port="${raw_host##*:}"
      ;;
    *)
      parsed_host="${raw_host}"
      parsed_port="${default_port}"
      ;;
  esac

  if [ -z "${parsed_host}" ] || [ -z "${parsed_port}" ]; then
    fail "${error_message}"
  fi

  LEGACY_DB_HOST="${parsed_host}"
  LEGACY_DB_PORT="${parsed_port}"
}

parse_legacy_jdbc_url() {
  jdbc_url="$1"

  case "${jdbc_url}" in
    jdbc:mysql://*)
      ;;
    *)
      fail "suda_union 数据库连接问题：LEGACY_DB_URL 必须使用 jdbc:mysql://"
      ;;
  esac

  url_without_prefix="${jdbc_url#jdbc:mysql://}"
  url_without_query="${url_without_prefix%%\?*}"
  host_port_part="${url_without_query%%/*}"
  schema_part="${url_without_query#*/}"

  if [ "${host_port_part}" = "${url_without_query}" ] || [ -z "${schema_part}" ]; then
    fail "suda_union 数据库连接问题：LEGACY_DB_URL 缺少库名"
  fi

  parse_host_with_optional_port \
    "${host_port_part}" \
    '3306' \
    "suda_union 数据库连接问题：LEGACY_DB_URL 主机格式错误"
  LEGACY_DB_SCHEMA="${schema_part}"

  # 用户明确把 legacy 口径绑定到 suda_union，
  # 所以这里一旦不是这个库名，就直接按 legacy 配置错误处理。
  if [ "${LEGACY_DB_SCHEMA}" != 'suda_union' ]; then
    fail "suda_union 数据库连接问题：LEGACY_DB_URL 未指向 suda_union"
  fi
}

resolve_legacy_connection() {
  legacy_url="${LEGACY_DB_URL-}"
  legacy_user="${LEGACY_DB_USER-}"
  legacy_password="${LEGACY_DB_PASSWORD-}"
  suda_union_host="${SUDA_UNION_DB_HOST-}"
  suda_union_user="${SUDA_UNION_DB_USER-}"
  suda_union_password="${SUDA_UNION_DB_PASSWORD-}"

  # 兼容旧部署：如果仍然显式提供 LEGACY_DB_URL，则按历史口径继续工作，
  # 避免这次变量收口让已有环境直接失效。
  if [ -n "${legacy_url}" ]; then
    parse_legacy_jdbc_url "${legacy_url}"
    LEGACY_DB_USERNAME="$(first_non_blank "${legacy_user}" "${suda_union_user}" "${DB_USER-}")"
    LEGACY_DB_PASSWORD_VALUE="$(first_non_blank "${legacy_password}" "${suda_union_password}" "${DB_PASSWORD-}")"
    log_info "检测到 LEGACY_DB_URL，当前按兼容 legacy 配置模式启动"
    return 0
  fi

  if [ -z "${suda_union_host}" ] && [ -z "${suda_union_user}" ] && [ -z "${suda_union_password}" ]; then
    # 单项目演示状态走 compose 内 demo `suda_union`；
    # 必须显式提示“非生产在线状态”，避免使用者误以为已连到真实老库。
    LEGACY_DB_HOST="${DB_HOST}"
    LEGACY_DB_PORT="${DB_PORT}"
    LEGACY_DB_SCHEMA='suda_union'
    LEGACY_DB_USERNAME="${DB_USER}"
    LEGACY_DB_PASSWORD_VALUE="${DB_PASSWORD-}"
    log_info "未填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD，当前是单项目演示状态，非生产在线状态"
    return 0
  fi

  if [ -n "${suda_union_host}" ] && [ -n "${suda_union_user}" ] && [ -n "${suda_union_password}" ]; then
    parse_host_with_optional_port \
      "${suda_union_host}" \
      '3306' \
      "suda_union 外部配置不完整：SUDA_UNION_DB_HOST 必须填写主机名，或写成 host:port"
    LEGACY_DB_SCHEMA='suda_union'
    LEGACY_DB_USERNAME="${suda_union_user}"
    LEGACY_DB_PASSWORD_VALUE="${suda_union_password}"
    log_info "已填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD，当前按外部 suda_union 模式启动"
    return 0
  fi

  fail "suda_union 外部配置不完整：请同时填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD"
}

run_mysql_query() {
  host="$1"
  port="$2"
  database="$3"
  username="$4"
  password="$5"

  if [ -n "${password}" ]; then
    MYSQL_PWD="${password}" mysql \
      --protocol=TCP \
      --connect-timeout=3 \
      --host="${host}" \
      --port="${port}" \
      --user="${username}" \
      --database="${database}" \
      --batch \
      --skip-column-names \
      --execute='SELECT 1;'
    return 0
  fi

  mysql \
    --protocol=TCP \
    --connect-timeout=3 \
    --host="${host}" \
    --port="${port}" \
    --user="${username}" \
    --database="${database}" \
    --batch \
    --skip-column-names \
    --execute='SELECT 1;'
}

check_mysql_connection() {
  label="$1"
  host="$2"
  port="$3"
  database="$4"
  username="$5"
  password="$6"

  log_info "检查 ${database} 数据库连通性"
  if output="$(run_mysql_query "${host}" "${port}" "${database}" "${username}" "${password}" 2>&1)"; then
    return 0
  fi

  fail "${label}：无法连接 ${host}:${port}/${database} (${output})"
}

check_redis_connection() {
  log_info "检查 Redis 连通性"

  if [ -n "${REDIS_PASSWORD-}" ]; then
    if output="$(REDISCLI_AUTH="${REDIS_PASSWORD}" redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" ping 2>&1)"; then
      return 0
    fi
  elif output="$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" ping 2>&1)"; then
    return 0
  fi

  fail "Redis 连接问题：无法连接 ${REDIS_HOST}:${REDIS_PORT} (${output})"
}

main() {
  log_info "开始检查 Docker 启动依赖"

  require_env "DB_HOST"
  require_env "DB_PORT"
  require_env "DB_NAME"
  require_env "DB_USER"
  require_env "REDIS_HOST"
  require_env "REDIS_PORT"

  ensure_command "mysql" "数据库预检无法执行"
  ensure_command "redis-cli" "Redis 预检无法执行"

  resolve_legacy_connection
  check_mysql_connection \
    "wxcheckin_ext 数据库连接问题" \
    "${DB_HOST}" \
    "${DB_PORT}" \
    "${DB_NAME}" \
    "${DB_USER}" \
    "${DB_PASSWORD-}"
  check_mysql_connection \
    "suda_union 数据库连接问题" \
    "${LEGACY_DB_HOST}" \
    "${LEGACY_DB_PORT}" \
    "${LEGACY_DB_SCHEMA}" \
    "${LEGACY_DB_USERNAME}" \
    "${LEGACY_DB_PASSWORD_VALUE}"
  check_redis_connection

  log_info "依赖预检通过，开始启动 Spring Boot"
}

main "$@"
