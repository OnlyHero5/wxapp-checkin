#!/usr/bin/env bash
set -euo pipefail

# 这个脚本负责回归 Docker 启动前的预检逻辑。
# 由于预检发生在 Spring Boot 之外，这里用 stub 命令模拟 MySQL / Redis，
# 保证在没有真实依赖服务的开发机上也能稳定验证诊断文案和失败路径。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PRECHECK_SCRIPT="${PROJECT_ROOT}/scripts/docker-preflight.sh"
DOCKERFILE_PATH="${PROJECT_ROOT}/Dockerfile"
TEST_ROOT="${PROJECT_ROOT}/target/preflight-test"
STUB_BIN_DIR="${TEST_ROOT}/bin"
OUTPUT_FILE="${TEST_ROOT}/output.log"

LAST_STATUS=0
LAST_OUTPUT=""

assert_contains() {
  local expected="$1"
  if [[ "${LAST_OUTPUT}" != *"${expected}"* ]]; then
    echo "[preflight-test] expected output to contain: ${expected}" >&2
    echo "[preflight-test] actual output:" >&2
    printf '%s\n' "${LAST_OUTPUT}" >&2
    exit 1
  fi
}

assert_not_contains() {
  local unexpected="$1"
  if [[ "${LAST_OUTPUT}" == *"${unexpected}"* ]]; then
    echo "[preflight-test] expected output to not contain: ${unexpected}" >&2
    echo "[preflight-test] actual output:" >&2
    printf '%s\n' "${LAST_OUTPUT}" >&2
    exit 1
  fi
}

assert_status() {
  local expected="$1"
  if [[ "${LAST_STATUS}" -ne "${expected}" ]]; then
    echo "[preflight-test] expected status ${expected}, got ${LAST_STATUS}" >&2
    printf '%s\n' "${LAST_OUTPUT}" >&2
    exit 1
  fi
}

assert_file_contains() {
  local file_path="$1"
  local expected="$2"

  if ! grep -F "${expected}" "${file_path}" >/dev/null 2>&1; then
    echo "[preflight-test] expected ${file_path} to contain: ${expected}" >&2
    exit 1
  fi
}

prepare_stub_bin() {
  rm -rf "${TEST_ROOT}"
  mkdir -p "${STUB_BIN_DIR}"

  # mysql stub 通过环境变量控制失败目标库名；
  # 这样测试既能覆盖 `wxcheckin_ext`，也能覆盖 `suda_union`，
  # 不需要在本机额外启动真实数据库。
  cat <<'EOF' > "${STUB_BIN_DIR}/mysql"
#!/usr/bin/env bash
set -euo pipefail

database_name=""
for arg in "$@"; do
  case "${arg}" in
    --database=*)
      database_name="${arg#--database=}"
      ;;
  esac
done

if [[ -n "${MYSQL_STUB_FAIL_FOR:-}" && "${database_name}" == "${MYSQL_STUB_FAIL_FOR}" ]]; then
  echo "simulated mysql failure for ${database_name}" >&2
  exit 1
fi

exit 0
EOF
  chmod +x "${STUB_BIN_DIR}/mysql"

  # redis-cli stub 只关心成功/失败，不复刻 Redis 全协议；
  # 维护重点是“脚本是否在失败时输出清晰文案”，不是测试第三方客户端。
  cat <<'EOF' > "${STUB_BIN_DIR}/redis-cli"
#!/usr/bin/env bash
set -euo pipefail

if [[ "${REDIS_STUB_FAIL:-0}" == "1" ]]; then
  echo "simulated redis failure" >&2
  exit 1
fi

echo "PONG"
EOF
  chmod +x "${STUB_BIN_DIR}/redis-cli"
}

run_precheck() {
  local -a env_pairs=(
    "PATH=${STUB_BIN_DIR}:/usr/bin:/bin"
    "DB_HOST=mysql"
    "DB_PORT=3306"
    "DB_NAME=wxcheckin_ext"
    "DB_USER=wxcheckin"
    "DB_PASSWORD=wxcheckin"
    "REDIS_HOST=redis"
    "REDIS_PORT=6379"
    "REDIS_PASSWORD="
    "MYSQL_STUB_FAIL_FOR="
    "REDIS_STUB_FAIL=0"
  )

  if [[ ! -f "${PRECHECK_SCRIPT}" ]]; then
    echo "[preflight-test] missing ${PRECHECK_SCRIPT}" >&2
    exit 1
  fi

  # env -i 用来隔离调用环境，避免本机已有的数据库变量污染回归结果；
  # 额外参数会覆盖默认值，用于构造“缺配置 / 依赖失败”等分支。
  set +e
  env -i "${env_pairs[@]}" "$@" sh "${PRECHECK_SCRIPT}" > "${OUTPUT_FILE}" 2>&1
  LAST_STATUS=$?
  set -e
  LAST_OUTPUT="$(cat "${OUTPUT_FILE}")"
}

main() {
  prepare_stub_bin

  # 先固定最基本的日志契约，避免后续维护时把颜色或前缀改丢。
  run_precheck
  assert_status 0
  assert_contains "[wxcheckin-preflight]"
  assert_contains $'\033[35m'
  assert_contains "开始检查 Docker 启动依赖"
  assert_contains "未填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD"
  assert_contains "单项目演示状态，非生产在线状态"
  assert_contains "依赖预检通过，开始启动 Spring Boot"

  # 用户这次明确要把 legacy 配置收口成 3 个值；
  # 因此只填一部分时必须直接失败，避免演示模式和在线模式混淆。
  run_precheck "SUDA_UNION_DB_HOST=legacy-db"
  assert_status 1
  assert_contains "suda_union 外部配置不完整"

  run_precheck \
    "SUDA_UNION_DB_HOST=legacy-db" \
    "SUDA_UNION_DB_USER=legacy_user" \
    "SUDA_UNION_DB_PASSWORD=legacy_pass"
  assert_status 0
  assert_contains "外部 suda_union 模式"

  run_precheck "MYSQL_STUB_FAIL_FOR=suda_union"
  assert_status 1
  assert_contains "suda_union 数据库连接问题"

  run_precheck \
    "SUDA_UNION_DB_HOST=legacy-db" \
    "SUDA_UNION_DB_USER=legacy_user" \
    "SUDA_UNION_DB_PASSWORD=legacy_pass" \
    "MYSQL_STUB_FAIL_FOR=suda_union"
  assert_status 1
  assert_contains "suda_union 数据库连接问题"

  run_precheck \
    "SUDA_UNION_DB_HOST=legacy-db:3499" \
    "SUDA_UNION_DB_USER=legacy_user" \
    "SUDA_UNION_DB_PASSWORD=legacy_pass" \
    "MYSQL_STUB_FAIL_FOR=suda_union"
  assert_status 1
  assert_contains "suda_union 数据库连接问题"
  assert_contains "legacy-db:3499/suda_union"
  assert_not_contains "legacy-db:3499:3306/suda_union"

  run_precheck "MYSQL_STUB_FAIL_FOR=wxcheckin_ext"
  assert_status 1
  assert_contains "wxcheckin_ext 数据库连接问题"

  run_precheck "REDIS_STUB_FAIL=1"
  assert_status 1
  assert_contains "Redis 连接问题"

  # Dockerfile 契约保证线上镜像和本地测试使用同一套入口能力：
  # - 镜像里必须复制预检脚本；
  # - 必须安装 mysql / redis 的最小探测工具；
  # - 启动前必须先执行预检脚本。
  assert_file_contains "${DOCKERFILE_PATH}" "docker-preflight.sh"
  assert_file_contains "${DOCKERFILE_PATH}" "redis-tools"
  if ! grep -E "default-mysql-client|mariadb-client" "${DOCKERFILE_PATH}" >/dev/null 2>&1; then
    echo "[preflight-test] expected ${DOCKERFILE_PATH} to install a mysql client" >&2
    exit 1
  fi
}

main "$@"
