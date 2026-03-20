# 手机 Web 动态验证码签到详细设计说明书

文档版本: v1.0
状态: 现状落点稿
更新日期: 2026-03-10
项目: `wxapp-checkin`
定位: 本文档把当前 Web-only 方案落到仓库里的目录、类、表和测试入口，用于后续维护、排障与局部增强。

补充说明（重要）：

- 2026-03-10 当前仓库已落地 `web/` 与 `/api/web/**` 主链路。
- 文中出现的“建议新增”“后续编码”等措辞，部分保留了当时实施阶段的表达；若与当前仓库状态冲突，以实际代码结构和正式基线为准。

## 1. 设计输入与适用范围

### 1.1 设计输入

- 正式需求基线：`docs/REQUIREMENTS.md`
- 正式功能基线：`docs/FUNCTIONAL_SPEC.md`
- 正式接口基线：`docs/API_SPEC.md`
- 概要复盘：`docs/WEB_OVERVIEW_DESIGN.md`
- 审查结论：`docs/WEB_MIGRATION_REVIEW.md`
- 现有实施计划：`docs/plans/2026-03-10-http-password-auth-implementation-plan.md`

### 1.2 适用范围

- 仅适用于 `wxapp-checkin/` 项目。
- 仅设计手机 Web 目标态。
- 不定义 `suda_union/` 与 `suda-gs-ams/` 的代码改造。

## 2. 目标仓库结构

### 2.1 当前前端结构（对应当时设计落点）

当前仓库已落地的 `web/` 结构如下：

```text
web/
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    app/
      App.tsx
      router.tsx
      styles/base.css
    pages/
      login/LoginPage.tsx
      change-password/ChangePasswordPage.tsx
      activities/ActivitiesPage.tsx
      activity-detail/ActivityDetailPage.tsx
      checkin/CheckinPage.tsx
      checkout/CheckoutPage.tsx
      staff-manage/StaffManagePage.tsx
    features/
      auth/
      activities/
      attendance/
      staff/
    shared/
      http/
      session/
      device/
      ui/
    test/
      setup.ts
```

说明：

- 当前仓库已落地的自动化以 Vitest 单测为主（`web/src/**.test.ts(x)`），并已纳入 `npm test` 与 `npm run build` 的验证闭环。
- `web/tests/*` 级别的 E2E（Playwright）属于建议增强项，当前仓库未默认包含；如需可按本文 10.1 节建议补齐。

### 2.2 后端目标结构

在现有 `backend/` 基础上新增 Web 专属控制器和服务：

```text
backend/src/main/java/com/wxcheckin/backend/
  api/controller/
    WebAuthController.java
    WebActivityController.java
    WebAttendanceController.java
    WebStaffController.java
  api/dto/
    WebAuthLoginRequest.java
    WebAuthLoginResponse.java
    WebAuthChangePasswordRequest.java
    WebAuthChangePasswordResponse.java
    WebCodeConsumeRequest.java
    WebBulkCheckoutRequest.java
    WebBulkCheckoutResponse.java
    WebCodeSessionResponse.java
  application/service/
    WebPasswordAuthService.java
    DynamicCodeService.java
    BulkCheckoutService.java

说明：

- 早期方案曾引入“浏览器唯一绑定 + 解绑审核”，对应的 `web_browser_binding`、`web_unbind_review` 等表仍可能保留在迁移脚本中；
- 当前正式基线已取消浏览器绑定相关防代签逻辑，上述表不再作为业务流程必需依赖。
```

## 3. 前端详细设计

## 3.1 路由设计

| 路由 | 角色 | 目标组件 | 主要职责 |
| --- | --- | --- | --- |
| `/login` | 全部 | `pages/login/LoginPage.tsx` | 账号密码登录入口 |
| `/change-password` | 已登录用户 | `pages/change-password/ChangePasswordPage.tsx` | 首次强制改密入口 |
| `/activities` | 已登录用户 | `pages/activities/ActivitiesPage.tsx` | 活动列表与角色分流 |
| `/activities/:id` | 已登录用户 | `pages/activity-detail/ActivityDetailPage.tsx` | 活动详情与入口跳转 |
| `/activities/:id/checkin` | `normal` | `pages/checkin/CheckinPage.tsx` | 输入签到码 |
| `/activities/:id/checkout` | `normal` | `pages/checkout/CheckoutPage.tsx` | 输入签退码 |
| `/staff/activities/:id/manage` | `staff` | `pages/staff-manage/StaffManagePage.tsx` | 展示动态码、统计、一键全部签退 |

## 3.2 App 壳层与共享层

### 3.2.1 `src/app/App.tsx`

职责：

- 挂载路由。
- 提供全局错误边界与移动端布局容器。
- 挂载全局提示层。

### 3.2.2 `src/app/router.tsx`

职责：

- 定义路由表。
- 在页面级统一处理：
  - 未登录跳转 `/login`
  - 首次强制改密跳转 `/change-password`
  - 非管理员访问管理页跳转 `/activities`

### 3.2.3 `src/shared/http/client.ts`

职责：

- 统一封装 `/api/web/**` 请求。
- 默认附带 `Authorization: Bearer <session_token>`。
- 统一处理：
  - `session_expired`
  - 业务失败 `error_code`
  - 网络异常

### 3.2.4 `src/shared/session/session-store.ts`

职责：

- 读写 `session_token`。
- 提供 `getSession() / setSession() / clearSession()`。
- 允许登录成功后持久化会话，失效时统一清除。

### 3.2.5 能力探测说明（已简化）

职责：

- 账号密码方案不再需要 Passkey/WebAuthn 能力探测，因此已删除 `src/shared/device/browser-capability.ts` 与相关测试。
- 若后续需要做“增强体验”的能力判断（例如 Wake Lock），建议按需在具体页面内做轻量探测，不得作为登录准入门槛。

### 3.2.6 `src/shared/device/page-lifecycle.ts`

职责：

- 包装 `visibilitychange` 监听。
- 提供统一的“回前台后刷新”钩子。

### 3.2.7 `src/shared/ui/MobilePage.tsx`

职责：

- 提供统一的手机宽容器。
- 处理安全区、底部留白与标题区域。

### 3.2.8 不支持提示页（已移除）

说明：

- 账号密码登录不再依赖 Passkey，因此已移除“Passkey 不支持”的专用提示页组件（历史 `UnsupportedBrowser` 已删除）。

## 3.3 `auth` 模块设计

### 3.3.1 文件分工

| 文件 | 职责 |
| --- | --- |
| `features/auth/api.ts` | 账号密码登录与改密接口封装 |
| `features/auth/components/AccountLoginForm.tsx` | 学号 + 密码登录表单 |
| `features/auth/components/ChangePasswordForm.tsx` | 旧密码 + 新密码改密表单 |

### 3.3.2 首次登录与强制改密流程

1. `LoginPage` 渲染 `AccountLoginForm`。
2. 用户提交 `student_id + password`（初始密码默认为 `123`）。
3. `auth/api.ts` 调用 `POST /api/web/auth/login`。
4. 登录成功写入 `session-store`：
   - `session_token` / `role` / `permissions` / `user_profile`
   - `must_change_password`
5. 若 `must_change_password=true`，路由跳转 `/change-password`。
6. `ChangePasswordPage` 调用 `POST /api/web/auth/change-password` 完成改密。
7. 改密成功后更新本地会话上下文并进入 `/activities`。

### 3.3.3 后续登录流程

1. `LoginPage` 展示账号密码表单。
2. 登录成功后若不需要改密，直接进入 `/activities`。

### 3.3.4 异常策略

- `invalid_password`：提示“密码错误”。
- `identity_not_found`：提示“学号不存在，请确认后重试”。
- `password_change_required`：统一跳转 `/change-password`。
- `password_too_short` / `password_too_long`：提示新密码长度不符合要求（沿用后端 message）。
- `session_expired`：统一清除本地会话。

## 3.4 `activities` 与 `attendance` 模块设计

### 3.4.1 活动列表

`features/activities/api.ts` 负责：

- 拉取 `/api/web/activities`
- 拉取 `/api/web/activities/{activity_id}`

`ActivitiesPage` 负责：

- 渲染活动卡片列表。
- 按角色决定是否出现“管理入口”。

### 3.4.2 活动详情

`ActivityDetailPage` 负责：

- 展示活动基本信息、我的状态、当前可执行动作。
- 对普通用户提供“去签到 / 去签退”入口。
- 对管理员提供“去管理”入口。

### 3.4.3 6 位码输入页

`features/attendance/components/CodeInput.tsx` 负责：

- 大号数字输入。
- 输入属性：
  - `inputmode="numeric"`
  - `pattern="[0-9]*"`
  - `enterkeyhint="done"`
- 输入满 6 位后允许提交。

`CheckinPage` / `CheckoutPage` 负责：

- 读取活动详情。
- 渲染当前活动名称与动作类型。
- 提交 `/api/web/activities/{id}/code-consume`。
- 展示成功态或失败态。

### 3.4.4 页面恢复策略

普通用户输入页在回到前台时必须：

1. 重新检查会话是否有效；
2. 重新拉取活动详情；
3. 清空本地倒计时偏移并重新以服务端时间为准。

## 3.5 `staff` 模块设计

### 3.5.1 动态码管理页

`features/staff/components/DynamicCodePanel.tsx` 负责：

- 切换 `checkin` / `checkout`。
- 展示当前 6 位码、剩余时间、签到/签退人数。
- 回到前台后立即触发刷新。

`features/staff/components/BulkCheckoutButton.tsx` 负责：

- 提供确认动作。
- 调用批量签退接口。
- 展示影响人数与结果。

## 4. 后端详细设计

## 4.1 控制器设计

| 目标控制器 | 对应接口 | 说明 |
| --- | --- | --- |
| `WebAuthController` | `/api/web/auth/**` | 账号密码登录与强制改密入口 |
| `WebActivityController` | `/api/web/activities` | 活动列表和详情 |
| `WebAttendanceController` | `/api/web/activities/{id}/code-session`、`/code-consume` | 发码与验码 |
| `WebStaffController` | `/api/web/staff/**` | 批量签退 |

说明：

- 历史 controller（微信登录/二维码/兼容性）已从当前仓库主干删除；当前只保留 `/api/web/**` 作为正式入口。
- 如需对照迁移背景，请参考 `docs/WEB_MIGRATION_REVIEW.md` 与 git 历史。

## 4.2 服务设计

### 4.2.1 `WebPasswordAuthService`

职责：

- 校验 `student_id + password`。
- 在本地库缺少用户记录时，只读查询 `suda_union` 确认学号存在并自动建档。
- 登录成功后签发会话，并返回 `must_change_password`。
- 提供改密能力：校验旧密码、保存新密码 hash，并解除强制改密标记。

依赖：

- `LegacyUserLookupService`
- `WxUserAuthExtRepository`
- `WxSessionRepository`
- `SessionService`

### 4.2.3 `DynamicCodeService`

职责：

- 基于 `activity_id + action_type + slot + secret` 生成稳定 6 位码。
- staff 发码入口复用 `ActivityTimeWindowService` 做时间窗校验，时间片固定为 10 秒。
- 提供：
  - `slot`
  - `expires_at`
  - `expires_in_ms`
  - `server_time_ms`

### 4.2.4 `CheckinConsumeService`

现状（已收口到 Web-only 目标态）：

- 已改为消费 `activity_id + action_type + code`，不再接收 `qr_payload`。
- 保留：状态锁、事件审计、replay guard、outbox 写入、活动统计原子更新。

### 4.2.5 `BulkCheckoutService`

职责：

- 查询某活动下“已签到未签退”人员。
- 统一以管理员点击时的服务端时间做批量签退。
- 写事件、状态、计数与 outbox，并通过批次号为后续审计留痕。

## 4.3 现有服务修改点

| 现有类 | 修改方向 |
| --- | --- |
| `ActivityQueryService` | 增加 Web 活动列表与详情输出字段 |
| `SessionService` | 兼容 Web 登录后的会话签发与注销/失效策略 |
| `LegacyUserLookupService` | 增加实名校验、角色判定辅助查询 |
| `DynamicCodeService` | 收口 staff 发码与验码逻辑，时间窗与 10 秒时间片口径统一 |
| `OutboxRelayService` | 兼容批量签退与新事件类型 |
| `RecordQueryService` | 兼容批量动作查询或统计展示 |

## 5. 数据模型设计

## 5.1 复用表

| 表 | 复用方式 |
| --- | --- |
| `wx_session` | 继续承担短期业务会话 |
| `wx_activity_projection` | 继续承担活动读模型 |
| `wx_user_activity_status` | 继续承担用户活动状态 |
| `wx_checkin_event` | 保留事件流水，但改为动态码消费语义 |
| `wx_replay_guard` | 保留防重放，但唯一键语义改变 |
| `wx_sync_outbox` | 继续承担最终一致性回写 |
| `wx_admin_roster` | 保留管理员名单判定 |
| `web_admin_audit_log` | 记录管理员高风险操作审计（批量签退等） |

## 5.2 语义调整表

### 5.2.1 `wx_user_auth_ext`

保留字段：

- `legacy_user_id`
- `student_id`
- `name`
- `department`
- `club`
- `role_code`
- `permissions_json`
- `registered`

建议新增字段：

- `password_hash`
- `must_change_password`
- `password_updated_at`
- （可选）`last_login_at`

建议逐步废弃字段：

- `wx_identity`
- `wx_token`
- `token_ciphertext`
- `token_expires_at`

### 5.2.2 `wx_checkin_event`

建议新增字段：

- `code_slot`
- `submission_source`
- `operator_type`
- `operator_user_id`
- `batch_id`

### 5.2.3 `wx_replay_guard`

目标唯一键语义：

- `user_id + activity_id + action_type + slot`

## 5.3 历史遗留表（当前 Web-only 不再依赖）

说明：

- 早期方案曾引入“浏览器唯一绑定 + 解绑审核”，对应的 `web_browser_binding`、`web_unbind_review`、`web_passkey_*` 等表仍可能保留在迁移脚本中；
- 当前正式基线已取消浏览器绑定相关防代签逻辑，上述表不再作为业务流程必需依赖；
- 是否清理这些历史表应单独作为数据库治理任务推进，避免在功能整改中做破坏性变更。

## 6. 核心流程详细时序

## 6.1 首次登录与强制改密时序

1. 前端提交 `student_id + password`（默认 `123`）。
2. `WebAuthController` 调用 `WebPasswordAuthService.login()`。
3. `LegacyUserLookupService` 只读查询 `suda_union` 校验学号存在，并完成角色判定。
4. `WebPasswordAuthService` 完成密码校验、刷新角色权限快照并签发 `session_token`，返回 `must_change_password=true`。
5. 前端强制跳转 `/change-password` 并提交 `old_password + new_password`。
6. `WebAuthController` 调用 `WebPasswordAuthService.changePassword()`，更新密码 hash 并解除强制改密标记。
7. 关键落库对象：
   - `wx_user_auth_ext`（密码 hash、强制改密标记、角色快照等）
   - `wx_session`

## 6.2 登录时序

1. 前端提交 `student_id + password`。
2. 后端校验密码后签发新会话。
3. `SessionService` 签发新会话并回写 `last_login_at`。

## 6.3 动态码展示时序

1. 管理员请求 `code-session`。
2. `DynamicCodeService` 计算 `slot` 和 6 位码。
3. `ActivityQueryService` 拉取活动统计。
4. 返回 `code + expires_in_ms + server_time_ms + stats`。
5. 前端用 `server_time_ms` 做本地偏移，页面只做视觉倒计时。

## 6.4 动态码消费时序

1. 普通用户请求 `code-consume`。
2. `SessionTokenExtractor` 抽取会话。
3. `SessionService` 校验会话有效。
4. `CheckinConsumeService`：
   - 校验活动可见性
   - 校验报名资格
   - 校验当前状态
   - 调用 `DynamicCodeService` 验证动态码
   - 校验 `wx_replay_guard`
   - 更新 `wx_user_activity_status`
   - 写 `wx_checkin_event`
   - 写 `wx_sync_outbox`
   - 更新 `wx_activity_projection` 统计
5. 返回统一成功/失败响应。

## 6.5 一键全部签退时序

1. 管理员确认操作。
2. `BulkCheckoutService` 查询“已签到未签退”列表。
3. 批量更新状态。
4. 批量写事件与 outbox。
5. 返回影响人数、批次号、时间。

## 7. 状态机与算法设计

## 7.1 活动签到状态机

- `none -> checked_in`
- `checked_in -> checked_out`
- `checked_out` 不允许再次签到

说明：

- 一键全部签退只对 `checked_in` 生效。

## 7.2 动态码算法

输入：

- `activity_id`
- `action_type`
- `slot = floor(server_time_ms / 10000)`
- `server_secret`

输出：

- 长度固定为 6 的数字字符串

建议规则：

1. 后端对 `(activity_id, action_type, slot)` 做稳定摘要。
2. 使用 HMAC 或等价稳定算法。
3. 摘要取模 `1000000` 并左补零。
4. 前端不参与生成，只负责展示和提交。

## 7.3 防重放规则

- 唯一键：`user_id + activity_id + action_type + slot`
- 当前时间片重复提交返回 `duplicate`
- 不保留“上一 slot 宽限”：命中上一 slot 统一返回 `expired`（对外口径严格 10 秒）

## 7.4 统计一致性规则

问题：

- 现有实现的 `checkin_count / checkout_count` 仍有“读后写”风险。

目标：

- 改为原子更新或显式锁定。
- `BulkCheckoutService` 与 `CheckinConsumeService` 统一走同一计数路径。

## 8. 安全与风控设计

### 8.1 认证安全

- 当前部署基线为 **HTTP + 内网 IP + 端口号**，因此不依赖 Passkey/WebAuthn。
- 密码仅存 bcrypt hash，不存明文；默认密码固定为 `123`。
- 首次登录后必须强制改密；未改密前后端统一拦截业务接口（`password_change_required`）。
- 登录成功后签发短期会话。

### 8.2 会话安全

- 会话失效统一返回 `session_expired`。
- 本项目允许同一账号多端并发会话（多个 `session_token` 并存）。
- 建议提供显式登出能力，但不作为首阶段阻塞项。

### 8.3 动态码风控

- 当前实现已对“验码失败”做限流（`invalid_code` / `expired`）。
- 限流维度：
  - `user_id + activity_id`
- 说明：已取消 IP 维度限流（网关/反向代理后的 IP 不稳定，容易误伤同一出口下的正常用户）。
- 默认阈值与窗口（可通过环境变量覆盖）：
  - `RISK_INVALID_CODE_MAX_ATTEMPTS_PER_USER`（默认 12）
  - `RISK_INVALID_CODE_WINDOW_SECONDS`（默认 60）
- 达到阈值后返回：`status=forbidden` + `error_code=rate_limited`。

### 8.4 管理员高风险操作审计

以下动作必须审计（操作级审计，而非用户动作流水）：

- 一键全部签退（写入 `web_admin_audit_log`，由 `BulkCheckoutService` 统一落库）

## 9. 配置设计

当前已落地的关键配置项（`application.yml` -> 环境变量覆盖）：

- `app.session.ttl-seconds`（`SESSION_TTL_SECONDS`）
- `app.qr.signing-key`（`QR_SIGNING_KEY`，用于动态码生成/验码）
- `app.qr.replay-key-ttl-seconds`（`QR_REPLAY_TTL_SECONDS`）
- `app.risk.invalid-code.*`（见 8.3）

说明：

- 密码最小/最大长度当前以 `WebPasswordAuthService` 常量为准；若后续需要按环境调整，可再抽到配置。
- 动态码 slot 固定 10 秒（当前实现常量），不提供灰度配置入口，避免口径漂移。

本地开发还需要锁定：

- 本地域名方案
- 前后端同域或跨域部署方案
- CORS 策略

## 10. 测试设计

## 10.1 前端测试

当前已落地的核心单元/组件测试包括：

- `web/src/app/App.test.tsx`
- `web/src/shared/session/session-store.test.ts`
- `web/src/pages/login/LoginPage.test.tsx`
- `web/src/pages/change-password/ChangePasswordPage.test.tsx`
- `web/src/pages/activities/ActivitiesPage.test.tsx`
- `web/src/pages/checkin/CheckinPage.test.tsx`
- `web/src/pages/staff-manage/StaffManagePage.test.tsx`

E2E 建议新增：

- `web/tests/auth-flow.spec.ts`
- `web/tests/checkin-flow.spec.ts`
- `web/tests/staff-flow.spec.ts`

## 10.2 后端测试

仍建议补强：

- `backend/src/test/java/com/wxcheckin/backend/config/FlywayMigrationTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/WebPasswordAuthServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/api/WebAuthControllerTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/DynamicCodeServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/CheckinConsumeServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/BulkCheckoutServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/AttendanceCounterConcurrencyTest.java`

## 11. 实施前必须钉死的开放项

| 主题 | 必须锁定的点 | 默认建议 |
| --- | --- | --- |
| 密码策略 | 默认密码、强制改密拦截点、新密码最小长度 | 默认 `123` + 统一拦截 `password_change_required` |
| 会话策略 | TTL、续期策略、是否允许多端并发会话 | 短 TTL，不自动静默续期 |
| 动态码风控 | 限流维度、阈值、解锁策略 | `user_id + activity_id` 与 `IP + activity_id` 为主 |
| 前后端部署 | 同域还是跨域、CORS 是否启用 | 优先同域，减少 Cookie/头部复杂度 |

## 12. 结论

详细设计结论只有一句话：

历史上项目按“新建 `web/`、后端新增 `/api/web/**`、数据模型补齐、并发与风控补强、最后删旧”的顺序推进完成收口；后续维护若重新引入微信/二维码正式链路，会明显增加返工风险。
