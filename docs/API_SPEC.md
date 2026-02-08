# API 协议说明（后端实现版）

文档版本: v3.0  
更新日期: 2026-02-08  
适用分支: `main`  
代码基线: `src/utils/api.js`、`src/utils/qr-payload.js`

---

## 1. 文档目标
本文件只回答后端最关心的问题：
1. 当前版本到底要实现哪些接口。
2. 每个接口的请求/响应契约是什么。
3. 二维码链路里后端的职责边界是什么。
4. 失败时应该返回什么状态，前端会如何处理。

不再记录前端页面实现细节，不再混入历史方案推演。

---

## 2. 职责边界（先统一认知）

### 2.1 二维码职责
- 二维码内容生成与轮换：前端负责（小程序本地生成）。
- 二维码显示与倒计时：前端负责。
- 后端不负责：`qr_payload` 生成、二维码图片生成、10 秒高频换码。

### 2.2 后端职责
- 返回二维码策略配置（轮换秒数、宽限秒数、服务端时间）。
- 校验扫码动作业务合法性（权限、活动状态、时间窗、防重放、状态流转）。
- 更新签到/签退统计与记录。

---

## 3. 通用约定

### 3.1 鉴权与请求
- 业务接口都带 `session_token`。
- 前端会传 `role_hint`/`visibility_scope`，后端可忽略并以会话鉴权为准。

### 3.2 响应结构
当前前端直接读取顶层字段，推荐返回：
```json
{
  "status": "success",
  "message": "...",
  "...": "..."
}
```

### 3.3 角色定义
- `normal`: 普通用户
- `staff`: 工作人员

### 3.4 活动状态
- `progress_status`: `ongoing | completed`

---

## 4. 核心链路（后端视角）

### 4.1 staff 获取二维码配置
`POST /api/staff/activities/{activity_id}/qr-session`

后端返回配置：
- `rotate_seconds`（默认 10）
- `grace_seconds`（默认 20）
- `server_time`（毫秒时间戳）

### 4.2 normal 提交扫码动作
`POST /api/checkin/consume`

后端执行业务校验：
- payload 可解析且字段一致
- slot 时间窗有效
- 用户可见该活动且动作合法
- 非重放、非频率滥用

---

## 5. 接口契约（主链路）

## 5.1 微信登录
**POST** `/api/auth/wx-login`

请求：
```json
{
  "wx_login_code": "string"
}
```

成功响应：
```json
{
  "wx_identity": "wx_staff_identity",
  "session_token": "token_xxx",
  "role": "staff",
  "permissions": ["activity:checkin", "activity:checkout", "activity:detail"],
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

---

## 5.2 注册绑定
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

成功响应：
```json
{
  "status": "success",
  "message": "绑定成功",
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

---

## 5.3 活动列表
**GET** `/api/staff/activities`

请求参数：
```json
{
  "session_token": "string",
  "role_hint": "normal",
  "visibility_scope": "joined_or_participated"
}
```

成功响应（示例）：
```json
{
  "activities": [
    {
      "activity_id": "act_hackathon_20260215",
      "activity_title": "校园 HackDay",
      "activity_type": "竞赛",
      "start_time": "2026-02-15 09:00",
      "location": "创新中心 1F",
      "checkin_count": 18,
      "checkout_count": 3,
      "support_checkout": true,
      "has_detail": true,
      "progress_status": "ongoing",
      "description": "48 小时团队赛",
      "my_registered": true,
      "my_checked_in": false,
      "my_checked_out": false
    }
  ]
}
```

后端要求：
- `normal` 仅返回用户可见活动（已报名/已签到/已签退）。
- `staff` 返回全部活动。

---

## 5.4 活动详情
**GET** `/api/staff/activities/{activity_id}`

请求参数：
```json
{
  "session_token": "string",
  "role_hint": "normal",
  "visibility_scope": "joined_or_participated"
}
```

成功响应（字段同活动列表单项，含 `description` 与统计）。

失败响应（示例）：
```json
{
  "status": "forbidden",
  "message": "你未报名或参加该活动，无法查看详情"
}
```

---

## 5.5 staff 二维码配置接口（重点）
**POST** `/api/staff/activities/{activity_id}/qr-session`

### 目的
只返回二维码策略配置，不返回二维码内容。

### 请求
```json
{
  "session_token": "string",
  "action_type": "checkin",
  "rotate_seconds": 10,
  "grace_seconds": 20
}
```

### 成功响应
```json
{
  "status": "success",
  "activity_id": "act_hackathon_20260215",
  "action_type": "checkin",
  "rotate_seconds": 10,
  "grace_seconds": 20,
  "server_time": 1770518390000
}
```

### 失败状态
| status | message（建议） | 触发条件 |
|---|---|---|
| `forbidden` | 仅工作人员可获取二维码配置 | 非 staff |
| `invalid_activity` | 活动不存在或已下线 | 活动不存在 |
| `forbidden` | 已完成活动仅支持查看详情 | `progress_status=completed` |
| `forbidden` | 该活动暂不支持签退二维码 | `action_type=checkout` 且 `support_checkout=false` |

### 注意
- 不返回 `qr_payload`。
- 不返回 `display_expire_at` / `accept_expire_at`。

---

## 5.6 normal 扫码提交接口（重点）
**POST** `/api/checkin/consume`

### 目的
后端只做业务判定与状态更新。

### 请求（推荐）
```json
{
  "session_token": "string",
  "qr_payload": "wxcheckin:v1:act_hackathon_20260215:checkin:177051839:n100001",
  "scan_type": "QR_CODE",
  "raw_result": "wxcheckin:v1:act_hackathon_20260215:checkin:177051839:n100001",
  "path": "",
  "activity_id": "act_hackathon_20260215",
  "action_type": "checkin",
  "slot": 177051839,
  "nonce": "n100001"
}
```

### payload 协议
`qr_payload` 格式：
```text
wxcheckin:v1:<activity_id>:<action_type>:<slot>:<nonce>
```

### 成功响应
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

### 业务校验顺序（建议）
1. 角色校验：仅 `normal` 可提交。
2. 限流校验：短时高频请求拦截。
3. payload 解析校验：`qr_payload` 可解析。
4. 一致性校验：结构化字段与 `qr_payload` 内容一致。
5. 活动存在与可见性校验。
6. 活动状态校验（已结束不可签到/签退）。
7. 签退能力校验（`support_checkout`）。
8. 时间窗校验（slot 是否未来/是否过期）。
9. 防重放校验（`user_id + activity_id + action_type + slot`）。
10. 状态流转校验：
   - checkin 前不能已签到
   - checkout 前必须已签到

### 失败状态
| status | message（建议） | 触发条件 |
|---|---|---|
| `forbidden` | 仅普通用户可扫码签到/签退 | 非 normal |
| `forbidden` | 提交过于频繁，请稍后再试 | 触发限流 |
| `invalid_qr` | 二维码无法识别，请重新扫码 | payload 无法解析 |
| `invalid_qr` | 二维码数据不一致，请重新扫码 | payload 与结构化字段冲突 |
| `invalid_activity` | 活动不存在或已下线 | 活动不存在 |
| `forbidden` | 你未报名该活动，无法签到/签退 | 不可见活动 |
| `forbidden` | 活动已结束，无法再签到/签退 | completed |
| `forbidden` | 该活动暂不支持签退 | checkout 但不支持 |
| `invalid_qr` | 二维码时间异常，请重新扫码 | slot 在未来 |
| `expired` | 二维码已过期，请重新获取 | slot 超宽限 |
| `duplicate` | 当前时段已提交，请勿重复扫码 | 防重放命中 |
| `duplicate` | 你已签到，请勿重复提交 | 重复签到 |
| `forbidden` | 请先完成签到再签退 | 状态流转非法 |

---

## 6. 保留兼容接口（当前主链路未使用）
- `POST /api/checkin/verify`
- `POST /api/staff/activity-action`
- `GET /api/checkin/records`
- `GET /api/checkin/records/{record_id}`
- `GET /api/activity/current`

这些接口可保留，但不作为当前版本主验收阻塞项。

---

## 7. 联调最小清单（后端测试可直接执行）
1. staff 调 `qr-session` 成功，只返回配置字段，不返回二维码内容。
2. normal 用合法 payload 调 `consume` 成功，状态更新为已签到/已签退。
3. normal 使用过期 slot 调 `consume`，返回 `expired`。
4. normal 重复提交同 slot，返回 `duplicate`。
5. normal 对未报名活动提交，返回 `forbidden`。
6. checkout 但未先签到，返回 `forbidden`。
7. completed 活动上执行签到/签退，返回 `forbidden`。

---

## 8. 版本记录
- 2026-02-08 v3.0：重构全文结构，按后端实现视角重写；明确二维码前端本地生成，后端仅返回配置并执行业务校验。
