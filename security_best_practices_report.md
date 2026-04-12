# wxapp-checkin Security Best Practices Report

日期：2026-04-12

## Executive Summary

当前版本已补齐大部分上线前安全与一致性缺陷，剩余主要风险是你明确要求暂时不处理的密钥问题：

1. 会话与动态码仍共用同一签名密钥，且上线链路不拦截占位密钥。
2. WebKit / iOS Safari 自动化验证已补仓库能力，但当前宿主机缺少系统依赖，尚未在本机执行。

## Findings

### P0

#### SEC-001 会话与动态码共用密钥，且配置层不拒绝占位值

- 位置：
  - `backend-rust/src/app_state.rs:31`
  - `backend-rust/src/config.rs:28`
  - `backend-rust/.env.example:10`
  - `backend-rust/.env.prod.example:12`
  - `docker-compose.yml:20`
  - `scripts/docker-prod.sh:62`
  - `scripts/prod-backend.sh:88`
- 影响：一旦占位值误上生产，或签名密钥泄漏，攻击者可同时伪造 JWT 会话与有效动态码，导致鉴权和签到链路一起失守。
- 修复：
  - 拆分 `SESSION_SIGNING_KEY` 与 `QR_SIGNING_KEY`
  - 启动时拒绝 `replace-*` / 示例值 / 过短密钥
  - 轮换现有密钥并补上线前校验

### Fixed This Round

- 登录接口对外已统一收口为 `invalid_credentials`，并增加客户端 IP 维度限流。
- 登录失败、普通用户签到/签退、staff 名单修正、staff 批量签退已开始记录真实客户端 IP。
- staff 高风险动作已在服务端补名单异常态闸门。
- 活动统计口径已统一过滤取消报名残留状态。
- 前端已落地 `session_expires_at` 本地过期清理。
- nginx 已补基础安全头。

## Verification

- `cd web && npm test`
- `cd web && npm run lint`
- `cd web && npm run build`
- `cd web && npm run test:e2e`
- `cd backend-rust && cargo test`
- `cd backend-rust && cargo clippy --all-targets --all-features -- -D warnings`
- `cd backend-rust && cargo build --release`
