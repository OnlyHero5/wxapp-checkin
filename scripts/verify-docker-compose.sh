#!/usr/bin/env bash
set -euo pipefail

# 这个脚本只做“仓库级 docker compose 是否满足一键起前后端”的静态校验。
# 约束故意收得比较窄：
# - 必须从仓库根目录存在统一 compose 入口；
# - 必须同时包含 mysql / redis / backend / web 四个服务；
# - MySQL / Redis 默认不能直接暴露到宿主机；
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

# 生产口径下数据库与缓存应只留在 compose 内网；若要开放调试端口，应通过 override 文件显式开启。
if printf '%s\n' "${CONFIG_RENDERED}" | rg -q 'published: "3306"|published: "6379"'; then
  fail "MySQL/Redis 默认不应映射宿主机端口"
fi

# backend / web 都应声明健康检查，便于依赖编排和验收。
if ! printf '%s\n' "${CONFIG_RENDERED}" | rg -q '(?s)backend:.*?healthcheck:' -U; then
  fail "backend 缺少健康检查"
fi

if ! printf '%s\n' "${CONFIG_RENDERED}" | rg -q '(?s)web:.*?healthcheck:' -U; then
  fail "web 缺少健康检查"
fi

echo "[verify-compose] docker compose 静态校验通过"
