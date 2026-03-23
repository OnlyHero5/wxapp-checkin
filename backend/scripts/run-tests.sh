#!/usr/bin/env bash
set -euo pipefail

# 统一测试入口除了跑 Maven 用例，还要先覆盖 Docker 启动前预检脚本；
# 原因是这部分逻辑发生在 Spring Boot 之外，单靠 Java 单测无法兜住入口回归。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"
bash scripts/test-docker-preflight.sh
./mvnw clean test
