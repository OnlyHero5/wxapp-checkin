# pure suda_union 改造映射清单

更新日期：2026-03-26  
适用仓库：`/home/psx/app/wxapp-checkin`

## 1. 目的

本清单用于把“旧能力 -> Rust 正式落点”逐项对齐，避免在删除 `wxcheckin_ext`、`wx_*` 逻辑表和 Java backend 后出现能力盲区。  
当前正式基线以 `web` 分支现状为准，原则是：

- MySQL 只使用 `suda_union`
- 不再保留独立 `wxcheckin_ext`
- 不再把运行态能力建立在 `wx_*` 逻辑表之上
- 对外 `/api/web/**` 契约继续兼容当前 Web 前端
- Rust 后端运行期只写 `suda_activity_apply`、`suda_log`

## 2. 待删除表与当前替代落点

| 旧表 | 原职责 | Rust 正式落点 / 替代方案 | 备注 |
| --- | --- | --- | --- |
| `wx_user_auth_ext` | 扩展用户资料、密码影子、角色快照 | `suda_user` 作为唯一账号源；登录只读 `password`、`role`、`name` 等最小字段 | 当前正式基线不再提供独立改密链路 |
| `wx_admin_roster` | staff 管理员白名单 | 直接读取 `suda_user.role`；Rust 侧把 legacy `role` 映射为 `staff/normal` 并组装 `permissions` | 当前实现把 `0..=3` 视为 `staff` |
| `wx_session` | Web 登录态、权限快照 | 无状态签名 token，继续对外返回 `session_token` | 每次请求验签后再回查 `suda_user`，保证角色最新 |
| `wx_activity_projection` | 活动列表 / 详情读模型 | 直接查询 `suda_activity`，并按需要聚合 `suda_activity_apply` | 对外仍使用兼容 DTO；`activity_id` 继续包装成 `legacy_act_<id>` |
| `wx_user_activity_status` | 用户对活动的报名 / 签到 / 签退状态 | 直接查询 / 更新 `suda_activity_apply` | 普通用户可见性、详情态、名单页状态都从现有表即时计算 |
| `wx_checkin_event` | 用户签到 / 签退事件流水 | `suda_log` 结构化日志 | 既承担用户动作回查，也承担业务审计 |
| `wx_qr_issue_log` | 动态码发码过程日志 | 不再作为运行态依赖；动态码改为按时间槽 HMAC 即算即验 | 如需补运营日志，统一落 `suda_log` |
| `wx_replay_guard` | 防重放保护 | `backend-rust/src/replay_guard.rs` 的进程内 TTL 防重 | 当前正式基线不再以 Redis 为必要依赖 |
| `wx_sync_outbox` | 最终一致性回写 `suda_activity_apply` | 直接更新 `suda_activity_apply`，不再经过 outbox | 删除同步链路后不再需要 |
| `web_admin_audit_log` | staff 高风险动作审计 | `suda_log` 结构化日志 | 与用户动作日志统一归档 |

## 3. 核心业务能力映射

| 能力 | 旧实现 | Rust 正式实现 |
| --- | --- | --- |
| Web 登录 | `wx_user_auth_ext + wx_session` | `suda_user + 无状态 session_token` |
| 角色与权限 | `wx_user_auth_ext.role_code / permissions_json` + `wx_admin_roster` | `suda_user.role` 映射 `role`，权限数组由 Rust 后端组装 |
| 活动列表 / 详情 | `wx_activity_projection` | `suda_activity + suda_activity_apply` 即时查询 |
| 动态码 | 投影表时间窗 + 发码日志 | 直接基于活动时间窗生成 6 位 HMAC 动态码 |
| 签到 / 签退写入 | `wx_user_activity_status + wx_checkin_event + wx_sync_outbox` | `suda_activity_apply + suda_log + 进程内 replay guard` |
| 名单页 / staff 修正 | `wx_user_activity_status + web_admin_audit_log` | `suda_activity_apply + suda_user + suda_log` |
| 错误次数限流 | Java 内存窗口 / 设计中的 Redis | `backend-rust/src/rate_limit.rs` 的进程内窗口计数 |

## 4. 必须保持兼容的 DTO 字段

### 4.1 登录响应

- `status`
- `message`
- `session_token`
- `session_expires_at`
- `role`
- `permissions`
- `user_profile.student_id`
- `user_profile.name`
- `user_profile.department`
- `user_profile.club`

### 4.2 活动列表 / 详情

- `activity_id`
- `activity_title`
- `activity_type`
- `start_time`
- `location`
- `description`
- `progress_status`
- `support_checkin`
- `support_checkout`
- `has_detail`
- `registered_count`
- `checkin_count`
- `checkout_count`
- `my_registered`
- `my_checked_in`
- `my_checked_out`
- `my_checkin_time`
- `my_checkout_time`
- `can_checkin`
- `can_checkout`
- `server_time_ms`

### 4.3 staff 链路

- `items[].student_id`
- `items[].name`
- `items[].checked_in`
- `items[].checked_out`
- `items[].checkin_time`
- `items[].checkout_time`
- `affected_count`

## 5. 必须保持兼容的错误码

- `session_expired`
- `identity_not_found`
- `invalid_password`
- `invalid_param`
- `invalid_activity`
- `outside_activity_time_window`
- `activity_time_invalid`
- `invalid_code`
- `expired`
- `duplicate`
- `rate_limited`
- `forbidden`

## 6. 当前正式删除边界

以下能力在当前 `web` 分支里都已有明确承接，不需要再保留旧 Java / ext 表实现：

- 登录态：由无状态 `session_token` 承接
- 角色 / 权限：由 `suda_user.role` + Rust 权限映射承接
- 活动读模型：由 `suda_activity / suda_activity_apply` 即时查询承接
- 用户签到签退时间与审计：由 `suda_log` 承接
- 防重放：由进程内 TTL replay guard 承接
- 错误次数限流：由进程内窗口计数承接
- 同步回写：直接写 `suda_activity_apply`，不再需要 outbox
- 独立改密链路：当前正式基线不再保留

## 7. 当前批次收口结论

- `pure-suda-union-refactor` 里的 Java 单库化代码属于 Rust 切换前的过渡实现，不应再直接并回 `web`。
- 后续若再新开 Web / Rust 工作分支，应继续以这份清单和 `docs/plans/2026-03-25-rust-api-compat-checklist.md` 作为兼容基线，而不是回退到 Java 单库化路径。
