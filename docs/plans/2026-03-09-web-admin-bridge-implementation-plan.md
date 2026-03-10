# 手机 Web 管理员链路与最小后端支撑 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在保持 Passkey 后端重构暂缓的前提下，补齐手机 Web 的管理员页与最小 `/api/web/**` 后端支撑，并修复前半程遗留的角色态缺口。

**Architecture:** 前端先升级会话角色态、路由守卫和管理员页面；后端新增 Web DTO / Controller / Service 适配层，把现有活动、会话、签到事务和同步主干包装到 `/api/web/**`；动态码与批量签退走最小可用实现，不提前做完整浏览器绑定迁移。

**Tech Stack:** Vite、React、TypeScript、Vitest、Spring Boot、JPA、Flyway、MockMvc、tdesign-mobile-react。

---

### Task 1: 文档与跟踪文件切换到三分之三阶段

**Files:**
- Create: `docs/plans/2026-03-09-web-admin-bridge-design.md`
- Create: `docs/plans/2026-03-09-web-admin-bridge-implementation-plan.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

**Step 1: 写入设计和计划文档**

- 记录本轮采用“前端四分之一 + 最小后端支撑”的边界。

**Step 2: 更新跟踪文件**

- 把当前阶段改成“管理员链路 + 最小 Web 后端支撑”。

**Step 3: 验证**

Run: `git -C /home/psx/app/wxapp-checkin diff -- docs/plans task_plan.md findings.md progress.md`
Expected: 只出现本轮文档与追踪改动

### Task 2: 先写前端角色态与路由守卫失败测试

**Files:**
- Modify: `web/src/app/App.test.tsx`
- Modify: `web/src/shared/session/session-store.test.ts`
- Test: `web/src/app/App.test.tsx`
- Test: `web/src/shared/session/session-store.test.ts`

**Step 1: 写失败测试**

- 覆盖：
  - staff 会话能读取角色与权限
  - `/staff/activities/:id/manage` 无权限时跳转
  - `/staff/unbind-reviews` staff 可进入
  - 活动列表在 staff 身份下不再被普通用户过滤误伤

**Step 2: 跑失败测试**

Run: `cd web && npm test -- --run src/app/App.test.tsx src/shared/session/session-store.test.ts`
Expected: 新增断言失败

### Task 3: 实现前端会话角色态、守卫与管理入口

**Files:**
- Modify: `web/src/shared/session/session-store.ts`
- Modify: `web/src/pages/login/LoginPage.tsx`
- Modify: `web/src/pages/bind/BindPage.tsx`
- Modify: `web/src/app/router.tsx`
- Modify: `web/src/features/activities/view-model.ts`
- Modify: `web/src/features/activities/components/ActivityCard.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.tsx`

**Step 1: 最小实现**

- 保存 `role / permissions / user_profile`
- 新增 `StaffRoute / ReviewRoute`
- 为 staff 增加管理入口
- 修正列表对 staff 的过滤策略

**Step 2: 跑测试**

Run: `cd web && npm test -- --run src/app/App.test.tsx src/shared/session/session-store.test.ts`
Expected: 通过

### Task 4: 先写管理员页面失败测试

**Files:**
- Create: `web/src/pages/staff-manage/StaffManagePage.test.tsx`
- Create: `web/src/pages/unbind-reviews/UnbindReviewPage.test.tsx`

**Step 1: 写失败测试**

- staff 管理页覆盖：
  - 拉取动态码
  - 切换签到/签退
  - 回前台刷新
  - 批量签退确认
- 解绑审核页覆盖：
  - 按状态展示
  - 审批动作后刷新

**Step 2: 跑失败测试**

Run: `cd web && npm test -- --run src/pages/staff-manage/StaffManagePage.test.tsx src/pages/unbind-reviews/UnbindReviewPage.test.tsx`
Expected: 失败，提示页面或 API 缺失

### Task 5: 实现 staff/review 前端页面与 API

**Files:**
- Create: `web/src/features/staff/api.ts`
- Create: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Create: `web/src/features/staff/components/BulkCheckoutButton.tsx`
- Create: `web/src/features/review/components/UnbindReviewList.tsx`
- Create: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Create: `web/src/pages/unbind-reviews/UnbindReviewPage.tsx`
- Modify: `web/src/app/router.tsx`
- Modify: `web/src/app/styles/base.css`

**Step 1: 最小实现**

- 动态码面板
- 批量签退确认
- 解绑审核列表
- 路由挂载

**Step 2: 跑页面测试**

Run: `cd web && npm test -- --run src/pages/staff-manage/StaffManagePage.test.tsx src/pages/unbind-reviews/UnbindReviewPage.test.tsx`
Expected: 通过

### Task 6: 先写后端 Web 活动与动态码失败测试

**Files:**
- Modify: `backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`

**Step 1: 写失败测试**

- 覆盖：
  - `/api/web/activities`
  - `/api/web/activities/{id}`
  - `/api/web/activities/{id}/code-session`
  - `/api/web/activities/{id}/code-consume`
  - 旧二维码接口继续兼容

**Step 2: 跑失败测试**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest`
Expected: 新增 Web 端断言失败

### Task 7: 实现后端 Web 活动与动态码支撑

**Files:**
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebActivityController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebAttendanceController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebActivityListResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebActivityDetailResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebCodeSessionResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebCodeConsumeRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/DynamicCodeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/dto/ConsumeCheckinRequest.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxActivityProjectionRepository.java`

**Step 1: 最小实现**

- Web DTO 平铺返回
- 6 位码签发与校验
- `code-consume` 新入参接入现有事务主干
- 活动统计更新改为原子 SQL 调整

**Step 2: 跑后端测试**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest`
Expected: 通过

### Task 8: 先写后端管理员链路失败测试

**Files:**
- Modify: `backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`

**Step 1: 写失败测试**

- 覆盖：
  - `/api/web/staff/activities/{id}/bulk-checkout`
  - `/api/web/unbind-reviews`
  - `/api/web/staff/unbind-reviews`
  - approve / reject

**Step 2: 跑失败测试**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest`
Expected: 新增 staff/review 断言失败

### Task 9: 实现后端批量签退与解绑审核

**Files:**
- Create: `backend/src/main/resources/db/migration/V6__add_web_unbind_review.sql`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebStaffController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebBulkCheckoutRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebBulkCheckoutResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebUnbindReviewCreateRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebUnbindReviewActionRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebUnbindReviewListResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/UnbindReviewService.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebUnbindReviewEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebUnbindReviewRepository.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxSessionRepository.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/domain/model/PermissionCatalog.java`

**Step 1: 最小实现**

- 批量签退
- 审核申请、列表、通过、拒绝
- 通过时失效旧会话

**Step 2: 跑后端测试**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest`
Expected: 通过

### Task 10: 跑前后端验证并回写 todo / 进度记录

**Files:**
- Modify: `docs/plans/2026-03-09-web-todo-list.md`
- Modify: `docs/changes.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

**Step 1: 跑 Web 测试**

Run: `cd web && npm test -- --run`
Expected: 全部通过

**Step 2: 跑 Web 构建**

Run: `cd web && npm run build`
Expected: 通过

**Step 3: 跑 Backend 测试**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest,ApiFlowNoIssueLogIntegrationTest`
Expected: 通过

**Step 4: 回写文档**

- 标记完成的 `T-058 ~ T-070`
- 若提前完成必要后端项，明确写入原因
