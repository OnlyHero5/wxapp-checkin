# 手机 Web 动态验证码签到 API 协议规范

文档版本: v1.0
状态: 正式基线
更新日期: 2026-03-10
项目: `wxapp-checkin`

## 1. 文档目标与适用范围

本文档定义 `wxapp-checkin` 手机 Web 版本的目标态 API 契约，供后端实现、Web 前端联调、测试用例编写与后续验收使用。

本文件覆盖：

- `/api/web/**` 新接口；
- Web 身份（账号密码）、会话、动态码、签到/签退、一键全部签退；
- 全局错误码、时间字段、鉴权传递与实施前必须锁定的约束。

本文件不覆盖：

- 历史小程序接口；
- 历史二维码 payload 协议；
- 页面视觉设计与浏览器适配细节。

## 2. 当前状态与历史链路

- 本文档是当前正式 API 基线。
- 当前正式后端入口已统一收口到 `/api/web/**`。
- 历史小程序与旧微信登录正式入口已从主干删除；若文档中提到历史链路，均只作为迁移背景说明。

## 3. 全局协议约定

### 3.1 Base Path

- 正式 Web 接口统一放在 `/api/web/**`。

### 3.1.1 与 `suda-gs-ams` / `suda_union` 共域时的路径约束

- `suda_union` 当前历史 controller 前缀主要是 `/activity`、`/user`、`/session`、`/department`、`/suda_login`、`/token`，不直接占用 `/api/web/**`。
- 因此从“接口命名”本身看，`wxapp-checkin` 与 `suda_union` 没有直接重名冲突。
- 但若与 `suda-gs-ams` 共用同一个域名 / 网关，需要注意两层冲突：
  - SPA 页面路由：`wxapp-checkin` 与 `suda-gs-ams` 都会使用 `/`、`/login`
  - API 网关路由：`suda-gs-ams` 生态里常见的是更宽的 `/api/*` 代理规则
- 推荐方案：
  - `wxapp-checkin` 前端部署到独立子路径，例如 `/checkin/`
  - `wxapp-checkin` API 要么保留 `/api/web/**` 并在网关上优先匹配 `/api/web/`
  - 要么由前端改用独立外部前缀（例如 `/checkin-api/web`），再在网关层重写到本服务实际的 `/api/web/**`
- 当前 `web/` 已支持通过环境变量覆盖：
  - `VITE_APP_BASE_PATH`
  - `VITE_API_BASE_PATH`
  - `VITE_API_PROXY_TARGET`

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
- 新 Web 前端应优先使用 `Authorization: Bearer`；
- 本项目不再要求浏览器唯一绑定；服务端鉴权只依赖 `session_token`（仍保留“首次登录强制改密”的统一拦截）。

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

## 4. Web 身份与账号密码接口

### 4.1 `POST /api/web/auth/login`

用途：

- 使用 `student_id + password` 登录；
- 若首次登录或仍处于强制改密状态，返回 `must_change_password=true`；
- 并签发业务会话。

请求体：

```json
{
  "student_id": "2025000011",
  "password": "123"
}
```

成功响应示例：

```json
{
  "status": "success",
  "message": "登录成功，请修改密码",
  "session_token": "sess_xxx",
  "session_expires_at": 1760003600000,
  "role": "normal",
  "permissions": [],
  "must_change_password": true,
  "user_profile": {
    "student_id": "2025000011",
    "name": "测试用户",
    "department": "",
    "club": ""
  }
}
```

失败语义：

- `identity_not_found`：学号不存在；
- `invalid_password`：密码错误；
- `invalid_param`：请求体缺字段（由参数校验触发）。

### 4.2 `POST /api/web/auth/change-password`

用途：

- 修改密码；
- 用于首次登录强制改密的唯一放行入口。

请求体：

```json
{
  "old_password": "123",
  "new_password": "newStrongPass"
}
```

成功响应示例：

```json
{
  "status": "success",
  "message": "密码修改成功",
  "must_change_password": false
}
```

失败语义：

- `invalid_password`：旧密码不正确；
- `invalid_param`：新密码不合法（空、过短等）；
- `session_expired`：会话失效。

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
  "page": 1,
  "page_size": 50,
  "has_more": false,
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
  "expires_at": 1760000010000,
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
- `activity_time_invalid`

补充说明：

- 发码允许窗口：活动开始前 30 分钟 ~ 活动结束后 30 分钟（包含边界）。
- 活动时间信息异常时返回 `activity_time_invalid`（需要先修复活动时间数据）。

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
- `rate_limited`
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

## 7. 错误码建议表

| error_code | 含义 | 典型接口 |
| --- | --- | --- |
| `session_expired` | 会话失效 | 全部鉴权接口 |
| `identity_not_found` | 学号不存在 | `auth/login` |
| `invalid_password` | 密码错误 | `auth/login` / `auth/change-password` |
| `password_change_required` | 必须先修改密码 | 全部业务接口 |
| `password_too_short` | 新密码过短 | `auth/change-password` |
| `password_too_long` | 新密码过长 | `auth/change-password` |
| `invalid_activity` | 活动不存在或不可见 | 活动 / 动态码 |
| `invalid_code` | 动态码错误 | `code-consume` |
| `expired` | 动态码过期 | `code-consume` |
| `rate_limited` | 动态码错误尝试过多被限流 | `code-consume` |
| `duplicate` | 同一时段重复提交 | `code-consume` |
| `outside_activity_time_window` | 不在发码允许时间窗 | `code-session` |
| `activity_time_invalid` | 活动时间信息异常 | `code-session` |

## 8. 实施前必须锁定的约束

以下项目必须在编码前由后端与前端共同收口，否则接口虽然能写，线上行为仍会漂：

### 8.1 密码策略口径

- 默认密码与强制改密的触发条件（本项目固定为默认 `123` + `must_change_password` 机制）。
- 新密码最小长度与合法字符集（建议至少 6 位；避免全空格）。
- 改密后是否要刷新会话 token（本项目以“保留会话 + 更新会话上下文”为主）。

### 8.2 会话策略

- `session_token` TTL
- 是否允许同一账号同时存在多个会话（本项目允许多端同时登录）
- 是否提供显式登出接口

### 8.3 动态码风控

- 错误码尝试限流阈值
- 限流维度
- 触发限流后的解锁策略

## 9. 文档关系

- 业务规则以 `docs/REQUIREMENTS.md` 为准；
- 用户流程与页面行为以 `docs/FUNCTIONAL_SPEC.md` 为准；
- 系统结构与数据模型以 `docs/WEB_DESIGN.md` 为准；
- 浏览器支持边界以 `docs/WEB_COMPATIBILITY.md` 为准；
- 审查与迁移边界见 `docs/WEB_MIGRATION_REVIEW.md`；
- 任务拆解见 `docs/plans/2026-03-10-http-password-auth-implementation-plan.md`。
