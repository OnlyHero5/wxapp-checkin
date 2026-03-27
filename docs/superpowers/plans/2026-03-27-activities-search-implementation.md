# wxapp-checkin 活动列表搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `wxapp-checkin/web` 的活动列表页实现搜索框、服务端分页搜索和列表读路径优化，同时保持组件库优先和现有权限边界不回退。

**Architecture:** 继续复用 `GET /api/web/activities`，通过新增可选 `keyword` 参数把搜索下沉到 Rust 后端，再由前端列表页使用 TDesign `Search` 组件驱动分页联动。后端同时把当前列表读路径里的 N+1 用户状态查询收口成批量读取，保证搜索开启后数据库压力不会因为每页逐条补查而被放大。

**Tech Stack:** React 18、Vite、Vitest、React Testing Library、tdesign-mobile-react 0.21.2、Rust、axum、sqlx(MySQL)

---

### Task 1: 锁定前端搜索与分页契约

**Files:**
- Create: `web/src/features/activities/api.test.ts`
- Modify: `web/src/features/activities/api.ts`
- Modify: `web/src/pages/activities/ActivitiesPage.test.tsx`

- [x] **Step 1: 先给 `getActivities` 扩展 `keyword` 查询参数的测试覆盖，锁定 query string 行为**
- [x] **Step 2: 给 `ActivitiesPage` 增加“提交搜索后重置到第一页”“搜索后加载更多继续带 keyword”“清空搜索恢复默认列表”“无结果稳定空态”的失败测试**
- [x] **Step 3: 运行前端针对性测试，确认新增测试先失败**

### Task 2: 锁定后端关键字归一化与仓储辅助函数契约

**Files:**
- Modify: `backend-rust/src/service/activity_service.rs`
- Modify: `backend-rust/src/db/activity_repo.rs`

- [x] **Step 1: 在 `activity_service.rs` 中补 `keyword` 归一化相关单测，覆盖 `None`、空白、正常值、超长值**
- [x] **Step 2: 在 `activity_repo.rs` 中补 LIKE 转义与 pattern 组装单测，锁定 `%`、`_`、`legacy_act_123` 的行为**
- [x] **Step 3: 运行 Rust 针对性测试，确认这些测试先失败**

### Task 3: 实现后端分页搜索与批量状态读取

**Files:**
- Modify: `backend-rust/src/api/activity.rs`
- Modify: `backend-rust/src/service/activity_service.rs`
- Modify: `backend-rust/src/db/activity_repo.rs`

- [x] **Step 1: 扩展 `ActivityListQuery` 和 `list_activities` service 签名，把 `keyword` 从 API 层传到 service 层**
- [x] **Step 2: 在 service 层新增 `normalize_keyword`，统一做 trim、空值折叠和长度校验**
- [x] **Step 3: 在仓储层为 staff / normal 列表增加关键字过滤，并保持原有权限约束和分页排序**
- [x] **Step 4: 新增按活动 ID 批量读取用户状态的仓储函数，替换当前逐条 `find_user_activity` 的 N+1 读法**
- [x] **Step 5: 运行 Rust 针对性测试，确认后端读路径与纯函数测试转绿**

### Task 4: 用组件库 Search 接入前端列表页

**Files:**
- Modify: `web/src/features/activities/api.ts`
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.test.tsx`

- [x] **Step 1: 扩展 `getActivities` 入参，统一通过 `URLSearchParams` 传递 `keyword`**
- [x] **Step 2: 在 `ActivitiesPage` 中新增 `draftKeyword` / `keyword` 状态，并把首次加载、重新加载、搜索提交、清空搜索、加载更多统一到同一套请求逻辑**
- [x] **Step 3: 使用 `tdesign-mobile-react` 的 `Search` 组件渲染搜索框，不新增手写输入框组件、不用伪组件化包裹层复刻搜索功能**
- [x] **Step 4: 对搜索结果的空态继续复用现有组件库空态出口，不新增手写空态面板**
- [x] **Step 5: 运行前端针对性测试，确认页面搜索链路转绿**

### Task 5: 全量验证、文档同步与提交

**Files:**
- Modify: `docs/superpowers/plans/2026-03-27-activities-search-implementation.md`
- Modify: `task_plan.md`
- Modify: `findings.md`
- Modify: `progress.md`

- [x] **Step 1: 更新计划与记录文件，写明本轮实现结果、关键设计约束和验证结论**
- [x] **Step 2: 运行 `cd web && npm test`**
- [x] **Step 3: 运行 `cd web && npm run lint`**
- [x] **Step 4: 运行 `cd web && npm run build`**
- [x] **Step 5: 运行 `cd backend-rust && cargo test`**
- [x] **Step 6: 检查 `git status --short`，确认只包含本轮相关变更**
- [ ] **Step 7: 在 `wxapp-checkin` 子仓库提交本轮实现，保持工作区干净**
