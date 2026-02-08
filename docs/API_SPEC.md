# 后端接口说明（前端联调版）

文档版本: v2.3  
更新日期: 2026-02-08  
对应前端分支: `main`（当前工作区）  
代码对齐基线: `src/utils/api.js`、`src/pages/*`

> 目标：让后端开发与测试同学可以“看接口文档就知道前端哪里会用到、会怎么显示、出错时怎么提示”。

---

## 1. 当前前端页面与接口关系总览

### 1.1 当前线上页面（`src/app.json`）
- `pages/index/index`：活动页（分组展示 + 角色分流入口）
- `pages/activity-detail/activity-detail`：活动详情页
- `pages/scan-action/scan-action`：普通用户扫码提交页
- `pages/staff-qr/staff-qr`：工作人员动态二维码页
- `pages/profile/profile`：个人信息与积分页
- `pages/register/register`：注册绑定页

### 1.2 已下线页面
以下页面已从路由移除，不再作为当前版本验收入口：
- `pages/records/records`
- `pages/record-detail/record-detail`

---

## 2. 接口到前端功能快速映射（最重要）

| 接口 | 前端调用函数 | 触发页面/操作 | 成功时前端表现 | 失败时前端表现 |
|------|--------------|---------------|----------------|----------------|
| `POST /api/auth/wx-login` | `api.login` -> `auth.ensureSession` | `index/profile/register/activity-detail` 页面初始化 | 写入 `session_token/role/permissions/user_profile`，页面继续加载 | Toast：`登录失败，请重试` |
| `POST /api/register` | `api.register` | `register` 页点击“完成绑定” | Toast：`绑定成功`，写本地缓存，按角色跳转 tab | Toast：`绑定失败` 或后端 message |
| `GET /api/staff/activities` | `api.getStaffActivities` | `index` 页进入/回到前台时拉取 | 分组为“正在进行/已完成”，按时间倒序渲染卡片；普通用户仅收到“已报名/已签到/已签退”活动 | Toast：`活动信息加载失败` |
| `POST /api/staff/activities/{id}/qr-session` | `api.createStaffQrSession` | `staff-qr` 页生成签到/签退码 | 返回二维码 payload + 过期时间，页面倒计时并自动换码 | Toast：后端 message（如活动已完成/权限不足） |
| `POST /api/checkin/consume` | `api.consumeCheckinAction` | `scan-action` 页普通用户扫码提交 | Toast + 结果卡；成功后活动页状态同步为已签到/已签退 | Toast：后端 message（如二维码过期/无权限） |
| `GET /api/staff/activities/{id}` | `api.getStaffActivityDetail` | `activity-detail` 页 onLoad/onShow | 展示活动详情字段（名称/类型/时间/地点/人数/描述）；普通用户显示“我的状态” | Toast：`活动详情加载失败`，或无权限提示并返回上一页 |
| `POST /api/staff/activity-action` | `api.staffActivityAction` | 当前版本 UI 未直接使用（兼容保留） | N/A | N/A |
| `POST /api/checkin/verify` | `api.verifyCheckin` | 当前版本 UI 未直接使用（历史能力保留） | N/A | N/A |
| `GET /api/checkin/records` | `api.getRecords` | 当前版本 UI 未直接使用（历史能力保留） | N/A | N/A |
| `GET /api/checkin/records/{id}` | `api.getRecordDetail` | 当前版本 UI 未直接使用（历史能力保留） | N/A | N/A |
| `GET /api/activity/current` | `api.getActivityCurrent` | 当前版本 UI 未直接使用（兼容接口保留） | N/A | N/A |

---

## 3. 通用对接约定

### 3.1 网络与请求
- Base URL: `src/utils/config.js` -> `baseUrl`
- 请求头: `content-type: application/json`
- 协议: HTTPS
- 会话字段: `session_token`

### 3.2 响应结构约定
当前前端**直接读取响应体顶层字段**（不是 `data.xxx`）。

即当前期望：
```json
{
  "status": "success",
  "message": "...",
  "activities": []
}
```

如果后端使用统一包裹结构（例如 `code/message/data`），需前端先加解包适配。

### 3.3 时间字段约定
- 活动时间字段: `start_time`
- 建议格式: `YYYY-MM-DD HH:mm`
- 前端会做时间解析并按时间倒序排序；无法解析时会降级处理为 `0`（排序靠后）。

### 3.4 活动状态约定
建议后端在活动列表返回：
- `progress_status`: `ongoing | completed`

前端行为：
- 优先使用 `progress_status`（或兼容 `activity_status`）
- 若都不存在，前端会根据 `start_time` 与当前时间推断分组

---

## 4. 详细接口说明（逐接口到页面）

## 4.1 微信登录换会话
**POST** `/api/auth/wx-login`

### 前端触发位置
- 文件: `src/utils/auth.js` -> `ensureSession`
- 页面入口:
  - `src/pages/index/index.js` -> `init()`
  - `src/pages/profile/profile.js` -> `init()`
  - `src/pages/register/register.js` -> `init()`
  - `src/pages/activity-detail/activity-detail.js` -> `init()`
  - `src/pages/scan-action/scan-action.js` -> `init()`
  - `src/pages/staff-qr/staff-qr.js` -> `init()`

### 请求
```json
{
  "wx_login_code": "string"
}
```

`wx_login_code` 来源: `wx.login().code`

### 响应（顶层）
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

### 字段如何映射到前端呈现
| 响应字段 | 存储位置 | 被哪个页面使用 |
|----------|----------|----------------|
| `session_token` | `storage.session_token` | 所有后续接口 |
| `wx_identity` | `storage.wx_identity` | `register` 页显示“已识别/未获取” |
| `role` | `storage.user_role` | `index/profile/register` 的角色分支 |
| `permissions` | `storage.permissions` | 当前主要用于保留扩展 |
| `user_profile.student_id/name` | `storage.student_id/name` | `profile`、`register` 预填 |
| `user_profile.department/club/avatar_url` | 对应 storage 键 | `profile` 展示 |
| `user_profile.social_score/lecture_score` | 对应 storage 键 | `profile` 普通用户积分卡 |

### 前端异常表现
- 登录失败（请求异常或无 `session_token`）: Toast `登录失败，请重试`

---

## 4.2 注册绑定
**POST** `/api/register`

### 前端触发位置
- 页面: `src/pages/register/register`
- 函数: `onSubmit()`
- 触发动作: 点击按钮“完成绑定”

### 请求
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

### 请求字段来源
| 字段 | 来源 |
|------|------|
| `session_token` | `auth.ensureSession()` 获取并缓存 |
| `student_id/name/department/club` | `register` 页输入框 |
| `payload_encrypted` | 前端将 `wx_identity + 学号姓名 + timestamp` 加密得到 |

### 响应
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

### 成功后前端动作
1. 更新本地 `student_id/name/department/club`
2. `setBound(true)`
3. Toast `绑定成功`
4. 跳转:
   - `staff` -> `switchTab('/pages/index/index')`
   - `normal` -> `switchTab('/pages/profile/profile')`

### 失败表现
- `status != success`: Toast `message`
- 请求异常: Toast `绑定失败，请重试`

---

## 4.3 活动列表
**GET** `/api/staff/activities`

### 前端触发位置
- 页面: `src/pages/index/index`
- 函数: `loadActivities()`
- 时机: 页面初始化、切回前台、动作成功后刷新

### 请求
```json
{
  "session_token": "string",
  "role_hint": "normal",
  "visibility_scope": "joined_or_participated"
}
```

说明：
- `role_hint` 为前端传递的角色提示字段（后端应以会话鉴权结果为准）。
- `visibility_scope` 推荐值：
  - `normal`：`joined_or_participated`
  - `staff`：`all`

### 响应
```json
{
  "activities": [
    {
      "activity_id": "act_xxx",
      "activity_title": "科研成果路演",
      "activity_type": "路演",
      "start_time": "2026-02-20 14:00",
      "location": "学术报告厅",
      "checkin_count": 12,
      "checkout_count": 3,
      "support_checkout": false,
      "has_detail": true,
      "progress_status": "ongoing",
      "description": "string",
      "my_registered": true,
      "my_checked_in": false,
      "my_checked_out": false
    }
  ]
}
```

### 字段和前端 UI 的精确关系
| 字段 | 前端用途 | 前端展示位置 |
|------|----------|--------------|
| `activity_id` | 动作与详情路由主键 | 按钮 `data-id` |
| `activity_title` | 卡片主标题 | 活动卡片标题 |
| `activity_type` | 类型胶囊文案 | 彩色圆角胶囊 |
| `start_time` | 排序 + 展示 | 时间行 |
| `location` | 展示 | 地点行 |
| `checkin_count` | 工作人员视角统计 | `已签到 xx 人` |
| `checkout_count` | 工作人员二维码页统计 | `已签退 xx 人` |
| `my_registered` | 普通用户活动可见性 + 状态 | `我的状态: 已报名/已签到/已签退` |
| `my_checked_in` | 普通用户活动可见性 + 状态 | `我的状态: 已报名/已签到/已签退` |
| `my_checked_out` | 普通用户活动可见性 + 状态 | `我的状态: 已报名/已签到/已签退` |
| `support_checkout` | 控制签退按钮显示 | 进行中且 staff 时才生效 |
| `has_detail` | 控制详情按钮显示 | 任意分组可显示 |
| `progress_status` | 分组依据 | ongoing / completed |

### 关键前端规则（后端必须知晓）
1. 分组顺序固定: `正在进行` 在上，`已完成` 在下。
2. 组内排序: `start_time` 倒序（新的在上）。
3. 普通用户可见性: 仅展示 `my_registered=true` 或 `my_checked_in=true` 或 `my_checked_out=true` 的活动。
4. 按钮规则:
   - `staff + ongoing`：显示签到码
   - `staff + ongoing + support_checkout=true`：显示签退码
   - 任意角色 + `has_detail=true`：显示详情
   - `completed` 活动不允许签到/签退

### 建议后端返回
- 建议总是返回 `progress_status`，避免时间推断误差。

### 失败表现
- 请求异常: Toast `活动信息加载失败`

---

## 4.4 工作人员二维码会话
**POST** `/api/staff/activities/{activity_id}/qr-session`

### 前端触发位置
- 页面: `src/pages/staff-qr/staff-qr`
- 函数: `refreshQrSession()`
- 时机:
  - 页面初次进入
  - 倒计时结束（自动换码）
  - 点击“立即刷新”

### 请求
```json
{
  "session_token": "string",
  "action_type": "checkin",
  "rotate_seconds": 10,
  "grace_seconds": 20
}
```

### 响应
```json
{
  "status": "success",
  "session_id": "m6k2abc123",
  "qr_scene": "s.m6k2abc123",
  "qr_payload": "s.m6k2abc123",
  "qr_image_url": "",
  "qr_fallback_path": "/pages/scan-action/scan-action?scene=s.m6k2abc123",
  "rotate_seconds": 10,
  "grace_seconds": 20,
  "display_expire_at": 1770518400000,
  "accept_expire_at": 1770518420000,
  "display_remaining_seconds": 10,
  "accept_remaining_seconds": 30,
  "server_time": 1770518390000
}
```

### 字段与前端行为映射
| 字段 | 前端用途 |
|------|----------|
| `qr_payload` | 生成并展示二维码内容（`t-qrcode`） |
| `qr_image_url` | 后端直接返回图片时优先展示 |
| `display_expire_at` | 显示倒计时“本码剩余” |
| `accept_expire_at` | 显示倒计时“提交宽限” |
| `rotate_seconds/grace_seconds` | 页面提示文案 |
| `server_time` | 校准倒计时与后端时间偏差 |

### 失败状态建议与前端表现
| `status` | 推荐 message | 前端表现 |
|----------|--------------|----------|
| `forbidden` | 仅工作人员可生成二维码 / 已完成活动仅支持查看详情 | Toast message |
| `invalid_activity` | 活动不存在或已下线 | Toast message |
| 其他或空 | 任意 | Toast `二维码生成失败` |

---

## 4.5 普通用户扫码提交
**POST** `/api/checkin/consume`

### 前端触发位置
- 页面: `src/pages/scan-action/scan-action`
- 函数: `consumePayload()`
- 流程: 摄像头扫码 -> 提取 payload -> 提交接口

### 请求
```json
{
  "session_token": "string",
  "qr_payload": "s.m6k2abc123",
  "scan_type": "QR_CODE",
  "raw_result": "s.m6k2abc123",
  "path": ""
}
```

### 成功响应
```json
{
  "status": "success",
  "message": "签到成功",
  "action_type": "checkin",
  "activity_id": "act_xxx",
  "activity_title": "校园 HackDay",
  "checkin_record_id": "rec_1770518401000",
  "in_grace_window": false
}
```

### 成功后前端呈现
1. Toast: `message`
2. 结果卡展示：活动、动作、结果、提交时间
3. 用户返回活动页后，“我的状态”更新为 `已签到` 或 `已签退`

### 失败状态建议与前端表现
| `status` | 推荐 message | 前端表现 |
|----------|--------------|----------|
| `invalid_qr` | 二维码无法识别，请重新扫码 | Toast + 结果卡 |
| `expired` | 二维码已过期，请重新获取 | Toast + 结果卡 |
| `duplicate` | 你已签到，请勿重复提交 | Toast + 结果卡 |
| `forbidden` | 仅普通用户可扫码 / 你未报名该活动 / 请先签到再签退 | Toast + 结果卡 |
| `invalid_activity` | 活动不存在或已下线 | Toast + 结果卡 |
| 其他或空 | 任意 | Toast `提交失败` |

---

## 4.5.1 二维码后端实现规范（按已确认方案：官方小程序码）

> 本节用于补充后端落地细节。前端字段约定不变，仍以 `4.4` 与 `4.5` 的请求/响应为准。

### A. 目标口径（必须满足）
1. 管理员二维码动态轮换：`rotate_seconds = 10`（默认值）。
2. 普通用户扫码提交宽限：`grace_seconds = 20`（默认值）。
3. 宽限期内允许提交成功，并返回 `in_grace_window=true`。
4. 超过 `accept_expire_at` 必须返回 `expired`，避免旧码长期可用。

### B. 官方小程序码生成（推荐主方案）
- 推荐使用微信官方接口：`POST https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=ACCESS_TOKEN`。
- 推荐参数：
  - `page`: `pages/scan-action/scan-action`
  - `scene`: 短 token（建议 Base62，长度 <= 32 可见字符）
  - `check_path`: `false`（当页面路径已固定且可控时）
  - `env_version`: `release/trial/develop`（与当前环境一致）
- `POST /api/staff/activities/{activity_id}/qr-session` 建议优先返回：
  - `qr_image_url`: 官方小程序码图片地址（管理员页优先展示）
  - `qr_payload`: 同步返回 scene token（作为解析兜底）
  - `qr_fallback_path`: `/pages/scan-action/scan-action?scene=...`（调试/兼容）

### C. 推荐数据模型（二维码会话）
| 字段 | 说明 |
|------|------|
| `session_id` | 二维码会话 ID（返回前端） |
| `scene_token` | 写入小程序码 `scene` 的短 token（唯一） |
| `activity_id` | 活动 ID |
| `action_type` | `checkin` / `checkout` |
| `staff_user_id` | 生成二维码的管理员 |
| `display_expire_at` | 展示过期时间（10s） |
| `accept_expire_at` | 提交过期时间（10s + 20s） |
| `rotate_seconds` | 轮换秒数 |
| `grace_seconds` | 宽限秒数 |
| `status` | `active` / `expired` / `disabled` |

存储建议：
- Redis 存会话（按 `scene_token` 查找，TTL 至少覆盖宽限窗口）。
- MySQL/PostgreSQL 存签到记录与审计日志（用于统计与追溯）。

### D. 普通用户扫码提交解析顺序（`POST /api/checkin/consume`）
1. 优先解析 `path` 中的 `scene` 参数（小程序码常见返回）。
2. 其次解析 `raw_result`（兼容二维码原文）。
3. 最后使用 `qr_payload`。
4. 三者都无法解析时返回 `invalid_qr`。

### E. 提交流程建议（服务端判定）
1. 鉴权：会话有效且角色为 `normal`。
2. 解析 `scene_token` 并读取二维码会话。
3. 校验时间窗：
   - `now <= display_expire_at`：正常提交。
   - `display_expire_at < now <= accept_expire_at`：允许提交并返回 `in_grace_window=true`。
   - `now > accept_expire_at`：返回 `expired`。
4. 校验业务规则：是否已报名、是否重复签到、签退前是否已签到等。
5. 写入签到/签退记录并更新活动统计。

### F. 技术栈建议（后端实现）
| 层 | 推荐技术 | 用途 |
|----|----------|------|
| API 服务层 | Node.js（NestJS/Express）或 Java（Spring Boot） | 对外提供鉴权、二维码会话、扫码提交接口 |
| 微信 API 调用层 | 官方 HTTP API 封装（含重试/超时） | 生成官方小程序码 |
| 缓存层 | Redis | `access_token` 缓存、二维码会话 TTL、并发控制 |
| 持久化层 | MySQL/PostgreSQL | 活动表、报名关系、签到记录、审计日志 |
| 对象存储层 | 腾讯云 COS / S3 兼容存储 + CDN | 承载 `qr_image_url` 静态访问 |
| 运维保障 | NTP 时间同步 + 统一日志链路 | 保证倒计时一致性与问题排查 |

### G. `access_token` 管理建议（避免频繁失效）
- 缓存微信 `access_token`，到期前提前刷新（预留安全窗口）。
- 使用分布式锁避免多实例并发刷新造成抖动。
- 微信接口失败时返回明确 `message`，前端提示“二维码生成失败，请稍后重试”。

---

## 4.6 活动详情
**GET** `/api/staff/activities/{activity_id}`

### 前端触发位置
- 页面: `src/pages/activity-detail/activity-detail`
- 触发:
  - 活动页卡片点击“详情”跳转（携带 `id`）
  - 详情页 `onLoad/onShow` 拉取

### 响应
```json
{
  "activity_id": "act_xxx",
  "activity_title": "科研成果路演",
  "activity_type": "路演",
  "start_time": "2026-02-20 14:00",
  "location": "学术报告厅",
  "checkin_count": 0,
  "checkout_count": 0,
  "support_checkout": false,
  "has_detail": true,
  "progress_status": "ongoing",
  "description": "院系联合路演，含评审打分环节。",
  "my_registered": true,
  "my_checked_in": false,
  "my_checked_out": false
}
```

普通用户禁止访问未报名未参加活动时，建议响应：
```json
{
  "status": "forbidden",
  "message": "你未报名或参加该活动，无法查看详情"
}
```

### 前端显示映射
- `activity_title` -> 活动名称
- `activity_type` -> 类型 tag
- `start_time` -> 开始时间
- `location` -> 活动地点
- `checkin_count` -> 已签到人数
- `checkout_count` -> 已签退人数（管理员二维码页统计）
- `description` -> 详情描述
- `my_registered/my_checked_in/my_checked_out` -> 普通用户“我的状态（已报名/已签到/已签退）”

### 失败表现
- 请求异常: Toast `活动详情加载失败`
- `status=forbidden`: Toast message + 返回上一页
- 无网: 页面顶部 banner 提示“当前无网络，活动详情可能不是最新”

---

## 5. 当前版本未接入 UI 的保留接口

以下接口在 `src/utils/api.js` 仍保留封装，但当前路由页面未直接调用：

## 5.1 工作人员直接动作（旧能力）
- `POST /api/staff/activity-action`

## 5.2 扫码验证（旧能力）
- `POST /api/checkin/verify`

## 5.3 记录列表与详情（旧能力）
- `GET /api/checkin/records`
- `GET /api/checkin/records/{record_id}`

## 5.4 当前活动信息（兼容）
- `GET /api/activity/current`

> 建议：后端可继续保留，便于未来恢复“记录页”或兼容旧端；但当前主验收链路不依赖这些接口。

---

## 6. 联调测试清单（后端/测试可直接照测）

1. `staff` 登录 + 已绑定
- 预期：活动页出现“签到码/签退码/详情”（按字段控制）
- 定位页：`pages/index/index`

2. `normal` 登录 + 已绑定
- 预期：活动页仅返回“已报名/已签到/已签退”活动；仅详情，不显示签到/签退；显示“我的状态（已报名/已签到/已签退）”
- 定位页：`pages/index/index`

3. 返回 `progress_status=completed`
- 预期：卡片进入“已完成”分组，且只显示详情
- 定位页：`pages/index/index`

4. `staff` 进入二维码页生成会话
- 预期：显示二维码、倒计时、10 秒自动换码、20 秒宽限文案
- 定位页：`pages/staff-qr/staff-qr`

5. `normal` 扫码提交成功
- 预期：Toast 成功 + 结果卡显示动作与活动名；返回活动页后状态更新
- 定位页：`pages/scan-action/scan-action`

6. `normal` 宽限期提交与超时提交
- 预期：宽限期内 `success` 且 `in_grace_window=true`；超时返回 `expired`
- 定位页：`pages/scan-action/scan-action`

7. `normal` 访问未报名未参加活动详情
- 预期：接口返回 `forbidden`，前端提示并返回上一页
- 定位页：`pages/activity-detail/activity-detail`

8. 活动详情接口返回完整字段
- 预期：详情页字段全部展示
- 定位页：`pages/activity-detail/activity-detail`

9. 注册接口返回成功
- 预期：`has_bound` 置为 true，按角色跳转 tab
- 定位页：`pages/register/register`

---

## 7. 版本记录
- 2026-02-04：初版接口说明
- 2026-02-06：补充角色分流字段
- 2026-02-07：重写为“前端联调版”，新增接口到页面功能的逐项映射、按钮规则、分组规则、排障与测试清单
- 2026-02-08：新增普通用户“已报名/已签到/已签退”可见性约束，补充 `my_registered` 字段与详情鉴权口径
- 2026-02-08：新增管理员动态二维码接口与普通用户扫码提交流程（10 秒轮换 + 20 秒宽限）。
- 2026-02-08：补充二维码后端落地规范（官方小程序码方案、会话模型、时效校验与推荐技术栈）。
