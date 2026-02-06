# 后端接口说明（2026-02-06）

> 本文档按当前前端实现 `src/utils/api.js` 对齐。  
> 当前前端默认直接读取响应体顶层字段（不是 `data.xxx`）。  
> 如后端采用 `code/message/data` 包裹，请先同步前端做解包适配。

## 1. 通用约定

### 1.1 基础信息
- Base URL：`src/utils/config.js` 的 `baseUrl`
- 协议：HTTPS
- Content-Type：`application/json`
- 会话：通过 `session_token` 识别

### 1.2 状态语义
- 成功：`status = "success"`
- 二维码失效：`status = "invalid_qr"`
- 重复操作：`status = "duplicate"`
- 身份不匹配：`status = "identity_mismatch"`
- 权限不足：`status = "forbidden"`

---

## 2. 接口清单

### 2.1 微信登录换会话
**POST** `/api/auth/wx-login`

请求：
```json
{
  "wx_login_code": "string"
}
```

响应（顶层）：
```json
{
  "wx_identity": "string",
  "session_token": "string",
  "role": "normal",
  "permissions": [],
  "user_profile": {
    "student_id": "2025011001",
    "name": "李晨",
    "department": "信息工程学院",
    "club": "开源技术社",
    "avatar_url": "",
    "social_score": 28,
    "lecture_score": 14
  }
}
```

字段说明：
- `role`: `"normal"` 或 `"staff"`
- `permissions`: 权限数组，示例 `["activity:checkin", "activity:checkout", "activity:detail"]`
- `social_score` / `lecture_score`: 普通用户“我的”页积分

---

### 2.2 注册绑定
**POST** `/api/register`

请求：
```json
{
  "session_token": "string",
  "student_id": "string",
  "name": "string",
  "department": "string",
  "club": "string",
  "payload_encrypted": "string"
}
```

响应：
```json
{
  "status": "success",
  "message": "绑定成功",
  "user_profile": {
    "student_id": "string",
    "name": "string",
    "department": "string",
    "club": "string",
    "avatar_url": "string",
    "social_score": 0,
    "lecture_score": 0
  }
}
```

---

### 2.3 工作人员活动列表（当前也给普通用户用）
**GET** `/api/staff/activities`

请求：
```json
{
  "session_token": "string"
}
```

响应：
```json
{
  "activities": [
    {
      "activity_id": "act_xxx",
      "activity_title": "新生技术讲座",
      "activity_type": "讲座",
      "start_time": "2026-01-12 19:00",
      "location": "南校区报告厅",
      "support_checkout": false,
      "has_detail": true,
      "description": "string",
      "checkin_count": 120,
      "my_checked_in": true
    }
  ]
}
```

字段规则：
- `checkin_count`：工作人员视角展示总签到人数
- `my_checked_in`：普通用户视角展示“我的签到状态”
- 后端可同时返回两者，前端按角色决定展示哪个

---

### 2.4 工作人员签到/签退动作
**POST** `/api/staff/activity-action`

请求：
```json
{
  "session_token": "string",
  "activity_id": "string",
  "action_type": "checkin",
  "qr_token": "string"
}
```

响应：
```json
{
  "status": "success",
  "message": "签到成功",
  "checkin_record_id": "rec_xxx"
}
```

`action_type` 取值：
- `checkin`
- `checkout`

---

### 2.5 活动详情
**GET** `/api/staff/activities/{activity_id}`

响应：
```json
{
  "activity_id": "string",
  "activity_title": "string",
  "activity_type": "string",
  "start_time": "YYYY-MM-DD HH:mm",
  "location": "string",
  "checkin_count": 0,
  "support_checkout": false,
  "has_detail": true,
  "description": "string"
}
```

---

### 2.6 我的活动记录列表
**GET** `/api/checkin/records`

请求：
```json
{
  "session_token": "string"
}
```

响应：
```json
{
  "records": [
    {
      "record_id": "rec_xxx",
      "time": "YYYY-MM-DD HH:mm:ss",
      "location": "string",
      "activity_title": "string",
      "description": "string"
    }
  ]
}
```

---

### 2.7 活动记录详情
**GET** `/api/checkin/records/{record_id}`

响应：
```json
{
  "record_id": "rec_xxx",
  "time": "YYYY-MM-DD HH:mm:ss",
  "location": "string",
  "activity_title": "string",
  "description": "string"
}
```

---

### 2.8 兼容旧接口（可保留）
**GET** `/api/activity/current`

响应：
```json
{
  "activity_title": "string",
  "description": "string",
  "qr_expire_seconds": 10
}
```

---

## 3. 后端需重点提供字段（高优先）
- 登录接口：`role`、`permissions`、`user_profile.social_score`、`user_profile.lecture_score`
- 活动列表接口：`my_checked_in`（普通用户卡片状态）
- 活动列表接口：`checkin_count`（工作人员卡片统计）
- 活动动作接口：`status`、`message`、`checkin_record_id`

## 4. 版本记录
- 2026-02-04：初版接口说明
- 2026-02-06：更新为角色分流版本（普通用户积分、我的签到状态、工作人员活动动作）
