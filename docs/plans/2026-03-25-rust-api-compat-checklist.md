# Rust 后端 API 兼容清单

更新日期：2026-03-25  
适用范围：`/home/psx/app/wxapp-checkin/backend-rust`

## 1. 目标

这份清单只回答一件事：

Rust 重写后端时，哪些 `/api/web/**` 契约、错误态和写库边界绝对不能被改坏。

## 2. 总体硬约束

- 正式端点总数固定为 9 个。
- JSON 字段继续使用 `snake_case`。
- 业务失败继续保持 `HTTP 200 + JSON envelope` 口径。
- 鉴权继续使用 `Authorization: Bearer <session_token>`。
- 前端依赖的关键错误态必须保留：
  - `session_expired`
  - `password_change_required`
  - `invalid_password`
  - `identity_not_found`
  - `password_too_short`
  - `password_too_long`
  - `outside_activity_time_window`
  - `invalid_code`
  - `expired`
  - `duplicate`
  - `forbidden`

## 3. 数据库写入白名单

Rust 正式链路只允许写以下 3 类数据：

- `suda_activity_apply`
- `suda_log`
- `suda_user.password`

明确禁止：

- `wxcheckin_ext`
- 所有 `wx_*` 表
- 双库同步
- outbox relay
- 活动投影表
- 会话落库表

## 4. 统一错误 Envelope

所有业务失败统一返回：

```json
{
  "status": "forbidden",
  "message": "会话失效，请重新登录",
  "error_code": "session_expired"
}
```

约束：

- `status` 是前端主分支判断依据。
- `message` 直接用于页面提示。
- `error_code` 只在需要细分错误态时返回。

## 5. 端点清单

### 5.1 `POST /api/web/auth/login`

请求体：

```json
{
  "student_id": "2025000011",
  "password": "123"
}
```

成功响应关键字段：

- `status`
- `message`
- `session_token`
- `session_expires_at`
- `role`
- `permissions`
- `must_change_password`
- `user_profile`

`user_profile` 最少保证：

- `student_id`
- `name`
- `department`
- `club`

不可破坏语义：

- 学号口径固定为 `student_id`。
- 首次登录/默认密码用户必须返回 `must_change_password=true`。
- `session_token` 仍用于后续 Bearer 鉴权。

关键错误态：

- `identity_not_found`
- `invalid_password`
- `invalid_param`

### 5.2 `POST /api/web/auth/change-password`

请求体：

```json
{
  "old_password": "123",
  "new_password": "new-pass"
}
```

成功响应关键字段：

- `status`
- `message`
- `must_change_password`

不可破坏语义：

- 该接口允许在强制改密状态下访问。
- 改密成功后必须返回 `must_change_password=false`。
- 只允许更新 `suda_user.password`。

关键错误态：

- `session_expired`
- `invalid_password`
- `password_too_short`
- `password_too_long`
- `invalid_param`

### 5.3 `GET /api/web/activities`

查询参数：

- `page`
- `page_size`

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

不可破坏语义：

- `activity_id` 对外继续使用 `legacy_act_<id>` 兼容格式。
- staff 可见全部活动；普通用户只看自己相关活动。
- `server_time_ms` 单位固定毫秒。

关键错误态：

- `session_expired`
- `password_change_required`
- `invalid_param`

### 5.4 `GET /api/web/activities/{activityId}`

成功响应关键字段：

- 列表接口全部活动摘要字段
- `my_checkin_time`
- `my_checkout_time`
- `can_checkin`
- `can_checkout`
- `server_time_ms`

不可破坏语义：

- `can_checkin` / `can_checkout` 必须与发码/验码时间窗一致。
- `my_checkin_time` / `my_checkout_time` 只展示当前状态仍然有效的时间。
- 普通用户无权查看未报名活动详情。

关键错误态：

- `session_expired`
- `password_change_required`
- `invalid_activity`
- `forbidden`

### 5.5 `GET /api/web/activities/{activityId}/code-session`

查询参数：

- `action_type`，仅允许 `checkin` / `checkout`

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

不可破坏语义：

- 仅 staff 可发码。
- 动态码仍是 6 位 HMAC 码。
- `expires_at` / `expires_in_ms` / `server_time_ms` 单位固定毫秒。
- 发码时间窗必须和详情页 `can_checkin/can_checkout` 同口径。

关键错误态：

- `session_expired`
- `password_change_required`
- `invalid_param`
- `invalid_activity`
- `outside_activity_time_window`
- `forbidden`

### 5.6 `POST /api/web/activities/{activityId}/code-consume`

请求体：

```json
{
  "action_type": "checkin",
  "code": "123456"
}
```

成功响应关键字段：

- `status`
- `message`
- `action_type`
- `activity_id`
- `activity_title`
- `record_id`
- `server_time_ms`

不可破坏语义：

- 仅普通用户可验码。
- `action_type` 仅允许 `checkin` / `checkout`。
- 同一用户同一时段重复提交必须返回 `duplicate`。
- `record_id` 继续作为签到/签退动作回执标识。
- 写路径只能落到：
  - `suda_activity_apply`
  - `suda_log`

关键错误态：

- `session_expired`
- `password_change_required`
- `invalid_param`
- `invalid_activity`
- `outside_activity_time_window`
- `invalid_code`
- `expired`
- `duplicate`
- `forbidden`

### 5.7 `GET /api/web/staff/activities/{activityId}/roster`

成功响应关键字段：

- `status`
- `message`
- `activity_id`
- `activity_title`
- `activity_type`
- `start_time`
- `location`
- `description`
- `registered_count`
- `checkin_count`
- `checkout_count`
- `items`
- `server_time_ms`

`items[*]` 最少保证：

- `user_id`
- `student_id`
- `name`
- `checked_in`
- `checked_out`
- `checkin_time`
- `checkout_time`

不可破坏语义：

- 仅 staff 可查看。
- roster 必须一次返回“活动摘要 + 名单列表”。
- `checked_in/checked_out` 是前端名单页的唯一状态真相源。

关键错误态：

- `session_expired`
- `password_change_required`
- `invalid_activity`
- `forbidden`

### 5.8 `POST /api/web/staff/activities/{activityId}/bulk-checkout`

请求体：

```json
{
  "confirm": true,
  "reason": "活动结束统一签退"
}
```

成功响应关键字段：

- `status`
- `message`
- `activity_id`
- `affected_count`
- `batch_id`
- `server_time_ms`

不可破坏语义：

- 仅 staff 可调用。
- `confirm` 必须显式为 `true`。
- 只处理“已签到未签退”的成员。
- 写路径只能落到：
  - `suda_activity_apply`
  - `suda_log`

关键错误态：

- `session_expired`
- `password_change_required`
- `invalid_param`
- `invalid_activity`
- `forbidden`

### 5.9 `POST /api/web/staff/activities/{activityId}/attendance-adjustments`

请求体：

```json
{
  "user_ids": [11, 12],
  "patch": {
    "checked_in": true,
    "checked_out": false
  },
  "reason": "名单修正"
}
```

成功响应关键字段：

- `status`
- `message`
- `activity_id`
- `affected_count`
- `batch_id`
- `server_time_ms`

不可破坏语义：

- 仅 staff 可调用。
- 单个修正和批量修正共用同一接口。
- `checked_in=false` 必须同时清掉签退态。
- `checked_out=true` 隐含 `checked_in=true`。
- 写路径只能落到：
  - `suda_activity_apply`
  - `suda_log`

关键错误态：

- `session_expired`
- `password_change_required`
- `invalid_param`
- `invalid_activity`
- `forbidden`

## 6. 实现核对项

每实现一个 Rust 路由前，先核对以下 6 项：

1. 路径、方法、查询参数是否完全一致。
2. JSON 字段名是否仍为 `snake_case`。
3. 成功响应字段是否齐全，缺省语义是否与前端一致。
4. 失败时是否仍返回 `HTTP 200 + JSON envelope`。
5. `error_code` 是否沿用当前前端依赖口径。
6. 数据库写入是否仍在白名单内。
