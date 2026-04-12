# Rust 后端 API 兼容清单

更新日期：2026-04-11  
适用范围：`/home/psx/app/wxapp-checkin/backend-rust`

## 1. 目标

这份清单只回答一件事：

Rust 后端在当前正式基线下，哪些 `/api/web/**` 契约、错误态和写库边界绝对不能被改坏。

## 2. 总体硬约束

- 正式端点总数固定为 8 个。
- JSON 字段继续使用 `snake_case`。
- 业务失败继续保持统一 JSON envelope，并返回真实 HTTP 状态码。
- 鉴权继续使用 `Authorization: Bearer <session_token>`。
- 运行期写库只允许命中：
  - `suda_activity_apply`
  - `suda_log`

前端依赖的关键错误态必须保留：

- `session_expired`
- `identity_not_found`
- `invalid_password`
- `account_disabled`
- `invalid_param`
- `invalid_activity`
- `outside_activity_time_window`
- `activity_time_invalid`
- `invalid_code`
- `expired`
- `duplicate`
- `rate_limited`
- `forbidden`

## 3. 端点清单

### 3.1 `POST /api/web/auth/login`

成功响应关键字段：

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

关键错误态：

- `identity_not_found`
- `invalid_password`
- `account_disabled`
- `rate_limited`
- `invalid_param`

### 3.2 `GET /api/web/activities`

查询参数关键约束：

- `page`
- `page_size`
- `keyword`

成功响应关键字段：

- `status`
- `message`
- `activities`
- `page`
- `page_size`
- `has_more`
- `server_time_ms`

`activities[*]` 最少保证：

- `activity_id`
- `activity_title`
- `activity_type`
- `start_time`
- `location`
- `description`
- `progress_status`
- `support_checkin`
- `support_checkout`
- `registered_count`
- `checkin_count`
- `checkout_count`
- `my_registered`
- `my_checked_in`
- `my_checked_out`

补充约束：

- `activity_id` 对外继续使用 `legacy_act_<id>`。
- staff 可见全部活动；普通用户只看自己相关活动。
- `keyword` 搜索正式基线已启用，范围至少覆盖标题、地点、描述与 `activity_id`。

### 3.3 `GET /api/web/activities/{activity_id}`

成功响应关键字段：

- 列表接口全部摘要字段
- `has_detail`
- `my_checkin_time`
- `my_checkout_time`
- `can_checkin`
- `can_checkout`
- `server_time_ms`

关键错误态：

- `session_expired`
- `invalid_activity`
- `forbidden`

### 3.4 `GET /api/web/activities/{activity_id}/code-session`

成功响应关键字段：

- `status`
- `message`
- `activity_id`
- `action_type`
- `code`
- `expires_at`
- `expires_in_ms`
- `server_time_ms`
- `registered_count`
- `checkin_count`
- `checkout_count`

关键错误态：

- `session_expired`
- `invalid_activity`
- `invalid_param`
- `outside_activity_time_window`
- `activity_time_invalid`
- `forbidden`

### 3.5 `POST /api/web/activities/{activity_id}/code-consume`

成功响应关键字段：

- `status`
- `message`
- `activity_id`
- `activity_title`
- `action_type`
- `record_id`
- `server_time_ms`

关键错误态：

- `session_expired`
- `invalid_activity`
- `invalid_param`
- `invalid_code`
- `expired`
- `duplicate`
- `rate_limited`
- `outside_activity_time_window`
- `forbidden`

### 3.6 `GET /api/web/staff/activities/{activity_id}/roster`

成功响应关键字段：

- `status`
- `message`
- `activity_id`
- `activity_title`
- `registered_count`
- `checkin_count`
- `checkout_count`
- `items[].student_id`
- `items[].name`
- `items[].checked_in`
- `items[].checked_out`
- `items[].checkin_time`
- `items[].checkout_time`
- `server_time_ms`

关键错误态：

- `session_expired`
- `invalid_activity`
- `forbidden`

### 3.7 `POST /api/web/staff/activities/{activity_id}/attendance-adjustments`

用途边界：

- 既承接 staff 人工修正，也承接 staff 页面进入时的自动自愈写请求。

成功响应关键字段：

- `status`
- `message`
- `activity_id`
- `affected_count`
- `batch_id`
- `server_time_ms`

关键错误态：

- `session_expired`
- `invalid_activity`
- `invalid_param`
- `forbidden`

补充约束：

- staff 管理页与名单页发现异常签退态时，会自动调用该接口完成自愈。
- `patch` 已收口为单字段命令式写法，一次请求只能表达一个布尔位动作。
- 当前自动自愈请求会带固定原因文本：`自动修复异常签退状态`。

### 3.8 `POST /api/web/staff/activities/{activity_id}/bulk-checkout`

成功响应关键字段：

- `status`
- `message`
- `activity_id`
- `affected_count`
- `batch_id`
- `server_time_ms`

关键错误态：

- `session_expired`
- `invalid_activity`
- `invalid_param`
- `forbidden`

## 4. 当前收口结论

- 当前正式认证链路只保留登录，不再暴露改密接口。
- 兼容基线以当前 8 个正式端点为准，不再沿用旧的 9 端点假设。
- 任何新增接口或错误码都必须先同步 `docs/API_SPEC.md` 与前端调用层。
