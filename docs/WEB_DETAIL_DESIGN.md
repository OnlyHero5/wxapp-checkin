# 手机 Web 动态验证码签到详细设计说明书

文档版本: v1.0
状态: 实施执行稿
更新日期: 2026-03-09
项目: `wxapp-checkin`
定位: 本文档把目标态 Web 方案落到当前仓库的目录、类、表和测试入口，用于后续逐阶段编码。

## 1. 设计输入与适用范围

### 1.1 设计输入

- 正式需求基线：`docs/REQUIREMENTS.md`
- 正式功能基线：`docs/FUNCTIONAL_SPEC.md`
- 正式接口基线：`docs/API_SPEC.md`
- 补充设计：`docs/WEB_DESIGN.md`
- 审查结论：`docs/WEB_MIGRATION_REVIEW.md`
- 现有实施计划：`docs/plans/2026-03-09-web-only-migration-implementation-plan.md`

### 1.2 适用范围

- 仅适用于 `wxapp-checkin/` 项目。
- 仅设计手机 Web 目标态。
- 不定义 `suda_union/` 与 `suda-gs-ams/` 的代码改造。

## 2. 目标仓库结构

### 2.1 新增前端结构

建议在仓库根目录新增 `web/`：

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
      bind/BindPage.tsx
      activities/ActivitiesPage.tsx
      activity-detail/ActivityDetailPage.tsx
      checkin/CheckinPage.tsx
      checkout/CheckoutPage.tsx
      staff-manage/StaffManagePage.tsx
      unbind-reviews/UnbindReviewPage.tsx
    features/
      auth/
      activities/
      attendance/
      staff/
      review/
    shared/
      http/
      session/
      device/
      ui/
    test/
      setup.ts
  tests/
    auth-flow.spec.ts
    checkin-flow.spec.ts
    staff-flow.spec.ts
```

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
    WebBindVerifyRequest.java
    WebPasskeyRegisterOptionsResponse.java
    WebPasskeyRegisterCompleteRequest.java
    WebPasskeyLoginOptionsResponse.java
    WebPasskeyLoginCompleteRequest.java
    WebCodeConsumeRequest.java
  application/service/
    WebIdentityService.java
    PasskeyChallengeService.java
    DynamicCodeService.java
    BulkCheckoutService.java
    UnbindReviewService.java
  infrastructure/persistence/entity/
    WebPasskeyCredentialEntity.java
    WebBrowserBindingEntity.java
    WebUnbindReviewEntity.java
    WebAdminAuditLogEntity.java
  infrastructure/persistence/repository/
    WebPasskeyCredentialRepository.java
    WebBrowserBindingRepository.java
    WebUnbindReviewRepository.java
    WebAdminAuditLogRepository.java
```

## 3. 前端详细设计

## 3.1 路由设计

| 路由 | 角色 | 目标组件 | 主要职责 |
| --- | --- | --- | --- |
| `/login` | 全部 | `pages/login/LoginPage.tsx` | 登录入口、能力检测、Passkey 登录 |
| `/bind` | 未绑定用户 | `pages/bind/BindPage.tsx` | 实名校验、Passkey 首绑 |
| `/activities` | 已登录用户 | `pages/activities/ActivitiesPage.tsx` | 活动列表与角色分流 |
| `/activities/:id` | 已登录用户 | `pages/activity-detail/ActivityDetailPage.tsx` | 活动详情与入口跳转 |
| `/activities/:id/checkin` | `normal` | `pages/checkin/CheckinPage.tsx` | 输入签到码 |
| `/activities/:id/checkout` | `normal` | `pages/checkout/CheckoutPage.tsx` | 输入签退码 |
| `/staff/activities/:id/manage` | `staff` | `pages/staff-manage/StaffManagePage.tsx` | 展示动态码、统计、一键全部签退 |
| `/staff/unbind-reviews` | `staff` / `review_admin` | `pages/unbind-reviews/UnbindReviewPage.tsx` | 解绑审核列表与审批 |

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
  - 未绑定跳转 `/bind`
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

### 3.2.5 `src/shared/device/browser-capability.ts`

职责：

- 检测 Passkey 基线能力：
  - `window.PublicKeyCredential`
  - `navigator.credentials`
- 检测增强能力：
  - `document.visibilityState`
  - `navigator.wakeLock`
- 输出统一能力对象，供登录页和管理员页使用。

### 3.2.6 `src/shared/device/page-lifecycle.ts`

职责：

- 包装 `visibilitychange` 监听。
- 提供统一的“回前台后刷新”钩子。

### 3.2.7 `src/shared/ui/MobilePage.tsx`

职责：

- 提供统一的手机宽容器。
- 处理安全区、底部留白与标题区域。

### 3.2.8 `src/shared/ui/UnsupportedBrowser.tsx`

职责：

- 对不满足 Passkey 基线的浏览器给出明确说明。
- 不提供密码降级入口。

## 3.3 `auth` 模块设计

### 3.3.1 文件分工

| 文件 | 职责 |
| --- | --- |
| `features/auth/api.ts` | 绑定、注册 challenge、登录 challenge、complete 请求 |
| `features/auth/webauthn.ts` | 调用 `navigator.credentials.create/get`，处理浏览器结构转换 |
| `features/auth/components/IdentityBindForm.tsx` | 学号姓名表单 |
| `features/auth/components/PasskeyLoginPanel.tsx` | 登录按钮、登录中态、失败态 |

### 3.3.2 首绑流程

1. `BindPage` 渲染 `IdentityBindForm`。
2. 用户提交 `student_id + name`。
3. `auth/api.ts` 调用 `POST /api/web/bind/verify-identity`。
4. 成功后拿到 `bind_ticket`。
5. `webauthn.ts` 调用 `register/options` -> `navigator.credentials.create()` -> `register/complete`。
6. 返回 `session_token` 后写入 `session-store` 并跳转 `/activities`。

### 3.3.3 后续登录流程

1. `LoginPage` 启动时先检测浏览器能力。
2. 支持 Passkey 时展示 `PasskeyLoginPanel`。
3. 点击登录后调用 `login/options`。
4. `webauthn.ts` 调用 `navigator.credentials.get()`。
5. `login/complete` 成功后写入会话并进入 `/activities`。

### 3.3.4 异常策略

- `unsupported_browser`：显示不支持页。
- `challenge_expired`：提示稍后重试并重新拉取 challenge。
- `binding_conflict` / `account_bound_elsewhere`：提示联系管理员或走解绑流程。
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

## 3.5 `staff` 与 `review` 模块设计

### 3.5.1 动态码管理页

`features/staff/components/DynamicCodePanel.tsx` 负责：

- 切换 `checkin` / `checkout`。
- 展示当前 6 位码、剩余时间、签到/签退人数。
- 回到前台后立即触发刷新。

`features/staff/components/BulkCheckoutButton.tsx` 负责：

- 提供确认动作。
- 调用批量签退接口。
- 展示影响人数与结果。

### 3.5.2 解绑审核页

`features/review/components/UnbindReviewList.tsx` 负责：

- 按 `pending / approved / rejected` 筛选与展示。
- 审核通过或拒绝后刷新列表。

`UnbindReviewPage` 负责：

- 承载列表页。
- 提供审批备注输入与结果反馈。

## 4. 后端详细设计

## 4.1 控制器设计

| 目标控制器 | 对应接口 | 说明 |
| --- | --- | --- |
| `WebAuthController` | `/api/web/bind/**`、`/api/web/passkey/**` | Web 绑定与登录入口 |
| `WebActivityController` | `/api/web/activities` | 活动列表和详情 |
| `WebAttendanceController` | `/api/web/activities/{id}/code-session`、`/code-consume` | 发码与验码 |
| `WebStaffController` | `/api/web/staff/**`、`/api/web/unbind-reviews` | 批量签退、解绑审核 |

当前历史控制器保留到最终删旧阶段：

- `AuthController`
- `ActivityController`
- `CheckinController`
- `CompatibilityController`

## 4.2 服务设计

### 4.2.1 `WebIdentityService`

职责：

- 校验 `student_id + name`。
- 校验账户是否已有活跃绑定。
- 校验当前浏览器是否已绑定其他账号。
- 生成 `bind_ticket`。
- 保存首绑完成后的身份、绑定与登录信息。

依赖：

- `LegacyUserLookupService`
- `WxUserAuthExtRepository`
- `WebBrowserBindingRepository`
- `WebPasskeyCredentialRepository`
- `SessionService`

### 4.2.2 `PasskeyChallengeService`

职责：

- 生成和缓存注册/登录 challenge。
- 绑定 `request_id` 与 challenge 生命周期。
- 校验 `register/complete`、`login/complete` 回调。

说明：

- 编码时建议把 challenge 缓存与验证逻辑封在单独服务中，避免散落在控制器。

### 4.2.3 `DynamicCodeService`

职责：

- 基于 `activity_id + action_type + slot + secret` 生成稳定 6 位码。
- 提供：
  - `slot`
  - `expires_at`
  - `expires_in_ms`
  - `server_time_ms`

### 4.2.4 `CheckinConsumeService`

现状：

- 当前实现以 `qr_payload` 为核心。

目标：

- 改为消费 `activity_id + action_type + code`。
- 保留：
  - 状态锁
  - 事件审计
  - replay guard
  - outbox 写入
- 调整：
  - 动态码校验来源
  - replay guard 唯一键
  - 活动统计原子更新

### 4.2.5 `BulkCheckoutService`

职责：

- 查询某活动下“已签到未签退”人员。
- 统一以管理员点击时的服务端时间做批量签退。
- 写事件、状态、计数、管理员审计和 outbox。

### 4.2.6 `UnbindReviewService`

职责：

- 提交解绑申请。
- 查询待审 / 已审列表。
- 审批通过或拒绝。
- 审批通过时失效旧绑定与旧会话。

## 4.3 现有服务修改点

| 现有类 | 修改方向 |
| --- | --- |
| `ActivityQueryService` | 增加 Web 活动列表与详情输出字段 |
| `SessionService` | 兼容 Web 登录后的会话签发与注销/失效策略 |
| `LegacyUserLookupService` | 增加实名校验、角色判定辅助查询 |
| `QrSessionService` | 最终迁移为动态码服务的历史兼容层，后续删除 |
| `OutboxRelayService` | 兼容批量签退与新事件类型 |
| `RecordQueryService` | 兼容解绑审核、批量动作查询或统计展示 |

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

- `identity_source`
- `bind_status`
- `last_login_at`

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

## 5.3 新增表设计

### 5.3.1 `web_passkey_credential`

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `user_id` | 关联 `wx_user_auth_ext` |
| `credential_id` | WebAuthn 凭据标识，唯一 |
| `public_key_cose` | 公钥 |
| `sign_count` | 计数器 |
| `transports_json` | 传输方式 |
| `aaguid` | 设备类型标识 |
| `backup_eligible` | 是否支持备份 |
| `backup_state` | 备份状态 |
| `created_at` | 创建时间 |
| `last_used_at` | 最近使用时间 |
| `revoked_at` | 撤销时间 |

索引建议：

- `uk_web_passkey_credential_id`
- `idx_web_passkey_user_id`

### 5.3.2 `web_browser_binding`

| 字段 | 说明 |
| --- | --- |
| `binding_id` | 主键 |
| `user_id` | 绑定用户 |
| `binding_fingerprint_hash` | 浏览器绑定辅助指纹 |
| `user_agent_hash` | 浏览器环境辅助指纹 |
| `status` | `active / revoked / pending_review` |
| `created_at` | 创建时间 |
| `last_seen_at` | 最近访问时间 |
| `revoked_at` | 失效时间 |
| `revoked_reason` | 失效原因 |
| `approved_unbind_review_id` | 审批来源 |

唯一约束建议：

- 一个用户仅允许一个活跃绑定。
- 一个浏览器辅助指纹仅允许一个活跃绑定。

### 5.3.3 `web_unbind_review`

| 字段 | 说明 |
| --- | --- |
| `review_id` | 主键 |
| `user_id` | 申请用户 |
| `current_binding_id` | 当前绑定 |
| `requested_new_binding_hint` | 新设备提示 |
| `status` | `pending / approved / rejected` |
| `submitted_at` | 提交时间 |
| `reviewed_by` | 审核人 |
| `reviewed_at` | 审核时间 |
| `review_comment` | 审核意见 |

### 5.3.4 `web_admin_audit_log`

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `operator_user_id` | 操作人 |
| `action_type` | 动作类型 |
| `target_type` | 目标对象类型 |
| `target_id` | 目标对象标识 |
| `payload_json` | 操作上下文 |
| `created_at` | 创建时间 |

## 6. 核心流程详细时序

## 6.1 首绑时序

1. 前端提交实名信息。
2. `WebAuthController` 调用 `WebIdentityService.verifyIdentity()`。
3. `LegacyUserLookupService` 只读查询实名与角色。
4. `WebIdentityService` 校验绑定冲突并签发 `bind_ticket`。
5. 前端调用 `register/options`。
6. `PasskeyChallengeService` 保存 challenge。
7. 浏览器返回 attestation。
8. `register/complete` 成功后持久化：
   - `wx_user_auth_ext`
   - `web_browser_binding`
   - `web_passkey_credential`
   - `wx_session`

## 6.2 登录时序

1. 前端请求 `login/options`。
2. `PasskeyChallengeService` 生成登录 challenge。
3. 浏览器完成 `navigator.credentials.get()`。
4. 后端验证 assertion。
5. 校验绑定仍有效。
6. `SessionService` 签发新会话并回写 `last_login_at`。

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
5. 写 `web_admin_audit_log`。
6. 返回影响人数、批次号、时间。

## 6.6 解绑审核时序

1. 用户提交解绑申请。
2. `UnbindReviewService` 写入 `web_unbind_review`。
3. 管理员审批通过。
4. 服务层失效：
   - `web_browser_binding`
   - `wx_session`
5. 写 `web_admin_audit_log`。

## 7. 状态机与算法设计

## 7.1 浏览器绑定状态机

建议状态：

- `active`
- `pending_review`
- `revoked`

状态变化：

- 首绑成功：`none -> active`
- 用户申请解绑：`active -> pending_review`
- 管理员批准：`pending_review -> revoked`
- 管理员拒绝：`pending_review -> active`

## 7.2 活动签到状态机

- `none -> checked_in`
- `checked_in -> checked_out`
- `checked_out` 不允许再次签到

说明：

- 一键全部签退只对 `checked_in` 生效。

## 7.3 动态码算法

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

## 7.4 防重放规则

- 唯一键：`user_id + activity_id + action_type + slot`
- 当前时间片重复提交返回 `duplicate`
- 允许校验当前 slot 与上一个 slot 以吸收边界延迟，但对外口径仍保持“10 秒内有效”

## 7.5 统计一致性规则

问题：

- 现有实现的 `checkin_count / checkout_count` 仍有“读后写”风险。

目标：

- 改为原子更新或显式锁定。
- `BulkCheckoutService` 与 `CheckinConsumeService` 统一走同一计数路径。

## 8. 安全与风控设计

### 8.1 认证安全

- 仅在 HTTPS 下启用 Passkey。
- 不支持降级密码登录。
- 登录成功后签发短期会话。

### 8.2 会话安全

- 会话失效统一返回 `session_expired`。
- 解绑审核通过后必须同步失效旧会话。
- 建议提供显式登出能力，但不作为首阶段阻塞项。

### 8.3 动态码风控

- 对错误码尝试增加限流。
- 推荐限流维度：
  - `user_id + activity_id`
  - `binding_id + activity_id`
  - `IP + activity_id`
- 达到阈值后返回明确业务错误，而非裸异常。

### 8.4 管理员高风险操作审计

以下动作必须审计：

- 审批解绑
- 驳回解绑
- 一键全部签退

## 9. 配置设计

建议在 `AppProperties` 新增或整理 Web 配置分组：

- `web.passkey.rp-id`
- `web.passkey.rp-name`
- `web.passkey.allowed-origins`
- `web.session.ttl-seconds`
- `web.code.slot-ms`
- `web.code.secret`
- `web.risk.max-invalid-code-attempts`
- `web.risk.invalid-code-window-seconds`

本地开发还需要锁定：

- 本地域名方案
- 前后端同域或跨域部署方案
- CORS 策略

## 10. 测试设计

## 10.1 前端测试

单元/组件测试建议新增：

- `web/src/app/App.test.tsx`
- `web/src/shared/session/session-store.test.ts`
- `web/src/shared/device/browser-capability.test.ts`
- `web/src/pages/login/LoginPage.test.tsx`
- `web/src/pages/bind/BindPage.test.tsx`
- `web/src/pages/activities/ActivitiesPage.test.tsx`
- `web/src/pages/checkin/CheckinPage.test.tsx`
- `web/src/pages/staff-manage/StaffManagePage.test.tsx`
- `web/src/pages/unbind-reviews/UnbindReviewPage.test.tsx`

E2E 建议新增：

- `web/tests/auth-flow.spec.ts`
- `web/tests/checkin-flow.spec.ts`
- `web/tests/staff-flow.spec.ts`

## 10.2 后端测试

建议新增：

- `backend/src/test/java/com/wxcheckin/backend/config/FlywayMigrationTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/WebIdentityServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/api/WebAuthControllerTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/DynamicCodeServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/CheckinConsumeServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/BulkCheckoutServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/UnbindReviewServiceTest.java`
- `backend/src/test/java/com/wxcheckin/backend/application/service/AttendanceCounterConcurrencyTest.java`

## 11. 实施前必须钉死的开放项

| 主题 | 必须锁定的点 | 默认建议 |
| --- | --- | --- |
| Passkey 域配置 | `RP ID`、正式域名、本地域名、HTTPS 方案 | 先采用同域部署口径 |
| 浏览器绑定 | 绑定主键、指纹因子、是否允许无指纹回退 | 服务端持久化绑定为主，指纹只作辅助 |
| 会话策略 | TTL、续期策略、解绑后失效策略 | 短 TTL，不自动静默续期 |
| 动态码风控 | 限流维度、阈值、解锁策略 | `binding_id + activity_id` 为主 |
| 前后端部署 | 同域还是跨域、CORS 是否启用 | 优先同域，减少 WebAuthn 和 Cookie/头部复杂度 |

## 12. 结论

详细设计结论只有一句话：

后续编码应该按“新建 `web/`、后端新增 `/api/web/**`、数据模型补齐、并发与风控补强、最后删旧”的顺序推进；任何试图跳过 `web/` 重建或继续以微信/二维码正式链路为中心的实现，都将明显增加返工风险。
