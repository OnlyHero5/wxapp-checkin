# 手机 Web 动态验证码签到 API 协议规范

文档版本：v1.2  
状态：正式基线  
更新日期：2026-03-27  
项目：`wxapp-checkin`

## 1. 文档目标与适用范围

本文档定义 `wxapp-checkin` 手机 Web 版本的当前正式 API 契约，供后端实现、Web 前端联调、测试用例编写与后续验收使用。

本文件覆盖：

- `/api/web/**` 当前正式 8 个端点；
- Web 身份（账号密码）、会话、动态码、签到 / 签退、名单修正、一键全部签退；
- 全局错误码、时间字段、鉴权传递与当前实现边界。

本文件不覆盖：

- 非正式或历史接口；
- 非正式二维码 payload 试验协议；
- 页面视觉设计与浏览器适配细节。

## 2. 当前状态与发布口径

- 本文档是当前正式 API 基线。
- 当前正式后端入口统一收口到 `/api/web/**`。
- 当前正式认证链路只保留 `POST /api/web/auth/login`，不再提供 `/api/web/auth/change-password`。

## 3. 全局协议约定

### 3.1 Base Path

- 正式 Web 接口统一放在 `/api/web/**`。

### 3.2 与其他站点共域时的路径约束

- 若与 `suda-gs-ams` 共用域名 / 网关，推荐把前端部署到独立子路径，例如 `/checkin/`。
- API 可继续保留内部真实路径 `/api/web/**`，并在网关层把外部路径（例如 `/checkin-api/web/**`）重写到本服务。
- 当前 `web/` 已支持通过环境变量覆盖：
  - `VITE_APP_BASE_PATH`
  - `VITE_API_BASE_PATH`
  - `VITE_API_PROXY_TARGET`

### 3.3 Content-Type

- 请求与响应统一使用 `application/json; charset=utf-8`。

### 3.4 鉴权传递

- 当前正式口径只支持：
  - `Authorization: Bearer <session_token>`

说明：

- 新 Web 前端必须使用 `Authorization: Bearer`。
- 当前 Rust 后端不会再兼容 `X-Session-Token`、查询参数或请求体透传会话。

### 3.5 通用响应

除特殊二进制场景外，所有接口返回 JSON。

成功响应统一包含：

- `status`
- `message`

失败响应统一包含：

- `status`
- `message`
- `error_code`（建议带上）

推荐状态值：

- `success`
- `invalid_param`
- `forbidden`
- `duplicate`
- `expired`
- `error`

### 3.6 HTTP 状态语义

- 成功响应返回 `HTTP 200`。
- 失败响应继续返回统一 JSON envelope，但同时返回对应 HTTP 状态码。

当前正式映射口径：

- `invalid_param` -> `400`
- `forbidden` -> `403`
- `duplicate` -> `409`
- `expired` -> `410`
- `rate_limited` -> `429`
- `invalid_activity` -> `404`
- `error` -> `500`

### 3.7 会话失效信号

所有需要登录态的接口，若会话失效，统一返回：

```json
{
  "status": "forbidden",
  "message": "会话失效，请重新登录",
  "error_code": "session_expired"
}
```

### 3.8 时间字段

- 统一使用毫秒级 Unix 时间戳；
- 字段名统一为 `*_at` 或 `*_time_ms`；
- 一切时效判断以后端时间为准。

## 4. 认证接口

### 4.1 `POST /api/web/auth/login`

用途：

- 使用 `student_id + password` 登录；
- 签发业务会话，并返回当前角色、权限与用户资料。

请求体：

```json
{
  "student_id": "2025000011",
  "password": "your-password"
}
```

成功响应示例：

```json
{
  "status": "success",
  "message": "登录成功",
  "session_token": "sess_xxx",
  "session_expires_at": 1760003600000,
  "role": "normal",
  "permissions": [],
  "user_profile": {
    "student_id": "2025000011",
    "name": "测试用户",
    "department": "计算机科学与技术学院",
    "club": ""
  }
}
```

失败语义：

- `identity_not_found`：学号不存在；
- `invalid_password`：密码错误；
- `invalid_param`：请求体缺字段或为空。

## 5. 活动与动态码接口

### 5.1 `GET /api/web/activities`

用途：

- 获取当前用户可见活动列表。

鉴权：

- 必须带有效会话。

查询参数（可选）：

- `page`：页码，从 1 开始；默认 1。
- `page_size`：每页条数；默认 50，最大 200。

成功响应示例：

```json
{
  "status": "success",
  "message": "活动列表获取成功",
  "activities": [
    {
      "activity_id": "legacy_act_101",
      "activity_title": "校园志愿活动",
      "activity_type": "活动",
      "start_time": "2026-03-26 18:30",
      "location": "钟楼广场",
      "description": "校内志愿服务",
      "progress_status": "ongoing",
      "support_checkin": true,
      "support_checkout": true,
      "registered_count": 26,
      "checkin_count": 18,
      "checkout_count": 3,
      "my_registered": true,
      "my_checked_in": false,
      "my_checked_out": false
    }
  ],
  "page": 1,
  "page_size": 50,
  "has_more": false,
  "server_time_ms": 1760000000000
}
```

补充约束：

- `activity_id` 对外继续使用 `legacy_act_<id>`。
- staff 可见全部活动；普通用户只看自己相关活动。

### 5.2 `GET /api/web/activities/{activity_id}`

用途：

- 获取活动详情；
- 返回当前用户在该活动下的状态和页面展示所需字段。

成功响应示例：

```json
{
  "status": "success",
  "message": "活动详情获取成功",
  "activity_id": "legacy_act_101",
  "activity_title": "校园志愿活动",
  "activity_type": "活动",
  "start_time": "2026-03-26 18:30",
  "location": "钟楼广场",
  "description": "校内志愿服务",
  "progress_status": "ongoing",
  "support_checkin": true,
  "support_checkout": true,
  "has_detail": true,
  "registered_count": 26,
  "checkin_count": 18,
  "checkout_count": 3,
  "my_registered": true,
  "my_checked_in": false,
  "my_checked_out": false,
  "my_checkin_time": "",
  "my_checkout_time": "",
  "can_checkin": true,
  "can_checkout": false,
  "server_time_ms": 1760000001000
}
```

失败语义：

- `session_expired`
- `invalid_activity`
- `forbidden`

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
  "expires_at": 1760000010000,
  "expires_in_ms": 4200,
  "server_time_ms": 1760000003300,
  "registered_count": 26,
  "checkin_count": 18,
  "checkout_count": 3
}
```

失败语义：

- `forbidden`
- `invalid_activity`
- `invalid_param`
- `outside_activity_time_window`
- `activity_time_invalid`

补充说明：

- 发码允许窗口：活动开始前 30 分钟到活动结束后 30 分钟（包含边界）。
- 动态码固定为 6 位数字码。

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

- `invalid_activity`
- `invalid_param`
- `invalid_code`
- `expired`
- `duplicate`
- `rate_limited`
- `forbidden`
- `session_expired`
- `outside_activity_time_window`

补充约束：

- 正式 Web 口径不接收 `qr_payload`；
- 后端以 `activity_id + action_type + code` 判定动态码；
- 防重放唯一键收敛为 `user_id + activity_id + action_type + slot`。

## 6. staff 管理接口

### 6.1 `GET /api/web/staff/activities/{activity_id}/roster`

用途：

- 读取当前活动的参会名单与状态概览。

成功响应示例：

```json
{
  "status": "success",
  "message": "参会名单获取成功",
  "activity_id": "legacy_act_101",
  "activity_title": "校园志愿活动",
  "activity_type": "活动",
  "start_time": "2026-03-26 18:30",
  "location": "钟楼广场",
  "description": "校内志愿服务",
  "registered_count": 26,
  "checkin_count": 18,
  "checkout_count": 3,
  "items": [
    {
      "user_id": 7,
      "student_id": "2025000007",
      "name": "测试用户",
      "checked_in": true,
      "checked_out": false,
      "checkin_time": "2026-03-26 18:31",
      "checkout_time": ""
    }
  ],
  "server_time_ms": 1760000005000
}
```

失败语义：

- `forbidden`
- `invalid_activity`
- `session_expired`

### 6.2 `POST /api/web/staff/activities/{activity_id}/attendance-adjustments`

用途：

- staff 修正一个或多个成员的签到 / 签退状态。

请求体：

```json
{
  "user_ids": [7, 8],
  "patch": {
    "checked_in": true,
    "checked_out": false
  },
  "reason": "批量设为已签到"
}
```

成功响应示例：

```json
{
  "status": "success",
  "message": "名单状态修正完成",
  "activity_id": "legacy_act_101",
  "affected_count": 2,
  "batch_id": "adj_1760000005000",
  "server_time_ms": 1760000005000
}
```

失败语义：

- `forbidden`
- `invalid_activity`
- `invalid_param`
- `session_expired`

### 6.3 `POST /api/web/staff/activities/{activity_id}/bulk-checkout`

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
- `session_expired`

## 7. 错误码建议表

| error_code | 含义 | 典型接口 |
| --- | --- | --- |
| `session_expired` | 会话失效 | 全部鉴权接口 |
| `identity_not_found` | 学号不存在 | `auth/login` |
| `invalid_password` | 密码错误 | `auth/login` |
| `invalid_param` | 请求字段缺失或非法 | 多数写接口 |
| `invalid_activity` | 活动不存在或不可见 | 活动 / staff / 动态码 |
| `invalid_code` | 动态码错误 | `code-consume` |
| `expired` | 动态码过期 | `code-consume` |
| `rate_limited` | 动态码错误尝试过多被限流 | `code-consume` |
| `duplicate` | 同一时段重复提交 | `code-consume` |
| `outside_activity_time_window` | 不在发码或验码允许时间窗 | `code-session` / `code-consume` |
| `activity_time_invalid` | 活动时间信息异常 | `code-session` |

## 8. 当前实现边界

- 当前正式端点总数固定为 8 个。
- JSON 字段继续使用 `snake_case`。
- 业务失败继续保持统一 JSON envelope，并返回真实 HTTP 状态码。
- 运行期写库边界只允许命中：
  - `suda_activity_apply`
  - `suda_log`

## 9. 文档关系

- 业务规则以 `docs/REQUIREMENTS.md` 为准；
- 页面行为以 `docs/FUNCTIONAL_SPEC.md` 为准；
- 部署口径以 `docs/DEPLOYMENT.md` 为准；
- 兼容清单见 `docs/plans/2026-03-25-rust-api-compat-checklist.md`。
