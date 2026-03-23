#!/usr/bin/env bash
set -euo pipefail

# 这个回归脚本先固定 Docker 预检脚本的入口路径，
# 后续所有“缺配置 / 依赖不可达 / 彩色日志”断言都在这里扩展，
# 这样维护者排查 Docker 启动问题时只需要记住一个测试入口。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PRECHECK_SCRIPT="${PROJECT_ROOT}/scripts/docker-preflight.sh"

# 第一阶段只验证文件契约是否成立：
# - 预检脚本必须放在 backend/scripts 下；
# - 如果文件不存在，直接失败，避免后续入口接线时路径漂移。
if [[ ! -f "${PRECHECK_SCRIPT}" ]]; then
  echo "[preflight-test] missing ${PRECHECK_SCRIPT}" >&2
  exit 1
fi
