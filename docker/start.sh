#!/usr/bin/env bash
set -euo pipefail

# 单容器启动脚本同时拉起两个进程：
# 1. Rust 正式后端
# 2. Nginx 同源入口
#
# 设计目标：
# - 宿主机只暴露 89
# - 前后端在容器内部通过 localhost 通信
# - 停止容器时两个进程都能被正确回收
# - 资源受限服务器上不额外落容器内日志文件，统一交给 `docker logs` + Compose 日志轮转

BACKEND_PID=""

cleanup() {
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" || true
    wait "${BACKEND_PID}" || true
  fi
}

trap cleanup EXIT INT TERM

# 容器内固定把 Rust 后端收敛到 8080；
# 宿主机不会直接映射它，避免绕开 Nginx 的单入口约束。
export SERVER_PORT="${SERVER_PORT:-8080}"

# 后端直接继承容器 stdout/stderr：
# - 紫色/蓝色关键标识能第一时间出现在 `docker logs`
# - 不再把日志复制到容器文件系统，避免有限磁盘持续堆积文本日志
/usr/local/bin/wxapp-checkin-backend-rust &
BACKEND_PID="$!"

# 用前台 nginx 托管静态资源并反代 API；
# 这样容器主进程稳定，docker stop 也能按预期回收。
exec nginx -g 'daemon off;'
