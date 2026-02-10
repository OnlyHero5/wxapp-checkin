# Changes Log

## 2026-02-03
- 新增 `frontend/` 下完整微信小程序结构与页面代码（签到、注册、记录、详情）。
- 增加通用样式与极简科技风 UI 视觉方案，包含成功动画与无网提示。
- 增加 API 封装、登录换取会话、数据加密占位实现与本地存储模块。
- 提供 `project.config.json` 便于直接在微信开发者工具打开运行。
- 调整签到页与记录页标题区域，移除英文标识与标题后文案。
- 调整注册绑定页标题区域，移除英文标识与辅助文案。
- 优化全局 UI 风格：背景渐变、卡片质感、按钮交互与列表按压反馈。
- 进一步增强页面层次感：页面背景光晕与卡片渐变质感。
- 使用 frontend-design 思路进行全面布局优化：极简标题、网格背景、结构化信息卡片与更克制的视觉层次。
- 重新切换至 Moonshot 风格的浅色理工审美：纯净底色、细线分隔、低对比层级与克制按钮配色。

思路说明：
- 前端通过 `auth.ensureSession` 统一获取 `session_token`，避免各页重复逻辑。
- API 层提供 mock 模式，确保无后端时也能直接运行和演示流程；上线时将 `frontend/utils/config.js` 的 `mock` 改为 `false` 并配置 `baseUrl`。
- 加密逻辑暂用 Base64 作为占位，后续可替换为后端指定的 AES/RSA 实现。

## 2026-02-04
- 切换至 `tdesign-miniprogram` 作为 UI 组件库，移除 AntD 依赖。
- 签到、记录、详情、注册页全面替换为 TDesign 组件（button/tag/cell/input）。
- 新增“个人中心”页与 TabBar 入口，完善页面结构与导航。
- 更新 `app.json` 页面列表与底部导航配置。
- 将 `package.json`/`package-lock.json` 移入 `frontend/`，以符合 `miniprogramRoot` 的 NPM 构建要求。
- 主题优化为“石墨雾”风格，降低黑白对比，卡片/按钮更柔和。
- 主按钮色调整为深蓝系，并居中呈现。
- 修复主按钮在部分页面未居中的问题（新增统一居中容器）。
- 更新 README：补充 TDesign、构建步骤与发布说明。
- 重新对齐发布标签：`v2026.02.04` 指向最新提交。
- 新增 docs/API_SPEC.md：后端接口说明（统一 code/message/data）。

## 2026-02-06
- 完成角色分流：
  - 普通用户：活动卡片浏览 + 个人信息 + 积分
  - 工作人员：活动卡片操作（签到/签退/详情）+ 个人信息
- 活动页统一卡片化，普通用户展示 `my_checked_in`，工作人员展示 `checkin_count`。
- 个人中心优化：
  - 普通用户显示社会分/讲座分（后端返回）
  - 普通用户隐藏“曾参加活动”卡片
- 新增活动详情页 `frontend/pages/activity-detail/*`
- API 文档升级到角色分流版本（见 `docs/API_SPEC.md`）

## 2026-02-07
- 活动页规则更新：
  - 活动按状态分组：`正在进行` 在上、`已完成` 在下
  - 两组均按活动时间倒序（新的在上）
  - 已完成活动仅保留“详情”按钮，不再允许签到/签退
- 活动页视觉增强：
  - 新增概览统计卡（进行中/已完成数量）
  - 新增活动类型彩色圆角胶囊（如路演/竞赛等）
  - 优化卡片层级与操作区布局
- 页面清理：
  - 删除并下线路由页面 `records`、`record-detail`
  - “我的”页移除“曾参加活动”模块
- 文档体系重写与对齐：
  - `docs/API_SPEC.md` 重写为前端联调版（接口 -> 页面功能 -> UI 呈现 -> 排障）
  - `docs/FUNCTIONAL_SPEC.md`、`docs/REQUIREMENTS.md`、`README.md` 全量同步当前实现

## 2026-02-08
- 会话失效恢复链路上线：
  - 前端新增 `pages/login` 统一重登页，收到会话失效后自动切换并触发 `wx.login`
  - API 层新增会话失效统一识别：`status=forbidden` + `error_code=session_expired`
  - 本地登录态清理统一下沉到 `storage.clearAuthState()`
- 文档口径补齐：
  - `docs/API_SPEC.md` 升级到 v4.4，新增“会话失效信号约定（强制）”
  - `docs/FUNCTIONAL_SPEC.md` 升级到 v1.5，新增登录页与会话失效恢复流程
  - `docs/REQUIREMENTS.md` 升级到 v1.4，新增会话失效强制需求与验收项
  - `README.md` 同步补充会话失效处理闭环
- 普通用户活动可见性收敛：
  - `normal` 仅可见“已报名/已签到/已签退”活动（`my_registered || my_checked_in || my_checked_out`）
  - 未报名且未参加活动不再出现在普通用户活动列表
- 活动详情权限加固：
  - 普通用户访问未报名未参加活动详情时，接口返回 `forbidden`
  - 前端详情页收到 `forbidden` 后提示并返回上一页
- API 字段升级：
  - 活动列表/详情新增并使用 `my_registered`
  - 前端普通用户状态文案统一为“我的状态（已报名/已参加）”
- 文档同步更新：
  - `docs/API_SPEC.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/REQUIREMENTS.md`、`README.md`
- 动态二维码签到/签退链路上线：
  - 新增工作人员二维码页 `frontend/pages/staff-qr/*`（10 秒自动换码、20 秒宽限倒计时、实时人数轮询）
  - 新增普通用户扫码页 `frontend/pages/scan-action/*`（摄像头扫码 + 结果反馈）
  - 活动页工作人员动作改为“签到码/签退码”跳转二维码页；普通用户新增“去扫码”入口
- API 升级：
  - 新增 `POST /api/staff/activities/{activity_id}/qr-session`
  - 新增 `POST /api/checkin/consume`
  - 活动字段补充 `my_checked_out`、`checkout_count`
  - 普通用户状态文案升级为“已报名/已签到/已签退”
- API 文档重构（v3.0）：
  - `docs/API_SPEC.md` 按“后端实现视角”全量重写
  - 重构 4.4/4.5：明确 `qr-session` 只返回配置，`consume` 专注业务校验链路
  - 删除前端实现噪音与历史方案混写，补齐可直接执行的错误码与联调清单
- API 文档深化重构（v4.0）：
  - `docs/API_SPEC.md` 完整覆盖小程序当前主链路 6 个后端 API（A-01~A-06）
  - 每个接口补齐“请求参数逐字段语义 + 后端处理步骤 + 返回字段逐字段语义 + 失败触发条件”
  - 重点重写 4.4/4.5，明确后端可直接落地的鉴权、校验、配置返回与禁止返回内容
  - A-06 增补事务一致性、并发控制、防重放键与状态机约束，提升后端实现可执行性
  - 明确网络层与业务层约定：业务失败建议保持 HTTP 2xx 并通过 `status` 表达
- 注册绑定管理员识别链路补齐：
  - `POST /api/register` 增加“`student_id + name` 命中管理员名册”角色判定
  - 命中管理员名册返回 `role=staff` 与权限集，未命中返回 `role=normal`
  - 注册成功响应新增 `role`、`permissions`、`admin_verified`
  - 注册页成功后立即用后端返回角色刷新本地缓存并按角色跳转页面（staff->活动页，normal->我的）
- API 文档升级到 v4.2：
  - A-02 增加管理员名册查询步骤与管理员命中响应示例
  - A-01 明确“登录默认角色可在注册后归一”
  - README / REQUIREMENTS / FUNCTIONAL_SPEC 同步管理员注册判定口径

## 2026-02-09
- 二维码后端化前端先行改造（本次）：
  - `frontend/pages/staff-qr/staff-qr.js` 收敛为后端签发调用，移除前端主动传 `rotate_seconds/grace_seconds`。
  - `frontend/pages/scan-action/scan-action.js` 改为以扫码原文直传后端为主，减少前端解析与组包逻辑。
  - `frontend/utils/api.js` 对齐后端口径：A-05 mock 补齐 `qr_payload/display_expire_at/accept_expire_at`；A-06 仅按需传冗余字段。
  - `docs/API_SPEC.md` 升级到 v4.5，重写 A-05/A-06 与当前项目行为保持一致。
  - `README.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/REQUIREMENTS.md` 删除与当前项目不一致描述。
  - 删除与当前实现冲突的二维码方案文档：`docs/plans/2026-02-08-qr-frontend-first-plan.md`、`docs/plans/2026-02-08-qr-all-frontend-plan.md`、`docs/plans/2026-02-09-qr-backend-first-implementation-plan.md`。
- Java 后端完整交付（本次）：
  - 新增 `backend/` Spring Boot 全量实现，覆盖 A-01~A-06 主链路与兼容接口。
  - 新增扩展库表迁移（`wx_*`）与数据同步能力（旧库拉取 + outbox 回写）。
  - `wx_token` 需求已在扩展用户表中落地：`wx_user_auth_ext.wx_token VARCHAR(255)`。
  - 新增 Linux 优先部署/测试脚本与容器配置（`Dockerfile`、`docker-compose.yml`、`scripts/*.sh`）。
  - 新增 Windows 开发辅助脚本（`scripts/*.ps1`）。
  - 前端目录重构：`src/` -> `frontend/`；`project.config.json` 同步更新。
  - 前端测试入口修正：`frontend/package.json` 的 `npm test` 现可执行 5 个真实测试脚本。
