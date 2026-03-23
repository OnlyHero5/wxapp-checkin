#!/bin/sh
set -eu

# 这层脚本专门负责把 Docker 启动前的依赖状态讲清楚，
# 目标是让维护者在 Spring Boot 尚未输出框架日志前，
# 就能先看到一组稳定、可搜索、颜色统一的诊断信息。
PURPLE='\033[35m'
RESET='\033[0m'
PREFIX='[wxcheckin-preflight]'

log_info() {
  printf '%b%s %s%b\n' "${PURPLE}" "${PREFIX}" "$1" "${RESET}"
}

# 第一版先固定日志骨架：
# - 启动时提示进入预检阶段；
# - 结束时提示即将交给 Spring Boot；
# - 真实的环境变量和连通性检查在后续红灯用例下补齐。
log_info "开始检查 Docker 启动依赖"
log_info "依赖预检通过，开始启动 Spring Boot"
