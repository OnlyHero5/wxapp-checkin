# QR Production Hardening (Point 2/3/4) Implementation Notes

> **Status:** complete (2026-02-28)
>
> **Goal:** Make `QR_SIGNING_KEY` actually protect QR payloads, stop `wx_qr_issue_log`/`wx_replay_guard` unbounded growth, and make rotate/grace behavior consistent between issue and consume.

## 1) What We Implemented

### 1.1 Signed nonce (Fix Point 2)

- QR payload 协议保持不变（6 段，按 `:` 分割）：

```text
wxcheckin:v1:<activity_id>:<action_type>:<slot>:<nonce>
```

- 仅 `nonce` 变为 **signed nonce**（防篡改/防伪造，且不破坏前端解析契约）：
  - `nonce = randomPart(22) + sigPart(43) = 65 chars`
  - `sigPart = base64url(HMAC-SHA256("wxcheckin:v1|activity_id|action_type|slot|randomPart"))`
  - HMAC key: `app.qr.signing-key`（环境变量 `QR_SIGNING_KEY`）

**Files:**
- `backend/src/main/java/com/wxcheckin/backend/application/support/QrNonceSigner.java`
- `backend/src/test/java/com/wxcheckin/backend/application/support/QrNonceSignerTest.java`

### 1.2 Consume-side signature verification (Fix Point 2 completion)

- A-06 consume 对 signed nonce 做验签：
  - signed nonce：必须验签通过
  - legacy unsigned nonce：仅在 `app.qr.allow-legacy-unsigned=true` 时允许，并回退到 `wx_qr_issue_log` 存在性校验

**Files:**
- `backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java`

### 1.3 Stop `wx_qr_issue_log` growth (Fix Point 3)

- 新增开关 `app.qr.issue-log-enabled`（`QR_ISSUE_LOG_ENABLED`）：
  - `false` 时 A-05 不写 `wx_qr_issue_log`
  - signed nonce 模式下仍可正常 consume（不依赖 issue log）

**Files:**
- `backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java`
- `backend/src/main/java/com/wxcheckin/backend/config/AppProperties.java`
- `backend/src/main/resources/application.yml`

### 1.4 Periodic retention cleanup (Fix Point 3)

- 新增 `QrMaintenanceJob` 定期清理：
  - `wx_qr_issue_log`（按 `accept_expire_at` + retention）
  - `wx_replay_guard`（按 `expires_at` + retention）

**Files:**
- `backend/src/main/java/com/wxcheckin/backend/application/service/QrMaintenanceJob.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/QrMaintenanceJobTest.java`

### 1.5 DB indexes for perf (Fix Point 3)

- 新增 Flyway migration：
  - `backend/src/main/resources/db/migration/V5__add_qr_retention_indexes.sql`
  - 增加 `wx_qr_issue_log(activity_id, action_type, slot, nonce)` 与 `wx_qr_issue_log(accept_expire_at)`

### 1.6 Rotate/grace override consistency (Fix Point 4)

- A-05 request 的 `rotate_seconds/grace_seconds` override 会持久化到 `wx_activity_projection`，使 issue/consume 使用同一套 rotate/grace 口径。

**Files:**
- `backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java`

## 2) Configuration (Important)

| Key | Env | Default | Notes |
|---|---|---:|---|
| `app.qr.signing-key` | `QR_SIGNING_KEY` | placeholder | **prod 必须替换**（且 `prod` 下为空/占位符会启动失败） |
| `app.qr.issue-log-enabled` | `QR_ISSUE_LOG_ENABLED` | `true` | 生产建议 `false`（止血：不再增长） |
| `app.qr.allow-legacy-unsigned` | `QR_ALLOW_LEGACY_UNSIGNED` | `true` | 稳定后建议 `false` |
| `app.qr.issue-log-retention-seconds` | `QR_ISSUE_LOG_RETENTION_SECONDS` | `86400` | issue log 保留秒数 |
| `app.qr.replay-guard-retention-seconds` | `QR_REPLAY_GUARD_RETENTION_SECONDS` | `0` | 到期即可删 |
| `app.qr.cleanup-enabled` | `QR_CLEANUP_ENABLED` | `true` | 是否启用清理任务 |
| `app.qr.cleanup-interval-ms` | `QR_CLEANUP_INTERVAL_MS` | `300000` | 清理间隔（毫秒） |

## 3) Production Upgrade Notes

- `prod` profile 默认关闭 Flyway（见 `backend/src/main/resources/application-prod.yml`），因此升级索引需要手动执行一次：

```bash
cd wxapp-checkin/backend
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_ADMIN_USER> -p wxcheckin_ext < src/main/resources/db/migration/V5__add_qr_retention_indexes.sql
```

## 4) Verification Evidence

本次变更已通过自动化测试验证：

```bash
cd wxapp-checkin/backend
./mvnw test
```

关键覆盖点：
- nonce 签名与验签（篡改拒绝）
- issue log 缺失/禁用时仍可 consume（验签通过）
- rotate/grace override 持久化一致性
- retention cleanup job 删除过期数据
