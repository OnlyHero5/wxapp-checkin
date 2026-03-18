# 活动参会名单修正 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `wxapp-checkin` 增加管理员“参会名单页”，支持按活动查看所有已报名成员，并对签到 / 签退状态执行单个或批量修正，同时保证统计、审计和 legacy 回写保持一致。

**Architecture:** 前端在活动详情 staff 视角新增“参会名单”入口，并增加独立的 `/staff/activities/:activityId/roster` 页面；后端新增 staff 名单查询与统一状态修正接口，继续复用现有三态 `none / checked_in / checked_out` 作为主状态模型。管理员修正通过“旧状态 -> 新状态”计算统计差量，写管理员审计日志，并生成 snapshot 型 outbox payload 回写 legacy；对新增的正向签到 / 签退结果补写 `wx_checkin_event`，保证详情页与名单页仍能展示当前状态对应的时间信息。所有新增或重写源码必须补足中文维护注释，注释密度保持在对应源码的四分之一到三分之一。

**Tech Stack:** Vite、React、TypeScript、Vitest、tdesign-mobile-react、Spring Boot、JPA、MockMvc、H2、Flyway。

---

### Task 1: 先写前端入口失败测试

**Files:**
- Modify: `web/src/app/App.test.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`
- Test: `web/src/app/App.test.tsx`
- Test: `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`

**Step 1: 写 failing tests**

- 在 `ActivityDetailPage.test.tsx` 增加 staff 视角断言：
  - 出现“参会名单”按钮
  - 点击后应跳转到 `/staff/activities/:id/roster`
- 在 `App.test.tsx` 增加 staff 路由守卫断言：
  - 非 staff 访问名单页被重定向到活动列表
  - staff 会话可以进入名单页壳层

**Step 2: 跑测试确认失败**

Run: `cd web && npm test -- --run src/app/App.test.tsx src/pages/activity-detail/ActivityDetailPage.test.tsx`
Expected: FAIL，且失败原因来自“参会名单”入口或名单页路由不存在。

**Step 3: 提交测试**

```bash
git add web/src/app/App.test.tsx web/src/pages/activity-detail/ActivityDetailPage.test.tsx
git commit -m "test(web): 补参会名单入口回归用例"
```

### Task 2: 实现活动详情入口与名单页路由骨架

**Files:**
- Modify: `web/src/features/activities/api.ts`
- Modify: `web/src/app/router.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
- Create: `web/src/pages/activity-roster/ActivityRosterPage.tsx`
- Modify: `web/src/app/App.test.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`

**Step 1: 写最小实现**

- 在活动 API 层增加 `buildActivityRosterPath`
- 在详情页 staff 视角增加“参会名单”按钮
- 在路由层挂载 `/staff/activities/:activityId/roster`
- 先提供最小页面骨架，保证路由和导航打通
- 新增页面时补中文维护注释，明确该页与动态码管理页的职责边界

**Step 2: 跑测试确认通过**

Run: `cd web && npm test -- --run src/app/App.test.tsx src/pages/activity-detail/ActivityDetailPage.test.tsx`
Expected: PASS。

**Step 3: 提交**

```bash
git add web/src/features/activities/api.ts web/src/app/router.tsx web/src/pages/activity-detail/ActivityDetailPage.tsx web/src/pages/activity-roster/ActivityRosterPage.tsx web/src/app/App.test.tsx web/src/pages/activity-detail/ActivityDetailPage.test.tsx
git commit -m "feat(web): 打通参会名单入口与路由骨架"
```

### Task 3: 先写后端名单查询与状态修正失败测试

**Files:**
- Modify: `backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`
- Create: `backend/src/test/java/com/wxcheckin/backend/application/service/StaffAttendanceAdminServiceTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/StaffAttendanceAdminServiceTest.java`

**Step 1: 写 failing tests**

- 在 `ApiFlowIntegrationTest` 增加：
  - `GET /api/web/staff/activities/{activityId}/roster` 只返回已报名成员
  - `POST /api/web/staff/activities/{activityId}/attendance-adjustments` 支持单人修正和批量修正
  - 非 staff 访问失败
  - 空 `user_ids` 或非法 patch 失败
- 在 `StaffAttendanceAdminServiceTest` 增加状态转换断言：
  - `none -> checked_in`
  - `checked_in -> none`
  - `checked_in -> checked_out`
  - `checked_out -> checked_in`
  - `checked_out -> none`
  - `none -> checked_out`
- 同时断言：
  - 统计差量正确
  - 审计 payload 正确
  - outbox payload 目标 `check_in/check_out` 值正确
  - 正向状态补写事件时间

**Step 2: 跑测试确认失败**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest,StaffAttendanceAdminServiceTest`
Expected: FAIL，且失败原因来自接口、DTO、服务或仓储方法缺失。

**Step 3: 提交测试**

```bash
git add backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java backend/src/test/java/com/wxcheckin/backend/application/service/StaffAttendanceAdminServiceTest.java
git commit -m "test(backend): 补参会名单修正失败用例"
```

### Task 4: 实现后端名单查询、状态修正、审计与 legacy 回写

**Files:**
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/ActivityRosterItemDto.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebActivityRosterResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebAttendanceAdjustmentPatchDto.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebAttendanceAdjustmentRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebAttendanceAdjustmentResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/StaffAttendanceAdminService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebStaffController.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/ActivityQueryService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/OutboxRelayService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/domain/model/PermissionCatalog.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxUserActivityStatusRepository.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxCheckinEventRepository.java`
- Modify: `backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`
- Modify: `backend/src/test/java/com/wxcheckin/backend/application/service/StaffAttendanceAdminServiceTest.java`

**Step 1: 实现名单查询**

- 增加活动名单查询 DTO
- 在 `WebStaffController` 暴露 `GET /staff/activities/{activityId}/roster`
- 在仓储层提供“按活动查询已报名成员并带用户信息”的方法
- 在服务层统一把三态映射成 `checked_in / checked_out` 双字段，并按当前状态裁剪时间显示

**Step 2: 实现状态修正服务**

- 新建 `StaffAttendanceAdminService`
- 统一解析 patch，并收敛到合法最终状态
- 基于“旧状态 -> 新状态”计算统计 delta
- 对正向补签到 / 补签退补写 `wx_checkin_event`
- 对撤销签到 / 撤销签退不额外写“负向事件”，只通过当前状态裁剪时间显示
- 审计日志写 `attendance_adjustment`
- outbox payload 直接写目标 `check_in / check_out`

**Step 3: 扩展 legacy relay**

- 在 `OutboxRelayService` 兼容新的管理员修正 payload
- 按 snapshot 目标值更新 `suda_activity_apply`
- 保持旧 `checkin` / `checkout` 流程不回退

**Step 4: 修正详情页时间口径**

- `ActivityQueryService.detailForWeb` 按当前状态决定是否返回 `my_checkin_time / my_checkout_time`
- 避免“状态已清空但仍显示旧时间”

**Step 5: 跑测试确认通过**

Run: `cd backend && ./mvnw test -Dtest=ApiFlowIntegrationTest,StaffAttendanceAdminServiceTest`
Expected: PASS。

**Step 6: 提交**

```bash
git add backend/src/main/java/com/wxcheckin/backend/api/dto/ActivityRosterItemDto.java backend/src/main/java/com/wxcheckin/backend/api/dto/WebActivityRosterResponse.java backend/src/main/java/com/wxcheckin/backend/api/dto/WebAttendanceAdjustmentPatchDto.java backend/src/main/java/com/wxcheckin/backend/api/dto/WebAttendanceAdjustmentRequest.java backend/src/main/java/com/wxcheckin/backend/api/dto/WebAttendanceAdjustmentResponse.java backend/src/main/java/com/wxcheckin/backend/application/service/StaffAttendanceAdminService.java backend/src/main/java/com/wxcheckin/backend/api/controller/WebStaffController.java backend/src/main/java/com/wxcheckin/backend/application/service/ActivityQueryService.java backend/src/main/java/com/wxcheckin/backend/application/service/OutboxRelayService.java backend/src/main/java/com/wxcheckin/backend/domain/model/PermissionCatalog.java backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxUserActivityStatusRepository.java backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxCheckinEventRepository.java backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java backend/src/test/java/com/wxcheckin/backend/application/service/StaffAttendanceAdminServiceTest.java
git commit -m "feat(backend): 支持活动参会名单修正"
```

### Task 5: 先写前端名单页失败测试

**Files:**
- Create: `web/src/pages/activity-roster/ActivityRosterPage.test.tsx`
- Modify: `web/src/features/staff/api.ts`
- Test: `web/src/pages/activity-roster/ActivityRosterPage.test.tsx`

**Step 1: 写 failing tests**

- 覆盖：
  - 名单页能拉取活动摘要和成员列表
  - 单人修正后会重新刷新名单
  - 批量勾选后可执行四类批量动作
  - 批量确认框文案会说明状态联动
  - 页面回到前台会刷新
  - 会话过期 / 强制改密时跳转正确

**Step 2: 跑测试确认失败**

Run: `cd web && npm test -- --run src/pages/activity-roster/ActivityRosterPage.test.tsx`
Expected: FAIL，且失败原因来自名单 API、页面结构或批量交互缺失。

**Step 3: 提交测试**

```bash
git add web/src/pages/activity-roster/ActivityRosterPage.test.tsx web/src/features/staff/api.ts
git commit -m "test(web): 补参会名单页交互用例"
```

### Task 6: 实现前端名单页与状态修正交互

**Files:**
- Modify: `web/src/features/staff/api.ts`
- Create: `web/src/features/staff/components/AttendanceBatchActionBar.tsx`
- Create: `web/src/features/staff/components/AttendanceRosterList.tsx`
- Modify: `web/src/pages/activity-roster/ActivityRosterPage.tsx`
- Modify: `web/src/pages/activity-roster/ActivityRosterPage.test.tsx`
- Modify: `web/src/app/styles/base.css`

**Step 1: 扩展 staff API 契约**

- 增加名单查询类型
- 增加状态修正请求 / 响应类型
- 增加 `getActivityRoster` 和 `adjustAttendanceStates`

**Step 2: 实现页面与组件**

- 名单页复用 `ActivityMetaPanel` 展示摘要
- 用组件库组织批量操作条与名单行
- 单人操作与批量操作都走同一修正接口
- 操作成功后统一刷新名单和摘要
- 仅补最小必要 CSS，避免新增大块散落样式
- 在新增组件和重写页面里补足中文维护注释，解释状态联动与刷新边界

**Step 3: 跑测试确认通过**

Run: `cd web && npm test -- --run src/pages/activity-roster/ActivityRosterPage.test.tsx src/app/App.test.tsx src/pages/activity-detail/ActivityDetailPage.test.tsx`
Expected: PASS。

**Step 4: 提交**

```bash
git add web/src/features/staff/api.ts web/src/features/staff/components/AttendanceBatchActionBar.tsx web/src/features/staff/components/AttendanceRosterList.tsx web/src/pages/activity-roster/ActivityRosterPage.tsx web/src/pages/activity-roster/ActivityRosterPage.test.tsx web/src/app/styles/base.css web/src/app/App.test.tsx web/src/pages/activity-detail/ActivityDetailPage.test.tsx
git commit -m "feat(web): 支持参会名单查看与状态修正"
```

### Task 7: 联合验证与收尾

**Files:**
- Modify: any touched file from previous tasks if verification reveals regressions

**Step 1: 跑 Web 测试**

Run: `cd web && npm test -- --run`
Expected: PASS。

**Step 2: 跑 Web 构建**

Run: `cd web && npm run build`
Expected: PASS。

**Step 3: 跑 Backend 测试**

Run: `cd backend && ./mvnw test`
Expected: PASS。

**Step 4: 检查工作区**

Run: `cd /home/psx/app/wxapp-checkin && git status --short`
Expected: 只看到本轮待提交改动，且不包含敏感配置文件。

**Step 5: 提交最终补丁**

```bash
git add web backend
git commit -m "feat: 支持活动参会名单与状态修正"
```

**Step 6: 再次确认工作区干净**

Run: `cd /home/psx/app/wxapp-checkin && git status --short`
Expected: 空输出。

---

Plan complete and saved to `docs/plans/2026-03-18-activity-attendance-roster-implementation-plan.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

当前用户已经明确要求继续，我默认按 `1. Subagent-Driven` 在本会话直接执行；但受当前会话工具约束，本轮实现仍以本代理本地逐步执行、按 TDD 节奏推进为准。
