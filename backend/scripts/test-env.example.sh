#!/usr/bin/env bash

# 本文件是 `backend/scripts/start-test-env.sh` 的最小示例。
# 使用方式：
# 1. cp backend/scripts/test-env.example.sh ~/.wxapp-checkin-test-env.sh
# 2. 按本机 MySQL / Redis 实际情况修改下面变量
# 3. 再执行 `./scripts/start-test-env.sh`

export SPRING_PROFILES_ACTIVE=dev
export SERVER_PORT=9989

# 扩展库（wxcheckin_ext）
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_NAME=wxcheckin_ext
export DB_USER=root
export DB_PASSWORD=

# 遗留库（suda_union）
export LEGACY_DB_URL="jdbc:mysql://127.0.0.1:3306/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false"
export LEGACY_DB_USER=root
export LEGACY_DB_PASSWORD=

# Redis
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
export REDIS_PASSWORD=

# Web 身份（账号密码）
# - 默认密码固定为 123
# - 首次登录后强制改密
# - 不再需要配置 WEBAUTHN_*（Passkey/WebAuthn 已从主链路移除）

# 动态码 / 同步
export QR_SIGNING_KEY=replace-with-a-local-dev-secret
export LEGACY_SYNC_ENABLED=true
export LEGACY_SYNC_INTERVAL_MS=2000
export OUTBOX_RELAY_ENABLED=true
export OUTBOX_RELAY_INTERVAL_MS=2000
