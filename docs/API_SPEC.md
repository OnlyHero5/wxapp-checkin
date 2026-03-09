# 手机 Web 动态验证码签到 API 协议规范

文档版本: v1.0
状态: 正式基线
更新日期: 2026-03-09
项目: `wxapp-checkin`

## 1. 文档目标与适用范围

本文档定义 `wxapp-checkin` 手机 Web 版本的目标态 API 契约，供后端实现、Web 前端联调、测试用例编写与后续验收使用。

本文件覆盖：

- `/api/web/**` 新接口；
- Web 身份、Passkey、会话、动态码、签到/签退、解绑审核、一键全部签退；
- 全局错误码、时间字段、鉴权传递与实施前必须锁定的约束。

本文件不覆盖：

- 历史小程序接口；
- 历史二维码 payload 协议；
- 页面视觉设计与浏览器适配细节。

## 2. 当前状态与历史链路

- 本文档是当前正式 API 基线。
- 仓库现有代码中仍存在 `/api/auth/wx-login`、`/api/staff/activities/{id}/qr-session`、`/api/checkin/consume` 等历史接口，它们只用于迁移对照。
- 新 Web 实现应统一落在 `/api/web/**` 下，并逐步替换旧链路。

## 3. 全局协议约定

### 3.1 Base Path

- 正式 Web 接口统一放在 `/api/web/**`。

### 3.2 Content-Type

- 请求与响应统一使用 `application/json; charset=utf-8`。

### 3.3 鉴权传递

推荐口径：

- `Authorization: Bearer <session_token>`

兼容口径：

- `X-Session-Token: <session_token>`
- 查询参数 `session_token`
- 请求体字段 `session_token`

说明：

- 当前后端已有 `SessionTokenExtractor`，已支持上述几种入口；
- 新 Web 前端应优先使用 `Authorization: Bearer`，避免继续放大旧接口风格差异。

### 3.4 通用响应

除特殊二进制场景外，所有接口返回 JSON。

成功响应统一包含：

- `status`
- `message`

失败响应统一包含：

- `status`
- `message`
- `error_code`（建议必带）

推荐状态值：

- `success`
- `invalid_param`
- `forbidden`
- `duplicate`
- `expired`
- `failed`

### 3.5 会话失效信号

所有需要登录态的接口，若会话失效，统一返回：

```json
{
  "status": "forbidden",
  "message": "会话失效，请重新登录",
  "error_code": "session_expired"
}
```

### 3.6 时间字段

- 统一使用毫秒级 Unix 时间戳；
- 字段名统一为 `*_at` 或 `*_time_ms`；
- 一切时效判断以后端时间为准。

## 4. Web 身份与 Passkey 接口

### 4.1 `POST /api/web/bind/verify-identity`

用途：

- 首次实名校验；
- 为后续 Passkey 注册签发一次性 `bind_ticket`。

请求体：

```json
{
  "student_id": "20234227087",
  "name": "张三"
}
```

成功响应示例：

```json
{
  "status": "success",
  "message": "实名校验通过",
  "bind_ticket": "bind_xxx",
  "bind_ticket_expire_at": 1760000000000,
  "role_hint": "normal",
  "user_profile": {
    "student_id": "20234227087",
    "name": "张三",
    "department": "计算机学院",
    "club": ""
  }
}
```

失败语义：

- `identity_not_found`：学号不存在；
- `identity_mismatch`：学号与姓名不匹配；
- `binding_conflict`：该浏览器已绑定其他账号；
- `account_bound_elsewhere`：该账号已有其他活跃浏览器绑定且未审核解绑。

### 4.2 `POST /api/web/passkey/register/options`

用途：

- 生成 Passkey 注册 challenge。

请求体：

```json
{
  "bind_ticket": "bind_xxx"
}
```

成功响应字段：

- `request_id`
- `challenge_expires_at`
- `public_key_options`
- `rp_id`
- `rp_name`
- `user_handle`

说明：

- `public_key_options` 结构遵循浏览器 `navigator.credentials.create()` 所需字段；
- 后端必须把 `request_id` 与 challenge 绑定保存，供 `register/complete` 校验；
- `rp_id` 与 `origin` 必须与部署文档一致。

### 4.3 `POST /api/web/passkey/register/complete`

用途：

- 完成 Passkey 注册；
- 创建浏览器绑定与业务会话。

请求体示例：

```json
{
  "request_id": "req_xxx",
  "bind_ticket": "bind_xxx",
  "attestation_response": {
    "id": "...",
    "raw_id": "...",
    "type": "public-key",
    "response": {
      "client_data_json": "...",
      "attestation_object": "..."
    }
  }
}
```

成功响应示例：

```json
{
  "status": "success",
  "message": "注册并登录成功",
  "session_token": "sess_xxx",
  "session_expires_at": 1760003600000,
  "role": "normal",
  "permissions": [],
  "registered": true,
  "user_profile": {
    "student_id": "20234227087",
    "name": "张三",
    "department": "计算机学院",
    "club": ""
  }
}
```

### 4.4 `POST /api/web/passkey/login/options`

用途：

- 生成 Passkey 登录 challenge。

请求体：

```json
{}
```

成功响应字段：

- `request_id`
- `challenge_expires_at`
- `public_key_options`
- `rp_id`

说明：

- 优先使用 discoverable credentials；
- 如后端需要缩小允许凭据集合，可在 `public_key_options.allow_credentials` 中返回。

### 4.5 `POST /api/web/passkey/login/complete`

用途：

- 完成 Passkey 登录；
- 创建新的业务会话。

请求体示例：

```json
{
  "request_id": "req_xxx",
  "assertion_response": {
    "id": "...",
    "raw_id": "...",
    "type": "public-key",
    "response": {
      "client_data_json": "...",
      "authenticator_data": "...",
      "signature": "...",
      "user_handle": "..."
    }
  }
}
```

成功响应字段：

- `session_token`
- `session_expires_at`
- `role`
- `permissions`
- `registered`
- `user_profile`

失败语义：

- `unsupported_browser`
- `challenge_expired`
- `passkey_not_registered`
- `passkey_verification_failed`
- `binding_revoked`

## 5. 活动与动态码接口

### 5.1 `GET /api/web/activities`

用途：

- 获取当前用户可见活动列表。

鉴权：

- 必须带有效会话。

成功响应示例：

```json
{
  "status": "success",
  "message": "活动列表获取成功",
  "activities": [
    {
      "activity_id": "legacy_act_101",
      "activity_title": "校园志愿活动",
      "progress_status": "ongoing",
      "support_checkin": true,
      "support_checkout": true,
      "my_registered": true,
      "my_checked_in": false,
      "my_checked_out": false,
      "checkin_count": 18,
      "checkout_count": 3
    }
  ],
  "server_time_ms": 1760000000000
}
```

### 5.2 `GET /api/web/activities/{activity_id}`

用途：

- 获取活动详情；
- 返回当前用户在该活动下的状态和页面展示所需字段。

成功响应建议补充：

- `can_checkin`
- `can_checkout`
- `server_time_ms`

### 5.3 `GET /api/web/activities/{activity_id}/code-session?action_type=checkin|checkout`

用途：

- `staff` 拉取当前动态码与倒计时信息。

鉴权：

- 仅 `staff` 可调用。

成功响应示例：

```json
{
  "status": "success",
  "message": "动态码获取成功",
  "activity_id": "legacy_act_101",
  "action_type": "checkin",
  "code": "483920",
  "slot": 234666666,
  "expires_at": 1760000007500,
  "expires_in_ms": 4200,
  "server_time_ms": 1760000003300,
  "checkin_count": 18,
  "checkout_count": 3
}
```

失败语义：

- `forbidden`
- `invalid_activity`
- `outside_activity_time_window`

### 5.4 `POST /api/web/activities/{activity_id}/code-consume`

用途：

- `normal` 在具体活动页面提交 6 位签到码或签退码。

请求体：

```json
{
  "action_type": "checkin",
  "code": "483920"
}
```

成功响应示例：

```json
{
  "status": "success",
  "message": "提交成功",
  "activity_id": "legacy_act_101",
  "activity_title": "校园志愿活动",
  "action_type": "checkin",
  "record_id": "rec_xxx",
  "server_time_ms": 1760000004300
}
```

失败语义：

- `invalid_code`
- `expired`
- `duplicate`
- `forbidden`
- `session_expired`

补充约束：

- 正式 Web 口径不再接收 `qr_payload`；
- 后端必须以 `activity_id + action_type + code` 判定动态码；
- 防重放唯一键应收敛为 `user_id + activity_id + action_type + slot`。

## 6. 管理员高权限接口

### 6.1 `POST /api/web/staff/activities/{activity_id}/bulk-checkout`

用途：

- 对当前活动内“已签到未签退”用户执行批量签退。

请求体：

```json
{
  "confirm": true,
  "reason": "活动结束统一签退"
}
```

成功响应示例：

```json
{
  "status": "success",
  "message": "批量签退完成",
  "activity_id": "legacy_act_101",
  "affected_count": 26,
  "batch_id": "batch_xxx",
  "server_time_ms": 1760000005000
}
```

失败语义：

- `forbidden`
- `invalid_activity`
- `invalid_param`

### 6.2 `POST /api/web/unbind-reviews`

用途：

- 用户发起解绑申请。

请求体：

```json
{
  "reason": "更换手机",
  "requested_new_binding_hint": "iPhone 16"
}
```

成功响应字段：

- `review_id`
- `status`
- `submitted_at`

### 6.3 `GET /api/web/staff/unbind-reviews`

用途：

- `staff` / `review_admin` 查询解绑审核列表。

查询参数建议：

- `status=pending|approved|rejected`
- `page`
- `page_size`

### 6.4 `POST /api/web/staff/unbind-reviews/{review_id}/approve`

请求体：

```json
{
  "review_comment": "确认已更换设备"
}
```

成功后必须同时发生：

- 原浏览器绑定失效；
- 原会话失效；
- 审核日志落库。

### 6.5 `POST /api/web/staff/unbind-reviews/{review_id}/reject`

请求体：

```json
{
  "review_comment": "信息不足，驳回"
}
```

## 7. 错误码建议表

| error_code | 含义 | 典型接口 |
| --- | --- | --- |
| `session_expired` | 会话失效 | 全部鉴权接口 |
| `identity_not_found` | 学号不存在 | `bind/verify-identity` |
| `identity_mismatch` | 学号与姓名不匹配 | `bind/verify-identity` |
| `binding_conflict` | 当前浏览器已绑定其他账号 | 绑定 / 登录 |
| `account_bound_elsewhere` | 该账号已有活跃绑定 | 绑定 |
| `unsupported_browser` | 当前浏览器不满足 Passkey 基线 | 登录 / 注册 |
| `challenge_expired` | Passkey challenge 过期 | register / login complete |
| `passkey_verification_failed` | Passkey 验证失败 | register / login complete |
| `invalid_activity` | 活动不存在或不可见 | 活动 / 动态码 |
| `invalid_code` | 动态码错误 | `code-consume` |
| `expired` | 动态码过期 | `code-consume` |
| `duplicate` | 同一时段重复提交 | `code-consume` |
| `outside_activity_time_window` | 不在发码允许时间窗 | `code-session` |

## 8. 实施前必须锁定的约束

以下项目必须在编码前由后端与前端共同收口，否则接口虽然能写，线上行为仍会漂：

### 8.1 Passkey 部署口径

- `RP ID`
- 允许的 `Origin`
- 本地开发域名
- 正式环境 HTTPS 域名

### 8.2 浏览器绑定口径

- 服务端是否签发稳定 `binding_id`
- `binding_fingerprint_hash` 的输入因子
- 指纹是否只作为风控辅助，而不是唯一真相源

### 8.3 会话策略

- `session_token` TTL
- 审核解绑后的旧会话失效策略
- 是否提供显式登出接口

### 8.4 动态码风控

- 错误码尝试限流阈值
- 限流维度
- 触发限流后的解锁策略

## 9. 文档关系

- 业务规则以 `docs/REQUIREMENTS.md` 为准；
- 用户流程与页面行为以 `docs/FUNCTIONAL_SPEC.md` 为准；
- 系统结构与数据模型以 `docs/WEB_DESIGN.md` 为准；
- 浏览器支持边界以 `docs/WEB_COMPATIBILITY.md` 为准；
- 审查与迁移边界见 `docs/WEB_MIGRATION_REVIEW.md`；
- 任务拆解见 `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`。
