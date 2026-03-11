# Web Only Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `wxapp-checkin` 收口为 Web-only、本地可运行、前后端可验证的完整项目，并删除小程序与旧微信/二维码正式链路。

**Architecture:** 在现有 `web/` 和 `/api/web/**` 基础上补齐后端 Web 身份/绑定/会话模型，随后删除 `frontend/` 与旧正式接口入口，最终以自动化测试、构建和启动说明作为验收证据。认证后端采用“开发可运行”实现：真实 challenge、真实浏览器 API、真实数据落库与会话流转，但暂不做生产级完整 WebAuthn 验签。

**Tech Stack:** Vite、React、TypeScript、Vitest、Spring Boot、JPA、Flyway、MySQL、WebAuthn 浏览器原生 API。

---

> **注意：** 本计划基于当时的 Passkey/WebAuthn 认证方案编写。自 2026-03-10 起认证基线已调整为 **HTTP 内网账号密码（默认 123，首次登录强制改密）**。请以 `docs/plans/2026-03-10-http-password-auth-implementation-plan.md` 为准；本文仅保留为历史回溯。

### Task 1: 补齐后端 Web 身份数据模型

**Files:**
- Create: `backend/src/main/resources/db/migration/V7__add_web_identity_tables.sql`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebPasskeyCredentialEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebBrowserBindingEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebPasskeyChallengeEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebAdminAuditLogEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebPasskeyCredentialRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebBrowserBindingRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebPasskeyChallengeRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebAdminAuditLogRepository.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxUserAuthExtEntity.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/config/FlywayMigrationTest.java`

**Step 1: Write the failing test**

- 为新 migration 与约束补失败测试
- 断言可建表，且具备：
  - 一个账号一个活跃绑定
  - 一个浏览器一个活跃绑定

**Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=FlywayMigrationTest`
Expected: 新表或约束缺失导致失败

**Step 3: Write minimal implementation**

- 新增 V7 migration
- 实现实体与仓储
- 在 `WxUserAuthExtEntity` 增加 Web-only 收口所需字段

**Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=FlywayMigrationTest`
Expected: PASS

### Task 2: 补齐 `/api/web` 认证与绑定接口

**Files:**
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebAuthController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebBindVerifyRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebBindVerifyResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyRegisterOptionsResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyRegisterCompleteRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyLoginOptionsResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyLoginCompleteRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/WebIdentityService.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/PasskeyChallengeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/SessionService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/LegacyUserLookupService.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`

**Step 1: Write the failing test**

- 为以下接口补红集成测试：
  - `POST /api/web/bind/verify-identity`
  - `POST /api/web/passkey/register/options`
  - `POST /api/web/passkey/register/complete`
  - `POST /api/web/passkey/login/options`
  - `POST /api/web/passkey/login/complete`
- 覆盖：
  - 实名校验成功
  - 已有其他活跃绑定时阻止
  - 注册完成后写绑定 / 凭据 / 会话
  - 未注册浏览器登录返回 `passkey_not_registered`
  - 解绑批准后旧会话失效

**Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest`
Expected: 新接口缺失或语义不匹配而失败

**Step 3: Write minimal implementation**

- 实现 challenge 生成、过期校验与清理
- 实现实名校验、注册完成、登录完成
- 复用角色判定和用户画像填充逻辑
- 保持中文维护注释密度

**Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest`
Expected: PASS

### Task 3: 收尾解绑审批、审计与动态码稳定性

**Files:**
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/UnbindReviewService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java`
- Create: `backend/src/test/java/com/wxcheckin/backend/application/service/BulkCheckoutServiceTest.java`
- Create: `backend/src/test/java/com/wxcheckin/backend/application/service/CheckinConsumeServiceTest.java`
- Create: `backend/src/test/java/com/wxcheckin/backend/application/service/AttendanceCounterConcurrencyTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`

**Step 1: Write the failing test**

- 为解绑审批后的旧会话失效、审计日志写入、并发计数不丢失补失败测试

**Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=BulkCheckoutServiceTest,CheckinConsumeServiceTest,AttendanceCounterConcurrencyTest,ApiFlowIntegrationTest`
Expected: FAIL

**Step 3: Write minimal implementation**

- 审批通过时失效旧绑定与旧会话
- 记录管理员审计日志
- 为动态码消费路径彻底去除正式 Web 对 `qr_payload` 的依赖

**Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=BulkCheckoutServiceTest,CheckinConsumeServiceTest,AttendanceCounterConcurrencyTest,ApiFlowIntegrationTest`
Expected: PASS

### Task 4: 补前端 Web-only 收尾与认证联调

**Files:**
- Modify: `web/src/features/auth/api.ts`
- Modify: `web/src/pages/login/LoginPage.tsx`
- Modify: `web/src/pages/bind/BindPage.tsx`
- Modify: `web/src/features/staff/api.ts`
- Modify: `web/src/app/router.tsx`
- Create: `web/src/features/account/components/UnbindRequestPanel.tsx`
- Create: `web/src/pages/unbind-request/UnbindRequestPage.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/pages/login/LoginPage.test.tsx`
- Modify: `web/src/pages/bind/BindPage.test.tsx`
- Create: `web/src/pages/unbind-request/UnbindRequestPage.test.tsx`

**Step 1: Write the failing test**

- 覆盖：
  - 注册/登录成功后保存完整会话上下文
  - 绑定冲突或账号已在他处绑定时展示明确提示
  - 普通用户可提交解绑申请

**Step 2: Run test to verify it fails**

Run: `cd web && npm test -- --run src/pages/login/LoginPage.test.tsx src/pages/bind/BindPage.test.tsx src/pages/unbind-request/UnbindRequestPage.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- 对接真实后端认证字段
- 增加解绑申请页面与入口
- 保持现有管理员页与活动页不回退

**Step 4: Run test to verify it passes**

Run: `cd web && npm test -- --run src/pages/login/LoginPage.test.tsx src/pages/bind/BindPage.test.tsx src/pages/unbind-request/UnbindRequestPage.test.tsx`
Expected: PASS

### Task 5: 删除小程序与旧正式链路

**Files:**
- Delete: `frontend/`
- Delete: `project.config.json`
- Delete: `project.private.config.json`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/AuthController.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/CheckinController.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/ActivityController.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/AuthService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/WeChatIdentityResolver.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java`
- Modify: `README.md`
- Modify: `backend/README.md`
- Modify: `docs/REQUIREMENTS.md`
- Modify: `docs/FUNCTIONAL_SPEC.md`
- Modify: `docs/API_SPEC.md`
- Modify: `docs/changes.md`
- Modify: `docs/plans/2026-03-09-web-todo-list.md`

**Step 1: Write the failing test**

- 先补或改现有后端集成测试，使其不再依赖旧接口
- 断言仓库正式路径只剩 `/api/web/**`

**Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest`
Expected: 旧接口依赖尚未删净导致失败

**Step 3: Write minimal implementation**

- 删除小程序目录和配置
- 删掉或封死旧微信 / 二维码正式控制器入口
- 文档全部切到 Web-only

**Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest`
Expected: PASS

### Task 6: 全量验证与提交

**Files:**
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

**Step 1: Run backend verification**

Run: `cd backend && ./mvnw test`
Expected: PASS

**Step 2: Run web verification**

Run: `cd web && npm test -- --run && npm run build`
Expected: PASS

**Step 3: Review todo/doc status**

- 更新 `todo_list`
- 更新 `changes.md`
- 更新计划文件

**Step 4: Commit**

```bash
git -C /home/psx/app/wxapp-checkin add .
git -C /home/psx/app/wxapp-checkin commit -m "feat(web): complete web-only cutover"
```
