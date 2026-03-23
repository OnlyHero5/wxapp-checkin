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

  case "${host_port_part}" in
    *:*)
      LEGACY_DB_HOST="${host_port_part%%:*}"
      LEGACY_DB_PORT="${host_port_part##*:}"
      ;;
    *)
      LEGACY_DB_HOST="${host_port_part}"
      LEGACY_DB_PORT='3306'
      ;;
  esac
  LEGACY_DB_SCHEMA="${schema_part}"

  # 用户明确把 legacy 口径绑定到 suda_union，
  # 所以这里一旦不是这个库名，就直接按 legacy 配置错误处理。
  if [ "${LEGACY_DB_SCHEMA}" != 'suda_union' ]; then
    fail "suda_union 数据库连接问题：LEGACY_DB_URL 未指向 suda_union"
  fi
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
  require_env "LEGACY_DB_URL"
  require_env "LEGACY_DB_USER"
  require_env "REDIS_HOST"
  require_env "REDIS_PORT"

  ensure_command "mysql" "数据库预检无法执行"
  ensure_command "redis-cli" "Redis 预检无法执行"

  parse_legacy_jdbc_url "${LEGACY_DB_URL}"
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
    "${LEGACY_DB_USER}" \
    "${LEGACY_DB_PASSWORD-}"
  check_redis_connection

  log_info "依赖预检通过，开始启动 Spring Boot"
}

main "$@"
