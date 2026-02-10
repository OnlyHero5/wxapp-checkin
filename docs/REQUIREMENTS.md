# 微信小程序活动二维码签到需求文档

文档版本: v1.6  
状态: 持续迭代  
更新日期: 2026-02-09  
项目: wxapp-checkin

## 1. 背景与目标
项目为“微信小程序前端 + Java 后端”一体化实现，目标是在校园活动场景中完成签到/签退闭环：
- 登录与注册绑定
- 角色分流（普通用户/工作人员）
- 动态二维码展示与扫码提交
- 活动可见性与权限控制
- 新旧库扩展与同步（不破坏原有库结构）

## 2. 范围
范围内:
- 小程序页面与交互
- 前后端 API 契约
- 错误状态提示与重试
- Java 后端服务与扩展库表（`wx_*`）
- 同步任务（旧库 -> 新库投影、新库 outbox -> 旧库回写）
- Linux 服务器部署与运行脚本

范围外:
- 后台管理系统
- 复杂多集群运维编排（Kubernetes、Service Mesh）

## 3. 角色
- `normal` 普通用户
- `staff` 工作人员

## 4. 约束与假设
- 运行环境: 微信小程序
- 后端部署目标: Linux 服务器（Windows 仅开发环境）
- 默认二维码周期: 10 秒展示 + 20 秒宽限
- 网络异常时禁止关键动作并提示
- 当前仓库默认 mock 模式（`frontend/utils/config.js` 的 `mock=true`）

## 5. 业务流程
流程 A: 登录初始化  
`wx.login -> /api/auth/wx-login`，获取会话与角色。

流程 B: 注册绑定  
提交学号与姓名，按管理员名册返回最终角色。

流程 C: 活动浏览与动作  
活动分组展示；工作人员进二维码页；普通用户扫码提交。

流程 D: 活动详情  
用户按权限查看活动详情。

## 6. 功能需求

### 6.1 登录与会话
- FR-001 前端需通过微信登录换取 `session_token`
- FR-002 登录返回 `role` 与 `permissions`
- FR-003 登录返回 `user_profile`（含积分字段）
- FR-004 会话失效时（`forbidden + error_code=session_expired`）前端必须清理登录态并跳登录页重登

### 6.2 注册绑定
- FR-005 学号、姓名必填
- FR-006 绑定成功后更新本地资料与绑定状态
- FR-007 后端按 `student_id + name` 查询管理员名册
- FR-008 命中管理员名册返回 `staff`，未命中返回 `normal`
- FR-009 同一学号姓名不可重复绑定多个微信
- FR-010 同一微信不可绑定多个学号姓名

### 6.3 活动页
- FR-011 活动分组: `正在进行`、`已完成`
- FR-012 组内按 `start_time` 倒序
- FR-013 普通用户仅展示 `my_registered || my_checked_in || my_checked_out`
- FR-014 普通用户显示“我的状态”（已报名/已签到/已签退）
- FR-015 工作人员进行中活动可见“签到码”
- FR-016 工作人员在 `support_checkout=true` 时可见“签退码”
- FR-017 已完成活动不允许签到/签退

### 6.4 动态二维码
- FR-018 工作人员进入二维码页后调用 A-05 获取 `qr_payload`
- FR-019 二维码页按 `display_expire_at/accept_expire_at` 展示倒计时
- FR-020 展示窗口结束后，宽限期内仍允许提交
- FR-021 支持手动刷新二维码
- FR-022 二维码页每 3 秒刷新活动统计（签到/签退人数）

### 6.5 普通用户扫码提交
- FR-023 提供独立扫码页面
- FR-024 调用摄像头扫码并提交 A-06
- FR-025 成功/失败均提供明确反馈
- FR-026 状态更新后能在活动页看到“我的状态”变化

### 6.6 活动详情
- FR-027 展示活动标题、类型、时间、地点、人数、描述
- FR-028 普通用户不可越权查看无关活动
- FR-029 无网时提示“当前无网络”

### 6.7 个人中心
- FR-030 展示姓名、学号、院系、社团、绑定状态
- FR-031 普通用户显示 `social_score`、`lecture_score`
- FR-032 工作人员支持快捷回活动页

### 6.8 后端与数据同步
- FR-033 在不修改旧表主结构前提下，通过扩展表实现微信身份、会话、二维码和事件模型
- FR-034 扩展用户表需支持 `wx_token` 字段（`VARCHAR(255)`）
- FR-035 通过配置开关控制同步任务启停（`LEGACY_SYNC_ENABLED`、`OUTBOX_RELAY_ENABLED`）
- FR-036 后端需保留兼容接口，避免前端历史调用在联调期中断

## 7. 非功能需求
- NFR-001 二维码倒计时刷新应平滑
- NFR-002 扫码提交有 loading 和结果反馈
- NFR-003 错误提示可读、可定位
- NFR-004 通信使用 HTTPS（mock 模式除外）
- NFR-005 后端需支持 Linux 原生运行与容器化部署
- NFR-006 前后端应具备可执行自动化测试入口

## 8. API 需求（主链路）

### 8.1 必需接口
- `POST /api/auth/wx-login`
- `POST /api/register`
- `GET /api/staff/activities`
- `GET /api/staff/activities/{activity_id}`
- `POST /api/staff/activities/{activity_id}/qr-session`
- `POST /api/checkin/consume`
- `POST /api/checkin/verify`（兼容）
- `GET /api/checkin/records`（兼容）
- `GET /api/checkin/records/{record_id}`（兼容）
- `GET /api/activity/current`（兼容）
- `POST /api/staff/activity-action`（兼容）

### 8.2 关键字段
- 登录: `session_token`, `role`, `permissions`, `user_profile.*`
- 注册: `role`, `permissions`, `admin_verified`, `is_registered`
- 活动列表/详情: `progress_status`, `my_*`, `checkin_count`, `checkout_count`
- 二维码会话: `qr_payload`, `display_expire_at`, `accept_expire_at`, `server_time`, `rotate_seconds`, `grace_seconds`
- 扫码提交: `status`, `message`, `action_type`, `checkin_record_id`, `in_grace_window`
- 会话失效: `status=forbidden`, `error_code=session_expired`

## 9. 验收标准
- 活动分组、排序、权限展示正确
- 已完成活动仅可看详情
- 二维码页使用 A-05 返回 payload 展示并自动轮换
- 普通用户宽限期内提交成功，超时返回 `expired`
- 普通用户不可越权查看无关活动详情
- 会话失效触发登录页重登流程
- 前端 `npm test` 能执行全部前端测试并通过
- 后端 `mvn test` 能通过，且主链路接口可联调

## 10. 更新记录
- 2026-02-09：升级为前后端一体化需求口径，纳入 Java 后端、扩展表与同步任务、Linux 部署要求。
- 2026-02-09：删除与当前实现不一致的“前端本地组码”口径，统一为 A-05 返回二维码 payload。
- 2026-02-08：新增会话失效标准信号与登录页重登。
- 2026-02-08：普通用户活动可见性收敛。
- 2026-02-08：注册绑定增加管理员名册判定。
