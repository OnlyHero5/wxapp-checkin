# 微信小程序活动二维码签到功能说明书

文档版本: v1.4  
状态: 进行中  
更新日期: 2026-02-08  
项目: wxapp-checkin  
依据: `docs/REQUIREMENTS.md`、`docs/API_SPEC.md`

## 1. 目的
本文档描述当前版本小程序的页面行为、角色能力、接口协作和异常处理，用于产品确认、后端联调和测试验收。

## 2. 目标与非目标
目标:
- 登录后基于 `role` 分流前端能力（普通用户/工作人员）
- 活动页采用“正在进行/已完成”双分组卡片模型
- 已完成活动仅支持查看详情，不可签到签退
- 工作人员展示动态二维码（签到/签退）并自动轮换
- 普通用户在独立“签到/签退”页面扫码提交
- 个人中心展示用户资料与普通用户积分（社会分/讲座分）

非目标:
- 后台活动创建、审批、权限配置 UI
- 当前版本独立“签到记录页/详情页”交互入口

## 3. 角色定义
- `normal`：普通用户
- `staff`：有权限工作人员

角色来源:
- `POST /api/auth/wx-login` 返回 `role` 与 `permissions`

## 4. 页面与功能模块

### 4.1 活动页（`pages/index`）
共同能力:
- 拉取活动卡片列表并按规则分组:
  - 上: `正在进行`
  - 下: `已完成`
- 两组均按 `start_time` 倒序（新的在上）
- 展示活动标题、类型、时间、地点
- 支持进入活动详情（`has_detail=true`）

普通用户:
- 不显示签到/签退按钮
- 仅展示“已报名/已签到/已签退”的活动（`my_registered=true` 或 `my_checked_in=true` 或 `my_checked_out=true`）
- 显示“我的状态”（`已报名`/`已签到`/`已签退`）
- 可点击“去扫码”进入 `pages/scan-action`

工作人员:
- 仅在“正在进行”分组显示“签到码”按钮
- 仅在“正在进行”且 `support_checkout=true` 时显示“签退码”按钮
- 显示总签到人数（`checkin_count`）
- 点击按钮后跳转 `pages/staff-qr` 展示动态二维码

关键业务规则:
- 已完成活动仅支持详情查看（前端与后端均有保护）

### 4.2 活动详情页（`pages/activity-detail`）
- 展示活动完整信息：名称、类型、开始时间、地点、已签到人数、描述
- 普通用户仅可查看“已报名/已签到/已签退”活动详情，违规访问返回 `forbidden`
- 无网时显示顶部提示，不阻塞页面查看

### 4.3 扫码提交页（`pages/scan-action`）
- 页面标题：`签到/签退`
- 仅普通用户可提交扫码动作（工作人员显示提示并禁用按钮）
- 点击“扫码签到/签退”调用摄像头 `wx.scanCode`
- 扫码后调用 `POST /api/checkin/consume`
- 成功或失败均展示结果卡（活动名、动作、结果、时间）
- 支持返回活动页查看“我的状态”更新

### 4.4 管理员二维码页（`pages/staff-qr`）
- 来源：活动页工作人员点击“签到码/签退码”
- 显示二维码、倒计时、“本码剩余秒数”和“提交宽限秒数”
- 默认每 10 秒自动换新二维码，支持手动刷新
- 默认宽限 20 秒，宽限期内普通用户提交仍可成功
- 每 3 秒轮询活动详情，实时刷新已签到/已签退人数

### 4.5 个人中心页（`pages/profile`）
共同能力:
- 展示姓名、学号、学院/部门、社团/组织、账号绑定状态
- 提供“去绑定/重新绑定”入口

普通用户:
- 展示成长积分卡：`社会分`、`讲座分`
- 不展示“曾参加活动”模块

工作人员:
- 展示“进入活动页”快捷按钮

### 4.6 注册绑定页（`pages/register`）
- 展示微信身份识别状态
- 输入学号、姓名、学院/部门、社团/组织
- 调用注册接口成功后更新本地绑定状态并按角色跳转

## 5. 关键流程

### 5.1 登录初始化流程
1. 页面调用 `auth.ensureSession`
2. 前端执行 `wx.login`，请求 `POST /api/auth/wx-login`
3. 缓存 `session_token/role/permissions/user_profile`
4. 页面继续拉取业务数据

### 5.2 工作人员动态二维码流程
1. 在“正在进行”卡片点击 `签到` 或 `签退`
2. 跳转二维码页，调用 `POST /api/staff/activities/{id}/qr-session` 获取换码配置与服务端时间
3. 前端本地生成二维码 payload 并展示倒计时（10 秒轮换）
4. 倒计时结束前端本地换码；二维码页实时更新人数统计

### 5.3 普通用户扫码提交流程
1. 进入 `pages/scan-action` 并点击“扫码签到/签退”
2. 调用摄像头扫码，提取二维码 payload
3. 调用 `POST /api/checkin/consume`
4. 成功后显示反馈，活动页“我的状态”更新为 `已签到/已签退`
5. 若超时返回 `expired`，提示重新扫码

### 5.4 普通用户活动浏览流程
1. 拉取活动列表
2. 后端按 `my_registered || my_checked_in || my_checked_out` 过滤后返回活动
3. 前端按同规则兜底过滤并展示“我的状态”
4. 仅在可见活动上允许进入详情

### 5.5 注册绑定流程
1. 填写表单并提交
2. 调用 `POST /api/register`
3. 成功后更新缓存并跳转:
   - `staff` -> 活动 tab
   - `normal` -> 我的 tab

## 6. API 协作要求（字段级）

### 6.1 登录接口
- `POST /api/auth/wx-login`
- 必需字段:
  - `session_token`
  - `role`
  - `permissions`
  - `user_profile.student_id/name/department/club/avatar_url`
  - `user_profile.social_score/lecture_score`

### 6.2 活动列表接口
- `GET /api/staff/activities`
- 必需字段:
  - `activities[].activity_id`
  - `activities[].activity_title`
  - `activities[].activity_type`
  - `activities[].start_time`
  - `activities[].location`
  - `activities[].has_detail`
  - `activities[].support_checkout`
  - `activities[].checkin_count`
  - `activities[].checkout_count`
  - `activities[].my_registered`
  - `activities[].my_checked_in`
  - `activities[].my_checked_out`
  - `activities[].progress_status`（建议必传，避免前端时间推断）

### 6.3 管理员二维码会话接口
- `POST /api/staff/activities/{activity_id}/qr-session`
- 必需字段:
  - 入参 `action_type`（`checkin/checkout`）
  - 入参 `rotate_seconds`（默认 10）
  - 入参 `grace_seconds`（默认 20）
  - 出参 `rotate_seconds`、`grace_seconds`、`server_time`
- 推荐错误状态:
  - `forbidden`
  - `invalid_activity`

### 6.4 普通用户扫码提交接口
- `POST /api/checkin/consume`
- 必需字段:
  - 入参 `qr_payload`（或 `path/raw_result`），推荐同时传 `activity_id/action_type/slot/nonce`
  - 出参 `status`、`message`、`action_type`
  - 出参 `checkin_record_id`、`in_grace_window`
- 推荐错误状态:
  - `invalid_qr`
  - `expired`
  - `forbidden`
  - `invalid_activity`

### 6.5 活动详情接口
- `GET /api/staff/activities/{activity_id}`
- 必需字段:
  - `activity_title/activity_type/start_time/location/checkin_count/checkout_count/description`
- 普通用户访问控制:
  - 可见活动：返回详情
  - 不可见活动：返回 `status=forbidden` + message

### 6.6 保留兼容接口（当前 UI 未直接使用）
- `POST /api/checkin/verify`
- `GET /api/checkin/records`
- `GET /api/checkin/records/{record_id}`
- `GET /api/activity/current`

## 7. 异常处理
- 无网络:
  - 活动页阻止关键动作
  - 扫码页阻止提交动作
  - 详情页显示“可能不是最新”提示
- `invalid_qr`: 提示二维码失效
- `expired`: 提示二维码已过期，需重新扫码
- `forbidden`: 提示无权限或当前活动状态不允许操作
- 其他异常: 统一提示重试

## 8. 验收要点
- 活动页必须是双分组 + 组内时间倒序
- `已完成` 分组活动仅保留详情，不允许签到/签退
- 普通用户活动卡片仅显示“已报名/已签到/已签退”活动，不显示总人数
- 工作人员二维码页显示剩余秒数，且每 10 秒自动换码
- 普通用户宽限期（20 秒）内提交成功，超时返回过期
- 普通用户活动详情禁止越权查看（未报名未参加活动）
- 工作人员活动卡片显示 `checkin_count`
- 普通用户“我的”页显示积分，不显示“曾参加活动”模块

## 9. 更新记录
- 2026-02-04：完成 TDesign 化与深色主题升级。
- 2026-02-06：切换角色分流活动卡片模型，新增普通用户积分与“我的签到状态”。
- 2026-02-07：活动页升级为双分组模型；已完成活动仅详情；同步 API 协作规则。
- 2026-02-08：普通用户活动可见范围收敛为“已报名/已签到/已签退”，并补齐详情接口鉴权规则。
- 2026-02-08：新增管理员动态二维码与普通用户扫码提交链路（10 秒轮换 + 20 秒宽限）。
