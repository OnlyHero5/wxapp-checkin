# Web-Only Mobile Check-In Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `wxapp-checkin` 从“微信小程序 + 二维码扫码”彻底迁移为“手机浏览器 Web + 动态 6 位码输入”，同时保留 `suda_union` 只读实名/报名校验与现有 outbox 最终一致性回写链路。

**Architecture:** 新建 `web/` 作为手机 Web 前端，`backend/` 继续作为唯一业务后端。后端新增 `web` 身份、Passkey、浏览器绑定、解绑审核、动态码、一键全部签退能力；待 Web 端稳定后，删除 `frontend/` 小程序和旧微信/二维码正式接口。

**Tech Stack:** Vite、React、TypeScript、Vitest、Playwright、Spring Boot、JPA、Flyway、MySQL、WebAuthn/Passkey、现有 `suda_union` 同步链路。

---

## 实施前提

- 仅修改 `wxapp-checkin/`。
- `suda_union/` 与 `suda-gs-ams/` 只允许读取和联调，不做代码逻辑改动。
- 需求基线以 `docs/REQUIREMENTS.md` 为准。
- 功能与接口基线分别以 `docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 为准。
- 设计基线以 `docs/WEB_DESIGN.md` 与 `docs/WEB_COMPATIBILITY.md` 为准。
- 最终交付必须删除小程序正式逻辑，不保留“双前端长期并行”状态。

### Task 1: 建立 `web/` 手机前端工程骨架

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/app/App.tsx`
- Create: `web/src/app/router.tsx`
- Create: `web/src/app/styles/base.css`
- Create: `web/src/test/setup.ts`
- Test: `web/src/app/App.test.tsx`

**Step 1: 写最小失败测试**

- 创建 `web/src/app/App.test.tsx`
- 断言 `/login` 和 `/activities` 路由可渲染基础壳层

**Step 2: 初始化工具链**

Run: `cd web && npm install`  
Expected: 安装 Vite、React、TypeScript、Vitest、Testing Library 成功

**Step 3: 写最小实现**

- 实现手机优先根布局
- 建立空白路由壳层：`/login`、`/bind`、`/activities`
- 引入全局样式与 viewport 基线

**Step 4: 跑前端基础验证**

Run: `cd web && npm test -- --run && npm run build`  
Expected: 测试通过，构建成功

**Step 5: 提交**

```bash
git add web
git commit -m "feat(web): bootstrap mobile web app"
```

### Task 2: 建立 Web 公共基础层

**Files:**
- Create: `web/src/shared/http/client.ts`
- Create: `web/src/shared/http/errors.ts`
- Create: `web/src/shared/session/session-store.ts`
- Create: `web/src/shared/device/browser-capability.ts`
- Create: `web/src/shared/device/page-lifecycle.ts`
- Create: `web/src/shared/ui/MobilePage.tsx`
- Create: `web/src/shared/ui/UnsupportedBrowser.tsx`
- Test: `web/src/shared/session/session-store.test.ts`
- Test: `web/src/shared/device/browser-capability.test.ts`

**Step 1: 写失败测试**

- 为会话持久化与能力探测写测试
- 至少覆盖：`session_token` 读写、Passkey 可用性判断、前后台事件包装

**Step 2: 实现 API 客户端与错误归一化**

- 统一处理 `401`、`403`、业务错误码与重定向
- 统一注入 `session_token`

**Step 3: 实现浏览器能力探测**

- 检测 `window.PublicKeyCredential`
- 检测 `navigator.credentials`
- 检测 `visibilitychange`
- 检测 `navigator.wakeLock`

**Step 4: 跑单测**

Run: `cd web && npm test -- --run session-store browser-capability`  
Expected: 相关测试通过

**Step 5: 提交**

```bash
git add web/src/shared
git commit -m "feat(web): add shared session and capability layer"
```

### Task 3: 实现实名绑定与 Passkey 登录前端

**Files:**
- Create: `web/src/features/auth/api.ts`
- Create: `web/src/features/auth/webauthn.ts`
- Create: `web/src/features/auth/components/IdentityBindForm.tsx`
- Create: `web/src/features/auth/components/PasskeyLoginPanel.tsx`
- Create: `web/src/pages/login/LoginPage.tsx`
- Create: `web/src/pages/bind/BindPage.tsx`
- Modify: `web/src/app/router.tsx`
- Test: `web/src/pages/login/LoginPage.test.tsx`
- Test: `web/src/pages/bind/BindPage.test.tsx`

**Step 1: 写失败测试**

- 绑定页测试：未填学号/姓名时不可提交
- 登录页测试：不支持 Passkey 时显示不支持页面

**Step 2: 实现实名绑定页**

- 输入 `student_id + name`
- 调用 `POST /api/web/bind/verify-identity`
- 成功后进入 Passkey 注册链路

**Step 3: 实现 Passkey 注册与登录页**

- 注册：`register/options -> navigator.credentials.create -> register/complete`
- 登录：`login/options -> navigator.credentials.get -> login/complete`
- 登录成功后写入会话并跳转 `/activities`

**Step 4: 跑前端测试**

Run: `cd web && npm test -- --run LoginPage BindPage`  
Expected: 测试通过

**Step 5: 提交**

```bash
git add web/src/features/auth web/src/pages/login web/src/pages/bind web/src/app/router.tsx
git commit -m "feat(web): add identity bind and passkey login flows"
```

### Task 4: 实现普通用户活动与输入码前端

**Files:**
- Create: `web/src/features/activities/api.ts`
- Create: `web/src/features/activities/components/ActivityCard.tsx`
- Create: `web/src/features/attendance/components/CodeInput.tsx`
- Create: `web/src/pages/activities/ActivitiesPage.tsx`
- Create: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
- Create: `web/src/pages/checkin/CheckinPage.tsx`
- Create: `web/src/pages/checkout/CheckoutPage.tsx`
- Test: `web/src/pages/activities/ActivitiesPage.test.tsx`
- Test: `web/src/pages/checkin/CheckinPage.test.tsx`

**Step 1: 写失败测试**

- 活动列表只渲染本人活动
- 6 位码输入控件使用数字输入策略
- 过期/错误码时展示清晰错误

**Step 2: 实现活动列表与详情**

- 列出可见活动
- 进入详情页后区分签到与签退入口

**Step 3: 实现签到/签退输入页**

- 大号 6 位数字输入
- 提交 `POST /api/web/activities/{id}/code-consume`
- 响应后展示结果页状态

**Step 4: 跑前端测试**

Run: `cd web && npm test -- --run ActivitiesPage CheckinPage`  
Expected: 测试通过

**Step 5: 提交**

```bash
git add web/src/features/activities web/src/features/attendance web/src/pages/activities web/src/pages/activity-detail web/src/pages/checkin web/src/pages/checkout
git commit -m "feat(web): add user activities and code input pages"
```

### Task 5: 实现管理员动态码、一键全部签退与解绑审核前端

**Files:**
- Create: `web/src/features/staff/api.ts`
- Create: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Create: `web/src/features/staff/components/BulkCheckoutButton.tsx`
- Create: `web/src/features/review/components/UnbindReviewList.tsx`
- Create: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Create: `web/src/pages/unbind-reviews/UnbindReviewPage.tsx`
- Test: `web/src/pages/staff-manage/StaffManagePage.test.tsx`
- Test: `web/src/pages/unbind-reviews/UnbindReviewPage.test.tsx`

**Step 1: 写失败测试**

- 页面从后台切回前台时应重拉动态码
- 一键全部签退前必须有确认动作
- 审核页要区分待审、已通过、已拒绝

**Step 2: 实现动态码展示页**

- 切换 `checkin` / `checkout`
- 拉取当前码、剩余时间、统计
- 监听 `visibilitychange` 重新同步

**Step 3: 实现一键全部签退与解绑审核页面**

- 管理员确认后执行批量签退
- 展示影响人数与结果
- 审核解绑申请并记录结果

**Step 4: 跑前端测试**

Run: `cd web && npm test -- --run StaffManagePage UnbindReviewPage`  
Expected: 测试通过

**Step 5: 提交**

```bash
git add web/src/features/staff web/src/features/review web/src/pages/staff-manage web/src/pages/unbind-reviews
git commit -m "feat(web): add staff manage and unbind review pages"
```

### Task 6: 新增 Web 身份与审核数据库模型

**Files:**
- Create: `backend/src/main/resources/db/migration/V6__add_web_identity_tables.sql`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebPasskeyCredentialEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebBrowserBindingEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebUnbindReviewEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebAdminAuditLogEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebPasskeyCredentialRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebBrowserBindingRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebUnbindReviewRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebAdminAuditLogRepository.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxUserAuthExtEntity.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/config/FlywayMigrationTest.java`

**Step 1: 先写 migration / repository 失败测试**

- 验证新表可建
- 验证唯一约束覆盖：
  - 一个账号一个活跃绑定
  - 一个浏览器一个活跃绑定

**Step 2: 编写 Flyway migration**

- 增加 Passkey、浏览器绑定、解绑审核、管理员审计表
- 给高频查询字段补索引

**Step 3: 实现实体与仓储**

- 建立 JPA entity
- 为查询活跃绑定、待审列表、按用户查凭据等场景补仓储方法

**Step 4: 跑后端测试**

Run: `cd backend && ./mvnw test -Dtest=FlywayMigrationTest`  
Expected: migration 通过

**Step 5: 提交**

```bash
git add backend/src/main/resources/db/migration/V6__add_web_identity_tables.sql backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository backend/src/test/java/com/wxcheckin/backend/config/FlywayMigrationTest.java
git commit -m "feat(backend): add web identity schema"
```

### Task 7: 实现后端实名校验、Passkey 与会话接口

**Files:**
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebAuthController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebBindVerifyRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyRegisterOptionsResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyRegisterCompleteRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyLoginOptionsResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyLoginCompleteRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/WebIdentityService.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/PasskeyChallengeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/SessionService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/LegacyUserLookupService.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/WebIdentityServiceTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/api/WebAuthControllerTest.java`

**Step 1: 写失败测试**

- 学号姓名不匹配时拒绝绑定
- 已绑定其他浏览器时拒绝重复绑定
- 登录成功后签发临时会话

**Step 2: 实现实名校验**

- 只读查询 `suda_union`
- 绑定 `student_id + name` 到内部用户
- 同步管理员角色判定结果

**Step 3: 实现 Passkey challenge 与验证**

- 注册 options / complete
- 登录 options / complete
- 成功后创建会话并写 `last_login_at`

**Step 4: 跑后端测试**

Run: `cd backend && ./mvnw test -Dtest=WebIdentityServiceTest,WebAuthControllerTest`  
Expected: 认证相关测试通过

**Step 5: 提交**

```bash
git add backend/src/main/java/com/wxcheckin/backend/api/controller/WebAuthController.java backend/src/main/java/com/wxcheckin/backend/api/dto backend/src/main/java/com/wxcheckin/backend/application/service/WebIdentityService.java backend/src/main/java/com/wxcheckin/backend/application/service/PasskeyChallengeService.java backend/src/main/java/com/wxcheckin/backend/application/service/SessionService.java backend/src/main/java/com/wxcheckin/backend/application/service/LegacyUserLookupService.java backend/src/test/java/com/wxcheckin/backend/application/service/WebIdentityServiceTest.java backend/src/test/java/com/wxcheckin/backend/api/WebAuthControllerTest.java
git commit -m "feat(backend): add web auth and passkey flows"
```

### Task 8: 实现活动查询、动态码生成与消费接口

**Files:**
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebActivityController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebAttendanceController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebCodeConsumeRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/DynamicCodeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/ActivityQueryService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxCheckinEventEntity.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxReplayGuardEntity.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/DynamicCodeServiceTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/CheckinConsumeServiceTest.java`

**Step 1: 写失败测试**

- 同活动同动作同 slot 生成同一 6 位码
- 不同活动或不同动作生成不同码
- 过期 slot 拒绝
- 重复提交返回 `duplicate`

**Step 2: 实现动态码服务**

- 基于 `activity_id + action_type + slot + secret` 生成 6 位码
- 返回 `server_time_ms`、`slot`、`expires_in_ms`

**Step 3: 改造消费接口**

- 消费入参改为 `activity_id + action_type + code`
- 删除对 `qr_payload` 的正式依赖
- 继续写状态、事件、replay guard、outbox

**Step 4: 跑后端测试**

Run: `cd backend && ./mvnw test -Dtest=DynamicCodeServiceTest,CheckinConsumeServiceTest`  
Expected: 动态码与消费测试通过

**Step 5: 提交**

```bash
git add backend/src/main/java/com/wxcheckin/backend/api/controller/WebActivityController.java backend/src/main/java/com/wxcheckin/backend/api/controller/WebAttendanceController.java backend/src/main/java/com/wxcheckin/backend/api/dto/WebCodeConsumeRequest.java backend/src/main/java/com/wxcheckin/backend/application/service/DynamicCodeService.java backend/src/main/java/com/wxcheckin/backend/application/service/ActivityQueryService.java backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxCheckinEventEntity.java backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxReplayGuardEntity.java backend/src/test/java/com/wxcheckin/backend/application/service/DynamicCodeServiceTest.java backend/src/test/java/com/wxcheckin/backend/application/service/CheckinConsumeServiceTest.java
git commit -m "feat(backend): add web dynamic code attendance"
```

### Task 9: 实现管理员一键全部签退与解绑审核后端

**Files:**
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebStaffController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/UnbindReviewService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/RecordQueryService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/OutboxRelayService.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/BulkCheckoutServiceTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/UnbindReviewServiceTest.java`

**Step 1: 写失败测试**

- 一键全部签退只影响“已签到未签退”
- 解绑审核通过后旧绑定失效
- 审核拒绝后旧绑定保持

**Step 2: 实现批量签退**

- 统一使用管理员点击时的服务端时间
- 批量写状态、事件、outbox、管理员审计

**Step 3: 实现解绑审核服务**

- 提交申请
- 查询待审列表
- 批准 / 拒绝
- 失效旧会话与旧绑定

**Step 4: 跑后端测试**

Run: `cd backend && ./mvnw test -Dtest=BulkCheckoutServiceTest,UnbindReviewServiceTest`  
Expected: 批量签退与解绑审核测试通过

**Step 5: 提交**

```bash
git add backend/src/main/java/com/wxcheckin/backend/api/controller/WebStaffController.java backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java backend/src/main/java/com/wxcheckin/backend/application/service/UnbindReviewService.java backend/src/main/java/com/wxcheckin/backend/application/service/RecordQueryService.java backend/src/main/java/com/wxcheckin/backend/application/service/OutboxRelayService.java backend/src/test/java/com/wxcheckin/backend/application/service/BulkCheckoutServiceTest.java backend/src/test/java/com/wxcheckin/backend/application/service/UnbindReviewServiceTest.java
git commit -m "feat(backend): add bulk checkout and unbind review"
```

### Task 10: 修复并发计数与一致性风险

**Files:**
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxActivityProjectionRepository.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/AttendanceCounterConcurrencyTest.java`

**Step 1: 写失败测试**

- 并发签到后 `checkin_count` 不丢失
- 并发签退后 `checkout_count` 不丢失

**Step 2: 实现原子更新**

- 使用原子 SQL 更新或显式锁
- 不再沿用“读实体 -> 修改 -> save”的无保护计数路径

**Step 3: 校准批量签退**

- 保证批量操作也走统一计数更新逻辑

**Step 4: 跑并发测试**

Run: `cd backend && ./mvnw test -Dtest=AttendanceCounterConcurrencyTest`  
Expected: 并发测试稳定通过

**Step 5: 提交**

```bash
git add backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxActivityProjectionRepository.java backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java backend/src/test/java/com/wxcheckin/backend/application/service/AttendanceCounterConcurrencyTest.java
git commit -m "fix(backend): make attendance counters atomic"
```

### Task 11: 建立 Web 端联调与移动兼容回归

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/tests/auth-flow.spec.ts`
- Create: `web/tests/checkin-flow.spec.ts`
- Create: `web/tests/staff-flow.spec.ts`
- Modify: `docs/WEB_COMPATIBILITY.md`
- Modify: `progress.md`

**Step 1: 写失败场景**

- 首绑失败 / 登录失败 / 过期码失败 / bulk checkout 成功

**Step 2: 实现 Playwright 脚本**

- 模拟手机视口
- 覆盖普通用户与管理员关键流程

**Step 3: 跑联调回归**

Run: `cd web && npx playwright test`  
Expected: 关键 Web 流程通过

**Step 4: 更新兼容性记录**

- 把已实测浏览器、版本、问题单写入 `docs/WEB_COMPATIBILITY.md`
- 把测试结果写入 `progress.md`

**Step 5: 提交**

```bash
git add web/playwright.config.ts web/tests docs/WEB_COMPATIBILITY.md progress.md
git commit -m "test(web): add mobile browser regression suite"
```

### Task 12: 删除小程序与旧微信/二维码正式链路

**Files:**
- Delete: `frontend/`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/AuthController.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/CheckinController.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/AuthService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/WeChatIdentityResolver.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java`
- Modify: `docs/REQUIREMENTS.md`
- Modify: `docs/FUNCTIONAL_SPEC.md`
- Modify: `docs/API_SPEC.md`
- Modify: `docs/changes.md`

**Step 1: 写删除前检查清单**

- Web 端回归全绿
- 后端 Web 接口测试全绿
- `suda_union` 同步验证通过
- 兼容性矩阵已补真机结果

**Step 2: 删除旧前端与正式接口**

- 删除 `frontend/` 全目录
- 删除 `wx-login` 正式链路
- 删除二维码签发 / 消费正式接口

**Step 3: 更新文档口径**

- 让 `REQUIREMENTS.md`、`FUNCTIONAL_SPEC.md`、`API_SPEC.md` 指向 Web 正式方案
- 在 `changes.md` 记录“完全剔除小程序”

**Step 4: 跑完整验证**

Run: `cd backend && ./mvnw test && cd ../web && npm run test -- --run && npm run build`  
Expected: 后端测试、前端测试、构建全部通过

**Step 5: 提交**

```bash
git add -A
git commit -m "refactor: remove miniapp and legacy qr flows"
```

## 交付完成定义

- `web/` 成为唯一正式前端
- 普通用户可完成实名绑定、Passkey 登录、签到、签退
- 管理员可展示动态签到码、动态签退码，并执行一键全部签退
- 解绑必须管理员审核
- `suda_union` 无代码逻辑改动
- 小程序与旧微信/二维码正式链路已删除
- 文档、测试、回归矩阵全部更新到 Web 口径
