# API 协议规范（后端实施手册）

文档版本: v4.2  
更新日期: 2026-02-08  
适用分支: `main`  
代码对齐基线: `src/utils/api.js`、`src/utils/auth.js`、`src/pages/index/index.js`、`src/pages/staff-qr/staff-qr.js`、`src/pages/scan-action/scan-action.js`、`src/pages/activity-detail/activity-detail.js`、`src/pages/register/register.js`

---

## 1. 文档目标与范围

本文件只服务后端研发与联调，目标是让后端同学按文档即可完成实现。

本文件覆盖范围：
1. 小程序当前主链路实际调用的全部后端 API（共 6 个）。
2. 每个 API 的请求参数逐字段定义（类型、是否必填、校验规则、业务语义）。
3. 每个 API 的后端处理步骤（按执行顺序描述）。
4. 每个 API 的返回参数逐字段定义（业务语义、来源、对调用方影响）。
5. 每个业务失败状态的触发条件。

不包含内容：
- UI 视觉与交互动效。
- 二维码在小程序端的绘制细节。
- 历史方案对比。

---

## 2. 职责边界（必须统一）

### 2.1 小程序端职责
- 根据后端返回的策略参数，本地生成二维码 payload 文本。
- 本地执行二维码轮换（默认 10 秒）。
- 扫码后将 payload（及可选冗余字段）提交给后端。

### 2.2 后端职责
- 仅返回二维码策略配置，不生成二维码图片，不返回二维码文本内容。
- 在 `consume` 接口内完成：鉴权、权限、活动有效性、时效校验、防重放、状态流转、计数更新、记录落库。
- 保证同一业务状态在并发提交下的一致性与幂等性。

### 2.3 严格约束
- 后端不得依赖“微信官方二维码接口”生成业务二维码。
- 后端必须接受并校验小程序端生成的 payload 协议字符串。

---

## 3. 全局协议规范

## 3.1 本期必须实现的 API 清单

| 编号 | 方法 | 路径 | 调用入口 | 作用 |
|---|---|---|---|---|
| A-01 | POST | `/api/auth/wx-login` | `auth.ensureSession` | 微信登录换业务会话 |
| A-02 | POST | `/api/register` | `pages/register/register` | 用户身份绑定 |
| A-03 | GET | `/api/staff/activities` | `pages/index/index` | 活动列表 |
| A-04 | GET | `/api/staff/activities/{activity_id}` | `pages/activity-detail/activity-detail`、`pages/staff-qr/staff-qr` | 活动详情与统计 |
| A-05 | POST | `/api/staff/activities/{activity_id}/qr-session` | `pages/staff-qr/staff-qr` | staff 获取二维码策略配置 |
| A-06 | POST | `/api/checkin/consume` | `pages/scan-action/scan-action` | normal 扫码提交签到/签退 |

## 3.2 通用请求约定

| 项目 | 要求 |
|---|---|
| 协议 | HTTPS |
| Content-Type | `application/json` |
| 编码 | UTF-8 |
| 会话字段 | `session_token`（A-01 除外） |
| 时间单位 | 毫秒时间戳（如 `server_time`） |

`session_token` 传递说明：
- 小程序当前实现通过请求体或 GET data 传递。
- 后端可同时兼容 query/body/header，但建议统一读取后做归一化。

## 3.3 通用响应约定（关键）

为确保小程序能拿到业务错误文案，建议遵循：
- 网络层成功（HTTP 2xx）时，业务成功/失败都通过响应体 `status` 区分。
- 仅在网关故障、服务崩溃等非业务异常时使用 HTTP 5xx。

推荐响应体结构：
```json
{
  "status": "success",
  "message": "可读提示",
  "...": "业务字段"
}
```

## 3.4 通用业务状态字典

| 字段 | 类型 | 可选值 | 业务含义 |
|---|---|---|---|
| `role` | string | `normal` / `staff` | 用户角色 |
| `action_type` | string | `checkin` / `checkout` | 动作类型 |
| `progress_status` | string | `ongoing` / `completed` | 活动进度 |
| `status` | string | `success` / `forbidden` / `invalid_qr` / `expired` / `duplicate` / `invalid_activity` / `invalid_param` / `student_already_bound` / `wx_already_bound` / `failed` | 业务处理结果 |

## 3.5 payload 协议（A-06 核心）

字符串格式：
```text
wxcheckin:v1:<activity_id>:<action_type>:<slot>:<nonce>
```

字段说明：
- `activity_id`: 活动唯一标识。
- `action_type`: `checkin` 或 `checkout`。
- `slot`: 时间片编号，整数，`>=0`。
- `nonce`: 随机串，提升载荷不可预测性。

时间窗口定义（默认配置）：
- `rotate_seconds = 10`（显示窗口）。
- `grace_seconds = 20`（提交宽限）。

计算规则（后端用于校验）：
1. `display_start_at = slot * rotate_seconds * 1000`
2. `display_expire_at = display_start_at + rotate_seconds * 1000`
3. `accept_expire_at = display_expire_at + grace_seconds * 1000`
4. `now < display_start_at` -> future（无效）
5. `now > accept_expire_at` -> expired（过期）

## 3.6 后端解析技术建议（必须明确）

以下是本项目推荐的后端解析技术栈，目标是保证 `wx_login_code`、`session_token`、`payload_encrypted` 等字段可稳定解析、校验、审计。

| 解析环节 | Node.js（Express/NestJS） | Java（Spring Boot） |
|---|---|---|
| JSON 解析 | `express.json()` / Nest 内置 body parser | `@RequestBody` + Jackson |
| 参数校验 | `zod` / `joi` / `class-validator` | `jakarta.validation`（`@NotBlank`、`@Pattern`） |
| 微信登录 code 换 openid | 服务端 `axios/fetch` 调微信 `jscode2session` | `RestTemplate/WebClient` 调微信 `jscode2session` |
| 会话鉴权 | Redis + JWT/随机 token | Redis + Spring Security / JWT |
| `payload_encrypted` 解密验签 | `crypto`（AES-GCM + HMAC） | JCE（AES-GCM + HMAC） |
| 并发防重放 | Redis 原子命令（`SET NX EX`） | RedisTemplate + Lua / Redisson |

`wx_login_code` 解析的后端关键点：
1. 必须在服务端调用微信 `jscode2session`，不能在前端直接换 openid。
2. `code` 只可使用一次，建议服务端记录短期防重复消费日志。
3. 将 `openid/unionid` 映射为内部 `wx_identity` 后再签发业务 `session_token`。

---

## 4. 主链路 API 详细规范

## 4.1 A-01 微信登录

**方法/路径**: `POST /api/auth/wx-login`

### 4.1.1 请求参数

| 字段 | 位置 | 必填 | 类型 | 约束 | 字段语义 |
|---|---|---|---|---|---|
| `wx_login_code` | body | 是 | string | 非空；建议长度 8~128；不可包含空白字符 | `wx.login` 返回的一次性临时 code，用于换取微信身份 |

### 请求示例（传参示例）

前端调用示例（小程序）：
```js
wx.login({
  success(res) {
    wx.request({
      url: "https://api.example.com/api/auth/wx-login",
      method: "POST",
      data: {
        wx_login_code: res.code
      }
    });
  }
});
```

等价 `curl` 示例：
```bash
curl -X POST "https://api.example.com/api/auth/wx-login" \
  -H "Content-Type: application/json" \
  -d '{
    "wx_login_code": "0c5wYQ100abcXYZ1dE100xYQ000wYQ1j"
  }'
```

### 4.1.2 后端处理步骤（必须按序）
1. 校验 `wx_login_code` 非空，非法则返回 `invalid_param`。
2. 调用微信登录态校验接口，换取微信身份主键（如 openId/unionId）。
3. 以微信身份查用户表；不存在则创建最小用户记录。
4. 生成 `session_token`，写入会话存储（含过期时间、用户 ID、角色快照）。
5. 读取用户角色与权限集（`role`、`permissions`）。
   - 若用户尚未注册绑定，角色可先返回默认值（通常 `normal`），最终角色以 A-02 注册校验后的结果为准。
6. 读取用户资料并判断是否已绑定（`is_registered`）。
7. 组装 `user_profile`：未绑定用户允许返回空学号/空姓名。
8. 返回登录成功结果。

### 4.1.3 成功响应示例

```json
{
  "status": "success",
  "message": "登录成功",
  "session_token": "sess_xxx",
  "wx_identity": "wx_staff_identity",
  "role": "staff",
  "permissions": ["activity:checkin", "activity:checkout", "activity:detail"],
  "is_registered": true,
  "user_profile": {
    "student_id": "2025000007",
    "name": "刘洋",
    "department": "学生工作部",
    "club": "活动执行组",
    "avatar_url": "",
    "social_score": 0,
    "lecture_score": 0
  }
}
```

### 4.1.4 成功响应字段定义

| 字段 | 类型 | 必返 | 字段语义 | 后端来源 |
|---|---|---|---|---|
| `status` | string | 是 | 业务结果状态，成功为 `success` | 业务层固定值 |
| `message` | string | 建议 | 可读提示文案 | 业务层 |
| `session_token` | string | 是 | 后续接口鉴权令牌 | 会话存储 |
| `wx_identity` | string | 建议 | 微信身份映射标识 | 微信身份映射表 |
| `role` | string | 是 | 用户角色 | 用户权限表 |
| `permissions` | string[] | 建议 | 权限列表 | 用户权限表 |
| `is_registered` | boolean | 是 | 当前微信是否已完成“学号+姓名”绑定 | 用户绑定关系表 |
| `user_profile.student_id` | string | 建议 | 学号 | 用户表 |
| `user_profile.name` | string | 建议 | 姓名 | 用户表 |
| `user_profile.department` | string | 建议 | 院系/部门 | 用户表 |
| `user_profile.club` | string | 建议 | 社团/组织 | 用户表 |
| `user_profile.avatar_url` | string | 可选 | 头像地址 | 用户表 |
| `user_profile.social_score` | number | 建议 | 社会分 | 积分表/用户表 |
| `user_profile.lecture_score` | number | 建议 | 讲座分 | 积分表/用户表 |

### 4.1.5 失败响应定义

| status | message 建议 | 触发条件 |
|---|---|---|
| `invalid_param` | 登录参数不合法 | `wx_login_code` 为空或格式非法 |
| `failed` | 微信登录校验失败 | 调用微信接口失败或 code 无效 |
| `forbidden` | 账号受限，无法登录 | 账号被封禁或角色禁用 |

未注册用户成功登录示例（关键）：
```json
{
  "status": "success",
  "message": "登录成功",
  "session_token": "sess_new_001",
  "wx_identity": "wx_normal_identity",
  "role": "normal",
  "permissions": [],
  "is_registered": false,
  "user_profile": {
    "student_id": "",
    "name": "",
    "department": "信息工程学院",
    "club": "开源技术社",
    "avatar_url": "",
    "social_score": 0,
    "lecture_score": 0
  }
}
```

---

## 4.2 A-02 用户注册绑定

**方法/路径**: `POST /api/register`

### 4.2.1 请求参数

| 字段 | 位置 | 必填 | 类型 | 约束 | 字段语义 |
|---|---|---|---|---|---|
| `session_token` | body | 是 | string | 非空；需能解析到有效会话 | 调用方会话令牌 |
| `student_id` | body | 是 | string | 非空；建议正则 `^[0-9A-Za-z_-]{4,32}$` | 学号 |
| `name` | body | 是 | string | 非空；建议长度 1~64 | 姓名 |
| `department` | body | 否 | string | 可空；建议最大长度 128 | 院系/部门 |
| `club` | body | 否 | string | 可空；建议最大长度 128 | 社团/组织 |
| `payload_encrypted` | body | 否 | string | 可空；若使用需可验签/可解密 | 前端提交的加密补充载荷 |

### 请求示例（传参示例）

前端调用示例（小程序）：
```js
await wx.request({
  url: "https://api.example.com/api/register",
  method: "POST",
  data: {
    session_token: "sess_xxx",
    student_id: "2025000007",
    name: "刘洋",
    department: "学生工作部",
    club: "活动执行组",
    payload_encrypted: "base64:xxxx"
  }
});
```

等价 `curl` 示例：
```bash
curl -X POST "https://api.example.com/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "sess_xxx",
    "student_id": "2025000007",
    "name": "刘洋",
    "department": "学生工作部",
    "club": "活动执行组",
    "payload_encrypted": "base64:xxxx"
  }'
```

### 4.2.2 后端处理步骤（必须按序）
1. 校验 `session_token`，解析用户 ID。
2. 校验 `student_id`、`name` 必填且格式合法。
3. 若有 `payload_encrypted`：
   - 执行解密/验签。
   - 校验解密结果与明文字段是否冲突。
   - 冲突时返回 `invalid_param`。
4. 查询当前微信是否已有绑定：
   - 已绑定同一学号姓名：视为幂等更新（可更新部门/社团）。
   - 已绑定其他学号姓名：返回 `wx_already_bound`。
5. 校验学号姓名唯一性：
   - 若该 `student_id + name` 已被其他微信绑定，返回 `student_already_bound`。
6. 使用 `student_id + name` 查询“管理员名册/权限表”（数据库）：
   - 命中管理员记录 -> 角色设为 `staff`，并下发管理员权限集。
   - 未命中 -> 角色设为 `normal`，权限集为空。
7. 更新用户资料字段（学号、姓名、部门、社团）与角色权限。
8. 持久化后重新读取用户资料，作为返回值。

数据库约束建议（强制）：
1. `UNIQUE(wx_identity)`。
2. `UNIQUE(student_id, name)` 或更严格 `UNIQUE(student_id)`（按学校规则选择）。
3. 在并发下依赖唯一索引兜底，捕获重复键后映射为 `student_already_bound` / `wx_already_bound`。

### 4.2.3 成功响应示例

```json
{
  "status": "success",
  "message": "绑定成功",
  "role": "staff",
  "permissions": ["activity:checkin", "activity:checkout", "activity:detail"],
  "admin_verified": true,
  "is_registered": true,
  "user_profile": {
    "student_id": "2025000007",
    "name": "刘洋",
    "department": "学生工作部",
    "club": "活动执行组"
  }
}
```

### 4.2.4 成功响应字段定义

| 字段 | 类型 | 必返 | 字段语义 | 后端来源 |
|---|---|---|---|---|
| `status` | string | 是 | 绑定操作结果 | 业务层固定值 |
| `message` | string | 是 | 可读提示文案 | 业务层 |
| `role` | string | 建议 | 绑定后最终角色（`normal/staff`） | 角色权限表 / 管理员名册 |
| `permissions` | string[] | 建议 | 绑定后权限列表 | 角色权限表 |
| `admin_verified` | boolean | 建议 | 是否命中管理员名册校验 | 管理员名册表 |
| `is_registered` | boolean | 建议 | 绑定后是否已注册 | 用户绑定关系表 |
| `user_profile.student_id` | string | 是 | 绑定后的学号 | 用户表 |
| `user_profile.name` | string | 是 | 绑定后的姓名 | 用户表 |
| `user_profile.department` | string | 建议 | 绑定后的院系/部门 | 用户表 |
| `user_profile.club` | string | 建议 | 绑定后的社团/组织 | 用户表 |

### 4.2.5 失败响应定义

| status | message 建议 | 触发条件 |
|---|---|---|
| `forbidden` | 会话失效，请重新登录 | `session_token` 无效或过期 |
| `invalid_param` | 学号或姓名不合法 | 必填字段缺失/格式错误/解密冲突 |
| `student_already_bound` | 该学号姓名已绑定其他微信，禁止重复绑定 | 命中学号姓名唯一约束 |
| `wx_already_bound` | 当前微信已绑定其他学号姓名，请勿重复绑定 | 命中微信唯一约束 |
| `failed` | 绑定失败，请稍后重试 | 数据库更新异常 |

冲突响应示例（同学号姓名多微信绑定）：
```json
{
  "status": "student_already_bound",
  "message": "该学号姓名已绑定其他微信，禁止重复绑定"
}
```

管理员命中响应示例（关键）：
```json
{
  "status": "success",
  "message": "绑定成功",
  "role": "staff",
  "permissions": ["activity:checkin", "activity:checkout", "activity:detail"],
  "admin_verified": true,
  "is_registered": true,
  "user_profile": {
    "student_id": "2025000007",
    "name": "刘洋",
    "department": "学生工作部",
    "club": "活动执行组"
  }
}
```

---

## 4.3 A-03 活动列表

**方法/路径**: `GET /api/staff/activities`

### 4.3.1 请求参数

| 字段 | 位置 | 必填 | 类型 | 约束 | 字段语义 |
|---|---|---|---|---|---|
| `session_token` | query/body | 是 | string | 非空且有效 | 会话令牌 |
| `role_hint` | query/body | 否 | string | 可选值 `normal`/`staff` | 客户端角色提示，后端不可作为权限依据 |
| `visibility_scope` | query/body | 否 | string | 可选；如 `joined_or_participated` / `all` | 客户端视图提示，后端按真实权限处理 |

### 请求示例（传参示例）

```bash
curl -G "https://api.example.com/api/staff/activities" \
  --data-urlencode "session_token=sess_xxx" \
  --data-urlencode "role_hint=normal" \
  --data-urlencode "visibility_scope=joined_or_participated"
```

### 4.3.2 后端处理步骤（必须按序）
1. 校验会话并获取真实角色 `real_role`。
2. 查询活动主表与统计字段。
3. 若 `real_role = normal`：
   - 查询用户与活动关系（报名、签到、签退）。
   - 仅返回“已报名或已签到或已签退”的活动。
4. 若 `real_role = staff`：返回其有权限查看的活动（本期可视作全部）。
5. 为每个活动补齐返回字段，尤其是：
   - `progress_status`
   - `support_checkout`
   - `checkin_count`
   - `checkout_count`
6. 返回 `activities` 数组。

### 4.3.3 成功响应示例

```json
{
  "status": "success",
  "activities": [
    {
      "activity_id": "act_hackathon_20260215",
      "activity_title": "校园 HackDay",
      "activity_type": "竞赛",
      "start_time": "2026-02-15 09:00",
      "location": "创新中心 1F",
      "description": "48 小时团队赛，支持签到与签退。",
      "progress_status": "ongoing",
      "support_checkout": true,
      "has_detail": true,
      "checkin_count": 18,
      "checkout_count": 3,
      "my_registered": true,
      "my_checked_in": false,
      "my_checked_out": false
    }
  ]
}
```

### 4.3.4 `activities[]` 字段定义

| 字段 | 类型 | 必返 | 字段语义 | 后端来源 |
|---|---|---|---|---|
| `activity_id` | string | 是 | 活动唯一标识 | 活动表主键 |
| `activity_title` | string | 是 | 活动标题 | 活动表 |
| `activity_type` | string | 是 | 活动类型文本 | 活动表 |
| `start_time` | string | 是 | 活动开始时间（可展示格式） | 活动表 |
| `location` | string | 是 | 活动地点 | 活动表 |
| `description` | string | 建议 | 活动描述 | 活动表 |
| `progress_status` | string | 强烈建议 | 活动进度（`ongoing`/`completed`） | 活动表或规则推导 |
| `support_checkout` | boolean | 是 | 是否支持签退动作 | 活动配置表 |
| `has_detail` | boolean | 是 | 是否允许进入详情页 | 活动配置表 |
| `checkin_count` | number | 是 | 当前签到计数 | 统计表/活动表冗余字段 |
| `checkout_count` | number | 建议 | 当前签退计数 | 统计表/活动表冗余字段 |
| `my_registered` | boolean | normal 必返 | 当前用户是否已报名 | 报名关系表 |
| `my_checked_in` | boolean | normal 必返 | 当前用户是否已签到 | 用户活动状态表 |
| `my_checked_out` | boolean | normal 必返 | 当前用户是否已签退 | 用户活动状态表 |

### 4.3.5 失败响应定义

| status | message 建议 | 触发条件 |
|---|---|---|
| `forbidden` | 会话失效，请重新登录 | `session_token` 无效 |
| `failed` | 活动列表加载失败 | 查询异常 |

---

## 4.4 A-04 活动详情（重点重构）

**方法/路径**: `GET /api/staff/activities/{activity_id}`

### 4.4.1 请求参数

| 字段 | 位置 | 必填 | 类型 | 约束 | 字段语义 |
|---|---|---|---|---|---|
| `activity_id` | path | 是 | string | 非空；建议正则 `^[0-9A-Za-z_-]{1,64}$` | 要查询的活动主键 |
| `session_token` | query/body | 是 | string | 非空且有效 | 会话令牌 |
| `role_hint` | query/body | 否 | string | 可选值 `normal`/`staff` | 客户端提示，后端不可据此授权 |
| `visibility_scope` | query/body | 否 | string | 可选 | 客户端提示字段，后端可忽略 |

### 请求示例（传参示例）

```bash
curl -G "https://api.example.com/api/staff/activities/act_hackathon_20260215" \
  --data-urlencode "session_token=sess_xxx" \
  --data-urlencode "role_hint=normal" \
  --data-urlencode "visibility_scope=joined_or_participated"
```

### 4.4.2 后端处理步骤（必须按序）
1. 校验 `session_token`，获取 `user_id` 与 `real_role`。
2. 校验 `activity_id` 格式。
3. 查询活动主记录；不存在返回 `invalid_activity`。
4. 若 `real_role = normal`：
   - 查询用户-活动关系（报名、签到、签退）。
   - 若关系全为否，返回 `forbidden`。
5. 查询活动统计信息（`checkin_count`、`checkout_count`）。
6. 查询活动动作能力（`support_checkout`、`has_detail`）。
7. 读取二维码策略默认值（`rotate_seconds`、`grace_seconds`）并返回 `server_time`。
8. 组装完整详情响应。

### 4.4.3 成功响应示例

```json
{
  "status": "success",
  "activity_id": "act_hackathon_20260215",
  "activity_title": "校园 HackDay",
  "activity_type": "竞赛",
  "start_time": "2026-02-15 09:00",
  "location": "创新中心 1F",
  "description": "48 小时团队赛，支持签到与签退。",
  "progress_status": "ongoing",
  "support_checkout": true,
  "has_detail": true,
  "checkin_count": 18,
  "checkout_count": 3,
  "my_registered": true,
  "my_checked_in": false,
  "my_checked_out": false,
  "rotate_seconds": 10,
  "grace_seconds": 20,
  "server_time": 1770518390000
}
```

### 4.4.4 成功响应字段定义

| 字段 | 类型 | 必返 | 字段语义 | 后端来源 |
|---|---|---|---|---|
| `status` | string | 建议 | 详情查询状态 | 业务层 |
| `activity_id` | string | 是 | 活动主键 | 活动表 |
| `activity_title` | string | 是 | 活动标题 | 活动表 |
| `activity_type` | string | 是 | 活动类型 | 活动表 |
| `start_time` | string | 是 | 开始时间 | 活动表 |
| `location` | string | 是 | 地点 | 活动表 |
| `description` | string | 建议 | 描述 | 活动表 |
| `progress_status` | string | 建议 | 进度状态 | 活动表/规则推导 |
| `support_checkout` | boolean | 是 | 是否允许签退 | 活动配置表 |
| `has_detail` | boolean | 是 | 是否允许详情展示 | 活动配置表 |
| `checkin_count` | number | 是 | 当前签到计数 | 统计表/活动表冗余 |
| `checkout_count` | number | 建议 | 当前签退计数 | 统计表/活动表冗余 |
| `my_registered` | boolean | normal 建议 | 用户是否报名 | 报名关系表 |
| `my_checked_in` | boolean | normal 建议 | 用户是否签到 | 用户活动状态表 |
| `my_checked_out` | boolean | normal 建议 | 用户是否签退 | 用户活动状态表 |
| `rotate_seconds` | number | 建议 | 默认轮换秒数 | 系统配置 |
| `grace_seconds` | number | 建议 | 默认宽限秒数 | 系统配置 |
| `server_time` | number | 建议 | 服务端当前毫秒时间戳 | 系统时钟 |

### 4.4.5 失败响应定义

| status | message 建议 | 触发条件 |
|---|---|---|
| `invalid_activity` | 活动不存在或已下线 | `activity_id` 不存在 |
| `forbidden` | 你未报名或参加该活动，无法查看详情 | normal 用户无可见性权限 |
| `forbidden` | 会话失效，请重新登录 | `session_token` 无效 |

---

## 4.5 A-05 staff 二维码策略配置（重点重构）

**方法/路径**: `POST /api/staff/activities/{activity_id}/qr-session`

### 4.5.1 请求参数

| 字段 | 位置 | 必填 | 类型 | 约束 | 字段语义 |
|---|---|---|---|---|---|
| `activity_id` | path | 是 | string | 非空；建议正则 `^[0-9A-Za-z_-]{1,64}$` | 目标活动主键 |
| `session_token` | body | 是 | string | 非空且有效；角色必须为 `staff` | staff 会话令牌 |
| `action_type` | body | 是 | string | 仅允许 `checkin` / `checkout` | 当前要生成哪种动作二维码 |
| `rotate_seconds` | body | 否 | number | 整数；建议范围 `1~30`；非法值回退默认 | 希望的轮换秒数 |
| `grace_seconds` | body | 否 | number | 整数；建议范围 `1~120`；非法值回退默认 | 希望的宽限秒数 |

### 请求示例（传参示例）

```bash
curl -X POST "https://api.example.com/api/staff/activities/act_hackathon_20260215/qr-session" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "sess_staff_xxx",
    "action_type": "checkin",
    "rotate_seconds": 10,
    "grace_seconds": 20
  }'
```

### 4.5.2 后端处理步骤（必须按序）
1. 校验 `session_token`，确认 `role = staff`。
2. 校验 `activity_id` 格式并查询活动。
3. 活动不存在 -> `invalid_activity`。
4. 活动 `progress_status = completed` -> `forbidden`。
5. 若 `action_type = checkout` 且活动不支持签退 -> `forbidden`。
6. 归一化窗口参数：
   - `rotate_seconds` 非法则回退默认。
   - `grace_seconds` 非法则回退默认。
7. 返回策略配置及 `server_time`。

### 4.5.3 成功响应示例

```json
{
  "status": "success",
  "message": "配置获取成功",
  "activity_id": "act_hackathon_20260215",
  "action_type": "checkin",
  "rotate_seconds": 10,
  "grace_seconds": 20,
  "server_time": 1770518390000
}
```

### 4.5.4 成功响应字段定义

| 字段 | 类型 | 必返 | 字段语义 | 后端来源 |
|---|---|---|---|---|
| `status` | string | 是 | 业务状态，成功为 `success` | 业务层 |
| `message` | string | 建议 | 可读提示文案 | 业务层 |
| `activity_id` | string | 是 | 活动主键回显 | 入参回显/活动表 |
| `action_type` | string | 是 | 动作类型回显 | 入参归一化结果 |
| `rotate_seconds` | number | 是 | 前端换码周期 | 入参归一化结果/系统默认 |
| `grace_seconds` | number | 是 | 提交宽限周期 | 入参归一化结果/系统默认 |
| `server_time` | number | 是 | 服务端当前毫秒时间 | 系统时钟 |

### 4.5.5 失败响应定义

| status | message 建议 | 触发条件 |
|---|---|---|
| `forbidden` | 仅工作人员可获取二维码配置 | 非 staff |
| `invalid_activity` | 活动不存在或已下线 | 活动不存在 |
| `forbidden` | 已完成活动仅支持查看详情 | 活动已结束 |
| `forbidden` | 该活动暂不支持签退二维码 | `action_type=checkout` 且活动不支持 |
| `invalid_param` | 参数不合法 | `action_type` 非法且无法归一 |

### 4.5.6 强制约束（必须执行）
- 本接口只返回“策略配置”，不返回二维码图片。
- 本接口不返回二维码 payload 文本。
- payload 文本由小程序端本地生成，后端只负责在 A-06 校验与消费。

---

## 4.6 A-06 normal 扫码提交签到/签退

**方法/路径**: `POST /api/checkin/consume`

### 4.6.1 请求参数

| 字段 | 位置 | 必填 | 类型 | 约束 | 字段语义 |
|---|---|---|---|---|---|
| `session_token` | body | 是 | string | 非空且有效；角色必须为 `normal` | normal 会话令牌 |
| `qr_payload` | body | 建议 | string | 推荐必传；需符合 payload 协议 | 扫码得到的主文本 |
| `scan_type` | body | 否 | string | 可空；建议长度 <= 32 | 扫码来源类型（日志字段） |
| `raw_result` | body | 否 | string | 可空；建议长度 <= 2048 | 原始扫码结果（审计/兜底解析） |
| `path` | body | 否 | string | 可空；建议长度 <= 2048 | 小程序码 path（审计/兜底解析） |
| `activity_id` | body | 建议 | string | 若传入，必须与 payload 解析一致 | 结构化活动 ID 冗余字段 |
| `action_type` | body | 建议 | string | 若传入，必须与 payload 解析一致 | 结构化动作类型冗余字段 |
| `slot` | body | 建议 | integer | 若传入，必须与 payload 一致且 `>=0` | 结构化时间片冗余字段 |
| `nonce` | body | 建议 | string | 若传入，必须与 payload 一致 | 结构化随机串冗余字段 |

### 请求示例（传参示例）

```bash
curl -X POST "https://api.example.com/api/checkin/consume" \
  -H "Content-Type: application/json" \
  -d '{
    "session_token": "sess_normal_xxx",
    "qr_payload": "wxcheckin:v1:act_hackathon_20260215:checkin:177051839:n100001",
    "scan_type": "QR_CODE",
    "raw_result": "wxcheckin:v1:act_hackathon_20260215:checkin:177051839:n100001",
    "path": "",
    "activity_id": "act_hackathon_20260215",
    "action_type": "checkin",
    "slot": 177051839,
    "nonce": "n100001"
  }'
```

### 4.6.2 后端解析规则

1. 解析优先级：`qr_payload` > `path` > `raw_result`。
2. 若 `qr_payload` 不可解析，尝试从 `path` 或 `raw_result` 中提取。
3. 只要结构化冗余字段存在，必须与最终解析结果一致。
4. 任一关键字段缺失（`activity_id`、`action_type`、`slot`）即 `invalid_qr`。

### 4.6.3 后端处理步骤（必须按序执行）

1. **鉴权**: 校验 `session_token`，确认角色是 `normal`。
2. **限流**: 按用户做短窗限流（当前建议: 5 秒窗口最多 6 次）。命中返回 `forbidden`。
3. **解析载荷**: 按 4.6.2 规则得到标准上下文：`activity_id`、`action_type`、`slot`、`nonce`。
4. **一致性校验**: 若请求里有结构化字段，必须与解析结果一致；不一致返回 `invalid_qr`。
5. **活动校验**: 查询活动，不存在返回 `invalid_activity`。
6. **可见性校验**: 用户未报名且无参与记录（签到/签退）则返回 `forbidden`。
7. **活动状态校验**: 活动已完成返回 `forbidden`。
8. **动作能力校验**: `checkout` 但活动不支持签退返回 `forbidden`。
9. **时效校验**:
   - `slot` 在未来 -> `invalid_qr`
   - 超过宽限 -> `expired`
10. **防重放校验**: 幂等键 `user_id + activity_id + action_type + slot`，已消费则 `duplicate`。
11. **业务状态机校验**:
   - 已 `checked_in` 再执行 `checkin` -> `duplicate`
   - 非 `checked_in` 执行 `checkout` -> `forbidden`
12. **事务写入（必须同事务）**:
   - 写签到记录 `checkin_record`。
   - 更新用户活动状态（`none`/`checked_in`/`checked_out`）。
   - 更新活动计数（签到+1 或签退-1+签退计数+1）。
   - 写入防重放键（含过期时间）。
13. **返回结果**: 包含记录 ID、动作类型、活动信息、是否宽限窗口。

### 4.6.4 成功响应示例

```json
{
  "status": "success",
  "message": "签到成功",
  "action_type": "checkin",
  "activity_id": "act_hackathon_20260215",
  "activity_title": "校园 HackDay",
  "checkin_record_id": "rec_1770518401000",
  "in_grace_window": false,
  "slot": 177051839
}
```

### 4.6.5 成功响应字段定义

| 字段 | 类型 | 必返 | 字段语义 | 后端来源 |
|---|---|---|---|---|
| `status` | string | 是 | 提交结果，成功为 `success` | 业务层 |
| `message` | string | 是 | 可读提示文案 | 业务层 |
| `action_type` | string | 是 | 实际执行动作 | 解析结果/业务层 |
| `activity_id` | string | 是 | 实际消费活动 ID | 解析结果 |
| `activity_title` | string | 建议 | 活动标题 | 活动表 |
| `checkin_record_id` | string | 建议 | 本次提交对应记录 ID | 签到记录表 |
| `in_grace_window` | boolean | 建议 | 是否在宽限窗口内消费 | 时效校验结果 |
| `slot` | integer | 建议 | 实际消费时间片 | 解析结果 |

### 4.6.6 失败响应定义（详细）

| status | message 建议 | 触发条件 |
|---|---|---|
| `forbidden` | 仅普通用户可扫码签到/签退 | 非 normal 用户提交 |
| `forbidden` | 提交过于频繁，请稍后再试 | 命中限流 |
| `invalid_qr` | 二维码无法识别，请重新扫码 | payload 无法解析 |
| `invalid_qr` | 二维码数据不一致，请重新扫码 | 冗余字段与 payload 冲突 |
| `invalid_activity` | 活动不存在或已下线 | 活动不存在 |
| `forbidden` | 你未报名该活动，无法签到/签退 | 无可见性权限 |
| `forbidden` | 活动已结束，无法再签到/签退 | 活动状态 completed |
| `forbidden` | 该活动暂不支持签退 | `checkout` 且活动不支持 |
| `invalid_qr` | 二维码时间异常，请重新扫码 | `slot` 在未来 |
| `expired` | 二维码已过期，请重新获取 | 超过宽限时间 |
| `duplicate` | 当前时段已提交，请勿重复扫码 | 防重放命中 |
| `duplicate` | 你已签到，请勿重复提交 | 重复签到 |
| `forbidden` | 请先完成签到再签退 | 未签到直接签退 |
| `failed` | 提交失败，请稍后重试 | 事务写入或系统异常 |

### 4.6.7 事务与并发要求（必须执行）

- A-06 的“状态判断 + 计数更新 + 记录写入 + 防重放写入”必须同事务。
- 建议对用户活动状态行加悲观锁或基于版本号乐观锁，避免并发双写。
- `checkin_count` 最低不得小于 0。

---

## 5. 数据一致性与状态机

## 5.1 用户活动状态机

| 当前状态 | action_type | 下一状态 | 是否允许 |
|---|---|---|---|
| `none` | `checkin` | `checked_in` | 允许 |
| `none` | `checkout` | 无 | 拒绝（先签到） |
| `checked_in` | `checkin` | `checked_in` | 拒绝（重复） |
| `checked_in` | `checkout` | `checked_out` | 允许 |
| `checked_out` | `checkin` | `checked_in`（按业务策略） | 本期建议拒绝或单独定义 |
| `checked_out` | `checkout` | `checked_out` | 拒绝（重复） |

> 本期如果不支持“签退后再次签到”，应明确返回 `forbidden` 或 `duplicate`，并在实现中固定策略。

## 5.2 计数更新规则

- `checkin` 成功：`checkin_count + 1`
- `checkout` 成功：`checkin_count - 1`（下限 0）且 `checkout_count + 1`
- 所有计数更新都必须发生在与签到记录同一事务中。

## 5.3 防重放键

推荐键结构：
```text
<user_id>:<activity_id>:<action_type>:<slot>
```

要求：
- 命中则返回 `duplicate`。
- 建议设置 TTL（不小于 `rotate_seconds + grace_seconds`）。

---

## 6. 非主链路接口说明（不作为本期上线阻塞）

`src/utils/api.js` 仍保留以下封装，但当前主页面未直接依赖：
- `POST /api/checkin/verify`
- `POST /api/staff/activity-action`
- `GET /api/checkin/records`
- `GET /api/checkin/records/{record_id}`
- `GET /api/activity/current`

这 5 个接口可后续处理；本期上线阻塞项仅为第 3.1 节列出的 6 个主链路接口。

---

## 7. 联调验收清单（后端）

1. A-05 正常返回策略配置，且响应中不包含二维码内容字段。
2. A-06 合法 payload 提交返回 `success`，并正确生成记录与更新计数。
3. A-06 使用未来 slot 返回 `invalid_qr`。
4. A-06 使用过期 slot 返回 `expired`。
5. A-06 同用户同活动同动作同 slot 重复提交返回 `duplicate`。
6. A-06 未报名用户提交返回 `forbidden`。
7. A-06 未签到直接签退返回 `forbidden`。
8. A-05 对 completed 活动返回 `forbidden`。
9. A-04 对 normal 越权查看返回 `forbidden`。

---

## 8. 版本记录

- 2026-02-08 v4.2：A-02 新增“学号+姓名命中管理员名册 -> staff 角色”后端处理步骤；补齐 `role/permissions/admin_verified` 注册响应字段与管理员命中示例；明确 A-01 到 A-02 的角色最终归一关系。
- 2026-02-08 v4.1：补齐 6 个主链路 API 的请求传参示例；明确 `wx_login_code`、`session_token`、`payload_encrypted` 的后端解析技术建议；新增 `is_registered` 字段与注册冲突状态（`student_already_bound`、`wx_already_bound`）。
- 2026-02-08 v4.0：重构为后端实施视角；完整覆盖 6 个主链路 API；逐字段参数/返回语义与逐步骤后端处理流程；重写 4.4 与 4.5 可读性。
