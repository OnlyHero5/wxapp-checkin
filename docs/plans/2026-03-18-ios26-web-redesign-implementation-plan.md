# iOS26 Web Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the `wxapp-checkin/web` mobile UI into a restrained iOS 26-inspired experience without changing routes, APIs, or business behavior.

**Architecture:** The redesign is shared-layer first. Update the global tokens and layout shell in `base.css`, then refactor shared UI primitives so page-level components inherit the new structure with minimal bespoke styling. Preserve TDesign Mobile as the control primitive layer and keep business logic untouched.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, `tdesign-mobile-react`, CSS

---

### Task 1: 写入设计基线文档并固定实施入口

**Files:**
- Create: `docs/plans/2026-03-18-ios26-web-redesign-design.md`
- Create: `docs/plans/2026-03-18-ios26-web-redesign-implementation-plan.md`

**Step 1: 写入设计文档**

- 用中文记录视觉目标、组件边界、页面落地策略、Apple 资料依据和非目标。

**Step 2: 检查文档存在且内容完整**

Run: `sed -n '1,220p' docs/plans/2026-03-18-ios26-web-redesign-design.md`
Expected: 能看到设计目标、视觉语言、组件改造和验证原则。

**Step 3: 提交文档**

```bash
git add docs/plans/2026-03-18-ios26-web-redesign-design.md docs/plans/2026-03-18-ios26-web-redesign-implementation-plan.md
git commit -m "docs: 落定 iOS26 Web 重塑方案"
```

### Task 2: 先写共享壳层回归测试

**Files:**
- Modify: `web/src/app/App.test.tsx`
- Modify: `web/src/pages/login/LoginPage.test.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.test.tsx`

**Step 1: 写 failing tests**

- 给 `App.test.tsx` 增加对新壳层结构的断言，例如头部标题区域与主内容容器。
- 给 `LoginPage.test.tsx` 增加对登录页新头部和主操作层级的断言。
- 给 `StaffManagePage.test.tsx` 增加对动态码主区、分段切换和统计区结构的断言。

**Step 2: 跑单测确认失败**

Run: `cd web && npm test -- src/app/App.test.tsx src/pages/login/LoginPage.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx`
Expected: FAIL，且失败原因来自新增结构断言不存在。

**Step 3: 准备最小实现**

- 不先动业务逻辑，只为新视觉结构增加必要的 JSX 和 className。

**Step 4: 跑同一批单测确认通过**

Run: `cd web && npm test -- src/app/App.test.tsx src/pages/login/LoginPage.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx`
Expected: PASS。

**Step 5: 提交**

```bash
git add web/src/app/App.test.tsx web/src/pages/login/LoginPage.test.tsx web/src/pages/staff-manage/StaffManagePage.test.tsx
git commit -m "test(web): 补共享壳层重塑回归用例"
```

### Task 3: 重做全局 token 和页面壳层

**Files:**
- Modify: `web/src/app/styles/base.css`
- Modify: `web/src/shared/ui/MobilePage.tsx`

**Step 1: 写 failing tests**

- 在现有测试里断言 `MobilePage` 输出新的头部区域、内容容器和可选描述区域。

**Step 2: 跑测试确认失败**

Run: `cd web && npm test -- src/app/App.test.tsx`
Expected: FAIL。

**Step 3: 写最小实现**

- 在 `base.css` 中引入新的颜色 token、材质层级、安全区留白和轻玻璃头部样式。
- 在 `MobilePage.tsx` 中加入头部层、可选说明位、主体层容器。
- 保持 API 尽量兼容，避免页面一次性大爆炸。

**Step 4: 跑测试确认通过**

Run: `cd web && npm test -- src/app/App.test.tsx`
Expected: PASS。

**Step 5: 提交**

```bash
git add web/src/app/styles/base.css web/src/shared/ui/MobilePage.tsx
git commit -m "feat(web): 重构移动端页面壳层"
```

### Task 4: 重做共享信息组件和按钮层级

**Files:**
- Modify: `web/src/shared/ui/ActivityMetaPanel.tsx`
- Modify: `web/src/shared/ui/AppButton.tsx`
- Modify: `web/src/shared/ui/InlineNotice.tsx`
- Modify: `web/src/shared/ui/StatusTag.tsx`
- Test: `web/src/features/activities/components/ActivityCard.test.tsx`

**Step 1: 写 failing tests**

- 扩展 `ActivityCard.test.tsx`，断言活动摘要卡的关键信息分区、动作区和状态标签仍正确渲染。

**Step 2: 跑测试确认失败**

Run: `cd web && npm test -- src/features/activities/components/ActivityCard.test.tsx`
Expected: FAIL。

**Step 3: 写最小实现**

- 把 `ActivityMetaPanel` 改为更清晰的摘要卡结构。
- 统一 `AppButton` 的主次按钮 class。
- 为 `InlineNotice`、`StatusTag` 补项目级 class，收口观感。

**Step 4: 跑测试确认通过**

Run: `cd web && npm test -- src/features/activities/components/ActivityCard.test.tsx`
Expected: PASS。

**Step 5: 提交**

```bash
git add web/src/shared/ui/ActivityMetaPanel.tsx web/src/shared/ui/AppButton.tsx web/src/shared/ui/InlineNotice.tsx web/src/shared/ui/StatusTag.tsx web/src/features/activities/components/ActivityCard.test.tsx
git commit -m "feat(web): 收口活动卡片与按钮视觉层级"
```

### Task 5: 重做动态码输入与管理员动态码面板

**Files:**
- Modify: `web/src/features/attendance/components/CodeInput.tsx`
- Modify: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Test: `web/src/pages/checkin/CheckinPage.test.tsx`
- Test: `web/src/pages/staff-manage/StaffManagePage.test.tsx`

**Step 1: 写 failing tests**

- 在签到页测试中断言六码输入区的可视结构和提交状态。
- 在管理员页测试中断言动态码主区、统计面板和刷新/批量动作层级。

**Step 2: 跑测试确认失败**

Run: `cd web && npm test -- src/pages/checkin/CheckinPage.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx`
Expected: FAIL。

**Step 3: 写最小实现**

- 保留真实输入逻辑，增强 `CodeInput` 视觉分段和提示层级。
- 用 `Tabs + CellGroup + AppButton` 重排 `DynamicCodePanel`。
- 让 `StaffManagePage` 以新壳层组织摘要、动态码、统计和批量动作。

**Step 4: 跑测试确认通过**

Run: `cd web && npm test -- src/pages/checkin/CheckinPage.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx`
Expected: PASS。

**Step 5: 提交**

```bash
git add web/src/features/attendance/components/CodeInput.tsx web/src/features/staff/components/DynamicCodePanel.tsx web/src/pages/staff-manage/StaffManagePage.tsx web/src/pages/checkin/CheckinPage.test.tsx web/src/pages/staff-manage/StaffManagePage.test.tsx
git commit -m "feat(web): 强化动态码输入与管理页展示"
```

### Task 6: 重做登录、列表、详情与输入页组合

**Files:**
- Modify: `web/src/pages/login/LoginPage.tsx`
- Modify: `web/src/pages/change-password/ChangePasswordPage.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.tsx`
- Modify: `web/src/pages/checkout/CheckoutPage.tsx`
- Test: `web/src/pages/activities/ActivitiesPage.test.tsx`
- Test: `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`
- Test: `web/src/pages/login/LoginPage.test.tsx`
- Test: `web/src/pages/checkin/CheckinPage.test.tsx`

**Step 1: 写 failing tests**

- 更新页面测试，使其断言新的页面分区、主按钮和信息层级。

**Step 2: 跑测试确认失败**

Run: `cd web && npm test -- src/pages/activities/ActivitiesPage.test.tsx src/pages/activity-detail/ActivityDetailPage.test.tsx src/pages/login/LoginPage.test.tsx src/pages/checkin/CheckinPage.test.tsx`
Expected: FAIL。

**Step 3: 写最小实现**

- 页面尽量只重组共享组件，不复制样式。
- 删除弱价值说明段落，保留必要上下文。
- 调整主次按钮顺序和页面内容分组。

**Step 4: 跑测试确认通过**

Run: `cd web && npm test -- src/pages/activities/ActivitiesPage.test.tsx src/pages/activity-detail/ActivityDetailPage.test.tsx src/pages/login/LoginPage.test.tsx src/pages/checkin/CheckinPage.test.tsx`
Expected: PASS。

**Step 5: 提交**

```bash
git add web/src/pages/login/LoginPage.tsx web/src/pages/change-password/ChangePasswordPage.tsx web/src/pages/activities/ActivitiesPage.tsx web/src/pages/activity-detail/ActivityDetailPage.tsx web/src/pages/checkin/CheckinPage.tsx web/src/pages/checkout/CheckoutPage.tsx web/src/pages/activities/ActivitiesPage.test.tsx web/src/pages/activity-detail/ActivityDetailPage.test.tsx web/src/pages/login/LoginPage.test.tsx web/src/pages/checkin/CheckinPage.test.tsx
git commit -m "feat(web): 重塑登录与活动主链路页面"
```

### Task 7: 全量验证与收尾

**Files:**
- Modify: `web/src/app/styles/base.css`
- Modify: any touched file from previous tasks if verification reveals regressions

**Step 1: 跑完整测试**

Run: `cd web && npm test`
Expected: PASS。

**Step 2: 跑构建**

Run: `cd web && npm run build`
Expected: PASS。

**Step 3: 检查 git 状态**

Run: `git status --short`
Expected: 只看到本次待提交改动。

**Step 4: 提交最终代码**

```bash
git add web
git commit -m "feat(web): 以 iOS26 风格重塑移动端界面"
```

**Step 5: 再次确认工作区干净**

Run: `git status --short`
Expected: 空输出。

---

Plan complete and saved to `docs/plans/2026-03-18-ios26-web-redesign-implementation-plan.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

当前用户已经明确要求继续，我默认按 `1. Subagent-Driven` 在本会话直接执行。
