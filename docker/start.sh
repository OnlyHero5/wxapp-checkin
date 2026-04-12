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
NGINX_PID=""

cleanup() {
  local pid
  for pid in "${BACKEND_PID:-}" "${NGINX_PID:-}"; do
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done

  for pid in "${BACKEND_PID:-}" "${NGINX_PID:-}"; do
    if [[ -n "${pid}" ]]; then
      wait "${pid}" 2>/dev/null || true
    fi
  done
}

handle_signal() {
  local exit_code="$1"
  trap - EXIT INT TERM
  cleanup
  exit "${exit_code}"
}

trap cleanup EXIT
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

# 容器内固定把 Rust 后端收敛到 8080；
# 宿主机不会直接映射它，避免绕开 Nginx 的单入口约束。
export SERVER_PORT="${SERVER_PORT:-8080}"

# 后端直接继承容器 stdout/stderr：
# - 紫色/蓝色关键标识能第一时间出现在 `docker logs`
# - 不再把日志复制到容器文件系统，避免有限磁盘持续堆积文本日志
/usr/local/bin/wxapp-checkin-backend-rust &
BACKEND_PID="$!"

# nginx 也交给当前 shell 监管：
# - 任一关键子进程退出都视为容器失败；
# - `docker stop` 时 shell 会先转发信号，再统一回收剩余子进程。
nginx -g 'daemon off;' &
NGINX_PID="$!"

set +e
wait -n "${BACKEND_PID}" "${NGINX_PID}"
EXIT_STATUS="$?"
set -e

if [[ "${EXIT_STATUS}" -eq 0 ]]; then
  echo "[wxapp-start] critical child exited unexpectedly" >&2
  EXIT_STATUS=1
fi

cleanup
trap - EXIT
exit "${EXIT_STATUS}"
