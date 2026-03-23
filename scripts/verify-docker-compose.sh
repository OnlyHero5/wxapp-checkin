#!/usr/bin/env bash
set -euo pipefail

# 这个脚本只做“仓库级 docker compose 是否满足一键起前后端”的静态校验。
# 约束故意收得比较窄：
# - 必须从仓库根目录存在统一 compose 入口；
# - 必须同时包含 mysql / redis / backend / web 四个服务；
# - 默认只允许 `web` 对外暴露宿主机 89 端口；
# - MySQL / Redis / backend 默认都不能直接暴露到宿主机；
# - backend / web 需要有健康检查，避免 `up` 后立刻误判可用。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

fail() {
  echo "[verify-compose] $*" >&2
  exit 1
}

require_service() {
  local service_name="$1"
  if ! printf '%s\n' "${SERVICES}" | rg -qx "${service_name}"; then
    fail "缺少服务：${service_name}"
  fi
}

cd "${REPO_ROOT}"

SERVICES="$(docker compose config --services)"
CONFIG_RENDERED="$(docker compose config)"

require_service "mysql"
require_service "redis"
require_service "backend"
require_service "web"

# MySQL 8.4 已移除 `default-authentication-plugin` 这个启动参数。
# 这里显式禁止仓库级 compose 渲染结果再带上它，避免容器初始化到一半后直接异常退出。
if printf '%s\n' "${CONFIG_RENDERED}" | rg -q 'default-authentication-plugin'; then
  fail "compose 仍包含已移除的 MySQL 参数：default-authentication-plugin"
fi

# 生产口径下整套 compose 应只保留一个外部入口：web 的 89 端口。
# 这里先抽取全部 published 端口，再判断是否混入了多余映射。
PUBLISHED_PORTS="$(
  printf '%s\n' "${CONFIG_RENDERED}" \
    | rg -o 'published: "[0-9]+"' \
    | sed -E 's/.*"([0-9]+)"/\1/' \
    || true
)"

if [[ -z "${PUBLISHED_PORTS}" ]]; then
  fail "默认应暴露 web 的 89 端口"
fi

UNEXPECTED_PORTS="$(printf '%s\n' "${PUBLISHED_PORTS}" | rg -vx '89' || true)"
if [[ -n "${UNEXPECTED_PORTS}" ]]; then
  fail "默认只允许暴露宿主机 89 端口，发现：$(printf '%s' "${UNEXPECTED_PORTS}" | paste -sd ',' -)"
fi

if ! printf '%s\n' "${CONFIG_RENDERED}" | rg -q '(?s)web:.*?published: "89"' -U; then
  fail "web 默认应映射宿主机 89 端口"
fi

# 数据库、缓存、后端都不应再直接对宿主机开放调试口，避免单机部署时边界外泄。
if printf '%s\n' "${PUBLISHED_PORTS}" | rg -q '^(3306|6379|8080|8088)$'; then
  fail "MySQL/Redis/backend 默认不应映射宿主机端口"
fi

# backend / web 都应声明健康检查，便于依赖编排和验收。
if ! printf '%s\n' "${CONFIG_RENDERED}" | rg -q '(?s)backend:.*?healthcheck:' -U; then
  fail "backend 缺少健康检查"
fi

if ! printf '%s\n' "${CONFIG_RENDERED}" | rg -q '(?s)web:.*?healthcheck:' -U; then
  fail "web 缺少健康检查"
fi

# 仓库现在会直接提交 docker/compose.override.env 模板文件。
# 为了保持“空文件 = 演示模式”的约定，模板里不能存在活跃的空值赋值，
# 否则 Compose 会把空字符串注入容器，导致 Spring 侧把 legacy host 解析成空串。
if rg -n '^[[:space:]]*SUDA_UNION_DB_(HOST|USER|PASSWORD)=' docker/compose.override.env >/dev/null 2>&1; then
  fail "docker/compose.override.env 不能包含活跃的 SUDA_UNION_DB_* 赋值；请改成注释示例"
fi

if rg -n '^[[:space:]]*SUDA_UNION_DB_(HOST|USER|PASSWORD)=' docker/compose.override.env.example >/dev/null 2>&1; then
  fail "docker/compose.override.env.example 不能包含活跃的 SUDA_UNION_DB_* 赋值；请改成注释示例"
fi

echo "[verify-compose] docker compose 静态校验通过"
