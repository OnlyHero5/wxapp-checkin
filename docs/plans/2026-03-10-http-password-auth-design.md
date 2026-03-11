# HTTP 内网账号密码认证改造设计说明

文档版本: v1.0  
状态: 设计确认稿  
更新日期: 2026-03-10  
项目: `wxapp-checkin`

## 1. 背景与变更原因

原 Web-only 方案采用 **Passkey/WebAuthn + HTTPS** 作为登录入口，并配套“浏览器唯一绑定 + 会话 token + 解绑审核”来降低代签风险。

本轮需求发生重大变化：系统必须在 **HTTP + 内网 IP + 端口** 的访问形态下运行。由于 WebAuthn/Passkey 在主流浏览器上对 HTTPS 有硬性依赖（HTTP 场景不可用），因此必须移除 Passkey 相关主链路，并以账号密码完成登录。

补充说明（2026-03-10 整改决策）：

- 本项目不再要求与浏览器捆绑；取消浏览器唯一绑定与解绑审核相关的防代签逻辑。
- Web 端鉴权闭环收敛为：`student_id + password` 登录 → 后端签发 `session_token` → 前端以 `Authorization: Bearer` 携带会话。

## 2. 目标与非目标

### 2.1 目标

- 登录改为 `student_id + password`。
- 初始密码统一为 `123`；用户**首次登录后强制修改密码**。
- 账号与密码数据存储在 `wxapp-checkin` 自有数据库（`wxcheckin_ext`）中。
- 保留 `session_token`（后端签发，前端持久化）作为 Web 端唯一鉴权凭据。
- 不限制同一账号多端同时登录（允许多个会话并存）。

### 2.2 非目标

- 不追求生产级安全强度（内网 HTTP 场景本身不满足“传输加密”要求）。
- 不引入短信验证码、人脸识别等新身份体系。
- 不引入复杂的账号开通/找回流程（如重置密码、邮件通知等）。

## 3. 核心决策

### 3.1 账号口径

- **账号 = 学号 `student_id`**（登录表单、接口、数据库查询均以此为准）。

### 3.2 密码存储与默认密码

- 密码只存 **bcrypt hash**（不存明文）。
- 若用户首次在 Web 登录且本地库不存在该用户记录，则：
  - 后端只读查询 `suda_union.suda_user`（通过 `LegacyUserLookupService`）确认学号存在；
  - 自动创建 `wx_user_auth_ext` 用户记录；
  - 初始化 `password_hash = bcrypt("123")`；
  - 设置 `must_change_password = true`。

> 说明：默认密码统一为 `123` 的方案安全性较弱，但这是本次明确需求约束；强制改密是本轮主要缓解手段。

### 3.3 强制改密机制

- 登录成功返回 `must_change_password`。
- 当 `must_change_password=true` 时：
  - **除“改密接口”外的所有业务接口**统一返回：
    - `status=forbidden`
    - `error_code=password_change_required`
  - 前端路由守卫强制跳转到 `/change-password`。
- 改密成功后：
  - 更新 `password_hash`
  - 设置 `must_change_password=false`
  - 保留或刷新会话（实现可选；本轮以“保留会话 + 更新会话上下文字段”为主）。

### 3.4 会话策略与多端登录

- 后端每次登录签发新的 `session_token`，不对同一账号的并发会话做限制（允许多设备/多浏览器同时使用）。
- 业务接口统一以 `SessionService.requireWebPrincipal()` 校验会话，并在 `must_change_password=true` 时返回 `password_change_required`（改密接口除外）。

## 4. API 设计（新增/替换）

### 4.1 登录

`POST /api/web/auth/login`

请求体：

```json
{
  "student_id": "2025000011",
  "password": "123"
}
```

成功响应（示例）：

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

- `identity_not_found`：学号在 `suda_union` 中不存在（不允许登录）。
- `invalid_password`：密码错误。
- `invalid_param`：请求体缺字段（由参数校验触发）。

### 4.2 修改密码（强制入口）

`POST /api/web/auth/change-password`

请求体：

```json
{
  "old_password": "123",
  "new_password": "newStrongPass"
}
```

成功响应：

```json
{
  "status": "success",
  "message": "密码修改成功",
  "must_change_password": false
}
```

失败语义：

- `invalid_password`：旧密码不正确。
- `invalid_param`：新密码不合法（空、过短等）。
- `session_expired`：会话失效。

### 4.3 统一错误码

- `password_change_required`：必须先修改密码。
- `invalid_password`：密码错误（登录或改密）。

## 5. 数据库设计

### 5.1 `wx_user_auth_ext` 新增字段

- `password_hash`：bcrypt hash（VARCHAR/TEXT）。
- `must_change_password`：是否强制改密（TINYINT(1)）。
- （可选）`password_updated_at`：最近一次改密时间（DATETIME(3)）。

### 5.2 Passkey 表的处理

- 本轮代码层面移除 Passkey/WebAuthn 相关业务逻辑与接口。
- 既有 Passkey 表（如 `web_passkey_credential`、`web_passkey_challenge`）可保留为历史数据，也可在后续独立迁移中清理；本轮以“停用并不再依赖”为准。

## 6. 前端路由与交互

### 6.1 页面调整

- `/login`：账号密码登录页（学号 + 密码）。
- `/change-password`：改密页（旧密码 + 新密码）。
- 移除 `/bind`（Passkey 注册入口）与“Passkey 不支持”提示页。

### 6.2 会话存储

- `session_token`、`role`、`permissions`、`user_profile` 继续落 `localStorage`。
- 新增持久化字段 `must_change_password`，用于路由守卫与全局导航判断。

### 6.3 路由守卫

- 未登录：跳 `/login`。
- 已登录但 `must_change_password=true`：
  - 除 `/change-password` 外所有路由统一跳转到 `/change-password`。

## 7. 验收要点

- 用 `student_id + 123` 可登录；首次登录后必须进入改密页。
- 未改密时访问 `/activities` 或调用任意业务 API，统一提示“请先修改密码”。
- 改密成功后可正常进入活动列表、详情、签到/签退、管理员页。
- 同一账号允许在多个设备/浏览器同时登录并正常使用（不再要求浏览器绑定/解绑）。
