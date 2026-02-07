# 后端接口说明（前端联调版）

文档版本: v2.0  
更新日期: 2026-02-07  
对应前端分支: `main`（当前工作区）  
代码对齐基线: `src/utils/api.js`、`src/pages/*`

> 目标：让后端开发与测试同学可以“看接口文档就知道前端哪里会用到、会怎么显示、出错时怎么提示”。

---

## 1. 当前前端页面与接口关系总览

### 1.1 当前线上页面（`src/app.json`）
- `pages/index/index`：活动页（分组展示 + 工作人员扫码动作）
- `pages/activity-detail/activity-detail`：活动详情页
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
| `GET /api/staff/activities` | `api.getStaffActivities` | `index` 页进入/回到前台时拉取 | 分组为“正在进行/已完成”，按时间倒序渲染卡片 | Toast：`活动信息加载失败` |
| `POST /api/staff/activity-action` | `api.staffActivityAction` | `index` 页工作人员点击“签到/签退”并扫码后 | Toast 成功 + 显示状态卡 + 刷新列表 | Toast：后端 message（如二维码失效、活动已完成） |
| `GET /api/staff/activities/{id}` | `api.getStaffActivityDetail` | `activity-detail` 页 onLoad/onShow | 展示活动详情字段（名称/类型/时间/地点/人数/描述） | Toast：`活动详情加载失败` |
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
  "session_token": "string"
}
```

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
      "support_checkout": false,
      "has_detail": true,
      "progress_status": "ongoing",
      "description": "string",
      "my_checked_in": false
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
| `my_checked_in` | 普通用户视角状态 | `我的签到: 已签到/未签到` |
| `support_checkout` | 控制签退按钮显示 | 进行中且 staff 时才生效 |
| `has_detail` | 控制详情按钮显示 | 任意分组可显示 |
| `progress_status` | 分组依据 | ongoing / completed |

### 关键前端规则（后端必须知晓）
1. 分组顺序固定: `正在进行` 在上，`已完成` 在下。
2. 组内排序: `start_time` 倒序（新的在上）。
3. 按钮规则:
   - `staff + ongoing`：显示签到
   - `staff + ongoing + support_checkout=true`：显示签退
   - 任意角色 + `has_detail=true`：显示详情
   - `completed` 活动不允许签到/签退

### 建议后端返回
- 建议总是返回 `progress_status`，避免时间推断误差。

### 失败表现
- 请求异常: Toast `活动信息加载失败`

---

## 4.4 工作人员动作（签到/签退）
**POST** `/api/staff/activity-action`

### 前端触发位置
- 页面: `src/pages/index/index`
- 流程: 点击按钮 -> `wx.scanCode` -> 调用接口

### 请求
```json
{
  "session_token": "string",
  "activity_id": "string",
  "action_type": "checkin",
  "qr_token": "string"
}
```

`action_type` 取值:
- `checkin`
- `checkout`

### 前端发起前本地拦截
- 无网络: 不发请求，Toast `当前无网络`
- 活动不存在: 不发请求，Toast `活动信息不存在`
- 活动已完成: 不发请求，Toast `已完成活动仅支持查看详情`
- 签退但 `support_checkout=false`: 不发请求，Toast `该活动暂不支持签退`

### 成功响应
```json
{
  "status": "success",
  "message": "签到成功",
  "checkin_record_id": "rec_xxx"
}
```

### 成功后前端呈现
1. Toast: `message` 或默认成功文案
2. 状态卡更新（页面底部）:
   - 标题: `{activity_title} 签到成功/签退成功`
   - 副文案: `message`
   - 记录号: `checkin_record_id`
3. 自动刷新活动列表（重新调用 `/api/staff/activities`）

### 失败状态建议与前端表现
| `status` | 推荐 message | 前端表现 |
|----------|--------------|----------|
| `invalid_qr` | 二维码失效，请重新扫码 | Toast message |
| `forbidden` | 该活动未开放签退 / 已完成活动仅支持查看详情 | Toast message |
| `invalid_activity` | 活动不存在或已下线 | Toast message |
| 其他或空 | 任意 | Toast `操作失败` |

---

## 4.5 活动详情
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
  "support_checkout": false,
  "has_detail": true,
  "progress_status": "ongoing",
  "description": "院系联合路演，含评审打分环节。"
}
```

### 前端显示映射
- `activity_title` -> 活动名称
- `activity_type` -> 类型 tag
- `start_time` -> 开始时间
- `location` -> 活动地点
- `checkin_count` -> 已签到人数
- `description` -> 详情描述

### 失败表现
- 请求异常: Toast `活动详情加载失败`
- 无网: 页面顶部 banner 提示“当前无网络，活动详情可能不是最新”

---

## 5. 当前版本未接入 UI 的保留接口

以下接口在 `src/utils/api.js` 仍保留封装，但当前路由页面未直接调用：

## 5.1 扫码验证（旧能力）
- `POST /api/checkin/verify`

## 5.2 记录列表与详情（旧能力）
- `GET /api/checkin/records`
- `GET /api/checkin/records/{record_id}`

## 5.3 当前活动信息（兼容）
- `GET /api/activity/current`

> 建议：后端可继续保留，便于未来恢复“记录页”或兼容旧端；但当前主验收链路不依赖这些接口。

---

## 6. 联调测试清单（后端/测试可直接照测）

1. `staff` 登录 + 已绑定
- 预期：活动页出现“签到/签退/详情”（按字段控制）
- 定位页：`pages/index/index`

2. `normal` 登录 + 已绑定
- 预期：活动页仅详情，不显示签到/签退；显示“我的签到状态”
- 定位页：`pages/index/index`

3. 返回 `progress_status=completed`
- 预期：卡片进入“已完成”分组，且只显示详情
- 定位页：`pages/index/index`

4. `staff` 对 ongoing 活动签到成功
- 预期：Toast 成功 + 底部状态卡出现记录号 + 列表刷新
- 定位页：`pages/index/index`

5. `staff` 对 completed 活动发动作
- 预期：前后端均拒绝，Toast `已完成活动仅支持查看详情`
- 定位页：`pages/index/index`

6. 活动详情接口返回完整字段
- 预期：详情页字段全部展示
- 定位页：`pages/activity-detail/activity-detail`

7. 注册接口返回成功
- 预期：`has_bound` 置为 true，按角色跳转 tab
- 定位页：`pages/register/register`

---

## 7. 版本记录
- 2026-02-04：初版接口说明
- 2026-02-06：补充角色分流字段
- 2026-02-07：重写为“前端联调版”，新增接口到页面功能的逐项映射、按钮规则、分组规则、排障与测试清单
