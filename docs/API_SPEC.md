# 后端接口说明（前端需求）

> 文档目的：为后端实现提供清晰的接口定义（输入、返回、错误码、业务说明）。
> 本文档与前端实现 `src/utils/api.js` 对齐，返回结构统一为：
>
> ```json
> { "code": 0, "message": "ok", "data": { } }
> ```
>
> 约定：`code = 0` 表示成功，其它值表示业务或系统错误。

## 1. 通用约定

### 1.1 基础信息
- **Base URL**：由 `src/utils/config.js` 的 `baseUrl` 配置
- **传输协议**：HTTPS
- **数据格式**：`application/json`
- **认证方式**：通过 `session_token` 完成会话识别

### 1.2 通用响应结构
```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

### 1.3 错误码建议
| code | 场景 | 说明 |
|------|------|------|
| 0 | 成功 | 请求成功 |
| 40001 | 参数错误 | 缺失或格式错误 |
| 40002 | 未授权 | session_token 无效 |
| 40003 | 重复签到 | 同一活动重复签到 |
| 40004 | 二维码失效 | 二维码过期或无效 |
| 40005 | 身份不匹配 | 学号/姓名与身份不一致 |
| 50000 | 服务异常 | 未知错误 |

### 1.4 状态字段约定（兼容前端旧逻辑）
为了兼容前端已有的 status 逻辑，建议在 `data` 中保留 `status` 字段：
- `success`
- `duplicate`
- `invalid_qr`
- `identity_mismatch`

> 后端也可仅用 `code`，但建议两者并存以减少前端改动。

---

## 2. 接口列表

### 2.1 获取微信身份会话
**用途**：微信登录换取后端身份与会话令牌

**Endpoint**：`POST /api/auth/wx-login`

**请求参数**：
```json
{ "wx_login_code": "string" }
```

**响应示例**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "wx_identity": "string",
    "session_token": "string"
  }
}
```

**错误说明**：
- `40001`：缺少 `wx_login_code`
- `50000`：微信服务或内部异常

---

### 2.2 注册绑定
**用途**：绑定微信身份与学号姓名

**Endpoint**：`POST /api/register`

**请求参数**：
```json
{
  "session_token": "string",
  "student_id": "string",
  "name": "string",
  "payload_encrypted": "string"
}
```

**响应示例**：
```json
{
  "code": 0,
  "message": "绑定成功",
  "data": {
    "status": "success"
  }
}
```

**错误说明**：
- `40001`：参数缺失
- `40002`：`session_token` 无效
- `50000`：服务异常

---

### 2.3 签到验证
**用途**：扫码后验证二维码有效性并完成签到

**Endpoint**：`POST /api/checkin/verify`

**请求参数**：
```json
{
  "session_token": "string",
  "qr_token": "string",
  "student_id": "string",
  "name": "string"
}
```

**响应示例（成功）**：
```json
{
  "code": 0,
  "message": "签到成功",
  "data": {
    "status": "success",
    "checkin_record_id": "string"
  }
}
```

**响应示例（失败）**：
```json
{
  "code": 40004,
  "message": "二维码已失效",
  "data": {
    "status": "invalid_qr"
  }
}
```

**错误说明**：
- `40004`：二维码失效
- `40003`：重复签到
- `40005`：身份不匹配
- `40002`：`session_token` 无效

---

### 2.4 签到记录列表
**用途**：获取用户的签到记录列表

**Endpoint**：`GET /api/checkin/records`

**请求参数**：
```json
{ "session_token": "string" }
```

**响应示例**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "records": [
      {
        "record_id": "string",
        "time": "YYYY-MM-DD HH:mm:ss",
        "location": "string",
        "activity_title": "string"
      }
    ]
  }
}
```

**错误说明**：
- `40002`：`session_token` 无效

---

### 2.5 签到记录详情
**用途**：获取单条签到记录详情

**Endpoint**：`GET /api/checkin/records/{record_id}`

**响应示例**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "record_id": "string",
    "time": "YYYY-MM-DD HH:mm:ss",
    "location": "string",
    "activity_title": "string",
    "description": "string"
  }
}
```

**错误说明**：
- `40001`：record_id 缺失或非法
- `50000`：服务异常

---

### 2.6 当前活动信息
**用途**：获取当前活动展示信息与二维码有效期

**Endpoint**：`GET /api/activity/current`

**响应示例**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "activity_title": "string",
    "description": "string",
    "qr_expire_seconds": 10
  }
}
```

---

## 3. 前端实现注意点
- 前端在 `src/utils/api.js` 中直接调用上述接口。
- Mock 模式使用同名字段，建议后端字段保持一致。
- 如后端仅使用 `code`，前端可在下次迭代中移除 `status` 依赖，但当前版本建议保留。

## 4. 版本记录
- 2026-02-04：首次建立 API 说明，统一 `code/message/data` 结构。
