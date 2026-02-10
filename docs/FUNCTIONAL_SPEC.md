# 微信小程序活动二维码签到功能说明书

文档版本: v1.7  
状态: 进行中  
更新日期: 2026-02-09  
项目: wxapp-checkin  
依据: `docs/REQUIREMENTS.md`、`docs/API_SPEC.md`

## 1. 目的
本文档描述当前版本小程序的页面行为、角色能力、接口协作和异常处理，用于产品确认、联调与测试验收。

## 2. 当前实现边界
- 当前仓库为前后端一体结构：`frontend/`（小程序）+ `backend/`（Java Spring Boot）。
- 默认运行模式为 mock（`frontend/utils/config.js` 中 `mock=true`）。
- 当前仓库已包含独立 `backend/` 服务目录（Java Spring Boot）。
- 二维码页面不再本地拼装 payload，统一调用 A-05 获取 `qr_payload` 后展示。

## 3. 角色定义
- `normal`：普通用户
- `staff`：工作人员

角色来源:
- `POST /api/auth/wx-login` 返回 `role` 与 `permissions`
- `POST /api/register` 基于 `student_id + name` 命中管理员名册后返回最终角色

## 4. 页面与功能

### 4.1 活动页（`pages/index`）
共同能力:
- 活动按 `progress_status` 分组展示：`正在进行`、`已完成`
- 两组均按 `start_time` 倒序
- 支持进入详情页（`has_detail=true`）

普通用户:
- 仅展示 `my_registered || my_checked_in || my_checked_out` 的活动
- 显示“我的状态”（已报名/已签到/已签退）
- 可点击“去扫码”跳转 `pages/scan-action`

工作人员:
- 进行中活动显示“签到码”
- `support_checkout=true` 时显示“签退码”
- 显示统计字段 `checkin_count`
- 点击后跳转 `pages/staff-qr`

规则:
- 已完成活动仅允许查看详情，不允许签到/签退

### 4.2 活动详情页（`pages/activity-detail`）
- 展示活动基础信息与人数
- 普通用户访问未授权活动时返回上一页并提示
- 无网时显示提示，不触发接口请求

### 4.3 扫码页（`pages/scan-action`）
- 仅普通用户允许提交扫码动作
- 调用 `wx.scanCode` 扫码
- 以 `qr_payload` 为主提交到 `POST /api/checkin/consume`
- 展示结果卡（状态、动作、活动、提交时间）

### 4.4 工作人员二维码页（`pages/staff-qr`）
- 页面打开时调用 `POST /api/staff/activities/{id}/qr-session`
- 使用接口返回的 `qr_payload` 渲染二维码
- 使用 `display_expire_at`、`accept_expire_at` 展示倒计时
- 倒计时归零后自动重新请求 A-05 刷新二维码
- 每 3 秒轮询活动详情刷新 `checkin_count`/`checkout_count`

### 4.5 个人中心（`pages/profile`）
共同能力:
- 展示姓名、学号、院系、社团、绑定状态
- 支持跳转注册页重新绑定

普通用户:
- 展示积分：`social_score`、`lecture_score`

工作人员:
- 提供“进入活动页”快捷入口

### 4.6 注册页（`pages/register`）
- 学号、姓名必填
- 成功后写入本地缓存（资料、角色、权限、绑定状态）
- 根据返回角色跳转：
  - `staff` -> 活动 tab
  - `normal` -> 我的 tab

### 4.7 登录页（`pages/login`）
- 会话失效后自动进入登录页
- 自动执行 `wx.login -> /api/auth/wx-login` 重登
- 重登失败提供“重新登录”按钮

## 5. 关键流程

### 5.1 登录初始化
1. 页面调用 `auth.ensureSession`
2. 触发 `wx.login`
3. 请求 `POST /api/auth/wx-login`
4. 缓存 `session_token/role/permissions/user_profile`

### 5.2 会话失效恢复
1. 业务接口返回 `status=forbidden` + `error_code=session_expired`
2. 清理本地登录态
3. `reLaunch` 到 `pages/login`
4. 自动重登成功后回 `pages/index`

### 5.3 工作人员二维码流程
1. 活动页点击签到码/签退码
2. A-05 返回 `qr_payload`、`display_expire_at`、`accept_expire_at`、`server_time`
3. 页面展示二维码与剩余秒数
4. 展示窗口到期后自动请求新二维码

### 5.4 普通用户扫码提交流程
1. 扫码得到 `result/path`
2. 提交到 A-06（`qr_payload` 主字段，`scan_type/raw_result/path` 辅助）
3. 后端返回 `success/duplicate/expired/invalid_qr/forbidden`
4. 页面展示结果卡并可返回活动页查看状态

## 6. API 协作要求（当前代码口径）

### 6.1 A-05 二维码会话接口
- 路径: `POST /api/staff/activities/{activity_id}/qr-session`
- 请求:
  - `session_token`
  - `action_type`（`checkin|checkout`）
- 响应关键字段:
  - `qr_payload`
  - `rotate_seconds`
  - `grace_seconds`
  - `display_expire_at`
  - `accept_expire_at`
  - `server_time`

### 6.2 A-06 扫码消费接口
- 路径: `POST /api/checkin/consume`
- 请求关键字段:
  - `session_token`
  - `qr_payload`（建议必传）
  - `scan_type`、`raw_result`、`path`（辅助）
  - `activity_id/action_type/slot/nonce`（可选冗余字段）
- 响应关键字段:
  - `status`
  - `message`
  - `action_type`
  - `checkin_record_id`
  - `in_grace_window`

### 6.3 兼容接口（当前前端仍保留调用封装）
- `POST /api/checkin/verify`
- `GET /api/checkin/records`
- `GET /api/checkin/records/{record_id}`
- `GET /api/activity/current`
- `POST /api/staff/activity-action`

## 7. 异常处理
- 无网: 阻止关键动作并提示
- `invalid_qr`: 提示二维码失效
- `expired`: 提示二维码过期
- `duplicate`: 提示重复提交
- `forbidden`:
  - 带 `session_expired` -> 走重登流程
  - 其他 -> 提示无权限/状态不允许

## 8. 验收要点
- 活动页分组与排序正确
- 已完成活动仅保留详情
- 普通用户仅可见相关活动
- 二维码页由 A-05 提供 payload 并自动轮换
- 普通用户宽限期内可提交，超时返回过期
- 会话失效自动跳登录页并可重登
- 前端 `npm test` 可执行并通过
- 后端 `mvn test` 可执行并通过

## 9. 更新记录
- 2026-02-09：文档升级为 v1.7，补充兼容接口与前后端自动化测试验收项。
- 2026-02-09：新增 `backend/` Java 后端目录与 Linux 友好部署脚本，文档边界描述同步更新。
- 2026-02-09：二维码链路文档对齐当前实现（A-05 返回 `qr_payload`，二维码页不再前端本地组码）。
- 2026-02-08：新增会话失效重登机制。
- 2026-02-08：普通用户活动可见性收敛为“已报名/已签到/已签退”。
- 2026-02-08：注册绑定新增管理员名册判定。
