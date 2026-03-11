# HTTP 账号密码认证改造 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 移除 Passkey/WebAuthn 登录链路，改为 `student_id + password`（默认 `123`）登录，并在首次登录后强制用户修改密码；认证与密码数据存储在 `wxcheckin_ext`。

**Architecture:** 后端新增 `/api/web/auth/login` 与 `/api/web/auth/change-password`，在 `SessionService` 层统一拦截 `must_change_password`；前端把 `/login` 改为账号密码表单，并新增 `/change-password` 路由与守卫；删除 Passkey/WebAuthn 相关 controller/service/DTO/前端组件与测试。

**Tech Stack:** Spring Boot 3.5、JPA、Flyway、MySQL、Vite、React、TypeScript、Vitest。

> **执行状态：** 已按本计划落地实现并完成验证；本文保留为“变更实施回溯/对照清单”。

补充说明（2026-03-10 整改）：

- 本项目已取消浏览器唯一绑定与解绑审核；因此本文中涉及 `X-Browser-Binding-Key`、browser binding、unbind review 的步骤不再适用，仅保留为历史对照。

---

### Task 1: 更新正式文档基线

**Files:**
- Modify: `docs/REQUIREMENTS.md`
- Modify: `docs/FUNCTIONAL_SPEC.md`
- Modify: `docs/API_SPEC.md`
- Modify: `docs/WEB_DESIGN.md`
- Modify: `docs/WEB_DETAIL_DESIGN.md`
- Modify: `docs/WEB_COMPATIBILITY.md`
- Modify: `README.md`
- Modify: `docs/changes.md`
- Modify: `changes.md`

**Step 1:** 替换 “Passkey + HTTPS” 为 “HTTP 内网 + 账号密码 + 首次强制改密”。
**Step 2:** 删除 Passkey 相关接口描述，新增 `/auth/login`、`/auth/change-password`。

### Task 2: 后端（TDD）新增账号密码登录与强制改密拦截

**Files:**
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebAuthController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebAuthLoginRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebAuthLoginResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebAuthChangePasswordRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebAuthChangePasswordResponse.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/SessionService.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/WebPasswordAuthService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxUserAuthExtEntity.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxUserAuthExtRepository.java`
- Create: `backend/src/main/resources/db/migration/V9__add_web_password_auth.sql`
- Test: `backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`

**Step 1: 写失败的集成测试**
- 在 `ApiFlowIntegrationTest` 新增：
  - `POST /api/web/auth/login` 默认密码可登录且返回 `must_change_password=true`
  - 未改密前 `GET /api/web/activities` 返回 `password_change_required`
  - `POST /api/web/auth/change-password` 成功后业务接口恢复可用

Run: `cd backend && ./mvnw test`
Expected: FAIL（接口不存在 / 错误码不匹配）

**Step 2: 写最小实现让测试转绿**
- 新增 `WebPasswordAuthService`：
  - 查询/创建用户（依赖 `LegacyUserLookupService`）
  - bcrypt 校验/写入
  - 创建/校验浏览器绑定
  - 签发会话并返回 `must_change_password`
- 在 `SessionService` 增加 `must_change_password` 统一拦截（仅改密接口放行）。

Run: `cd backend && ./mvnw test`
Expected: PASS

### Task 3: 后端移除 Passkey/WebAuthn 业务逻辑

**Files:**
- Delete: `backend/src/main/java/com/wxcheckin/backend/application/service/WebIdentityService.java`
- Delete: `backend/src/main/java/com/wxcheckin/backend/application/service/PasskeyChallengeService.java`
- Delete: `backend/src/main/java/com/wxcheckin/backend/application/service/WebAuthnVerifier.java`
- Delete: `backend/src/main/java/com/wxcheckin/backend/config/ProductionWebAuthSafetyGuard.java`
- Delete: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskey*.java`
- Delete: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebPasskey*.java`
- Delete: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebPasskey*.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/UnbindReviewService.java`

**Step 1:** 清理 Unbind 审核里对 Passkey credential 的依赖。
**Step 2:** 删除 Passkey 端点与相关类，确保 `./mvnw test` 通过。

### Task 4: 前端（TDD）替换登录页 + 新增改密页

**Files:**
- Modify: `web/src/pages/login/LoginPage.tsx`
- Create: `web/src/pages/change-password/ChangePasswordPage.tsx`
- Modify: `web/src/app/router.tsx`
- Modify: `web/src/features/auth/api.ts`
- Modify: `web/src/shared/session/session-store.ts`
- Test: `web/src/pages/login/LoginPage.test.tsx`
- Create: `web/src/pages/change-password/ChangePasswordPage.test.tsx`

**Step 1:** 先把测试改成账号密码登录行为（默认 `123` + 强制改密跳转）。
**Step 2:** 实现 `/login` 表单与 `/change-password` 页面。

Run: `cd web && npm test -- --run`
Expected: PASS

### Task 5: 前端移除 Passkey UI/能力探测

**Files:**
- Delete: `web/src/features/auth/webauthn.ts`
- Delete: `web/src/features/auth/components/PasskeyLoginPanel.tsx`
- Delete: `web/src/features/auth/components/IdentityBindForm.tsx`
- Delete: `web/src/pages/bind/BindPage.tsx`
- Delete: `web/src/shared/ui/UnsupportedBrowser.tsx`
- Delete/Modify: `web/src/shared/device/browser-capability.ts`（若不再使用）

### Task 6: 全量验证与进度回写

Run:
- `cd backend && ./mvnw test`
- `cd web && npm test -- --run`
- `cd web && npm run build`

并同步：
- `task_plan.md` / `progress.md` / `findings.md`
- `docs/changes.md` / `changes.md`
