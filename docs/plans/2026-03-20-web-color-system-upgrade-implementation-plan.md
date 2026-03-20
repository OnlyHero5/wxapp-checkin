# 手机 Web 业务态增色实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变业务流程、接口契约和路由结构的前提下，为 `wxapp-checkin/web` 建立一套覆盖全站的“默认品牌层 + 业务态角色色”视觉系统，让登录、列表、详情、签到、签退、管理、名单和个人中心都具备更明确的色彩识别。

**Architecture:** 先在共享层建立 `VisualTone` 概念和全局 CSS token，再把 tone 逐步传入 `MobilePage`、`AppButton`、`ActivityMetaPanel`、`CodeInput`、`DynamicCodePanel` 等重复度最高的组件，最后把 tone 挂到各业务页面。测试以现有 Vitest + React Testing Library 为主，优先验证 tone 数据属性、类名和关键文案是否随业务态正确切换。

**Tech Stack:** React 18、TypeScript、Vite、Vitest、React Testing Library、tdesign-mobile-react、CSS Variables

---

### Task 1: 建立共享 tone 模型与页面壳层入口

**Files:**
- Create: `web/src/shared/ui/visual-tone.ts`
- Create: `web/src/shared/ui/MobilePage.test.tsx`
- Create: `web/src/shared/ui/AppButton.test.tsx`
- Modify: `web/src/shared/ui/MobilePage.tsx`
- Modify: `web/src/shared/ui/AppButton.tsx`
- Modify: `web/src/app/styles/base.css`

**Step 1: Write the failing tests**

```tsx
render(
  <MobilePage title="活动签到" tone="checkin">
    <p>content</p>
  </MobilePage>
);

expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkin");
expect(screen.getByRole("button", { name: "提交" })).toHaveClass("app-button--accent-checkin");
```

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/shared/ui/MobilePage.test.tsx src/shared/ui/AppButton.test.tsx`

Expected: FAIL because `MobilePage` and `AppButton` 还不支持 tone 数据属性或业务态 class。

**Step 3: Write minimal implementation**

```ts
export type VisualTone = "brand" | "default" | "checkin" | "checkout" | "staff";
```

```tsx
<main className="mobile-page" data-page-tone={tone}>
```

```tsx
className={`app-button app-button--${tone} app-button--accent-${accentTone}`}
```

在 `base.css` 中新增首批 tone token 和 `data-page-tone` / `app-button--accent-*` 对应选择器，但只先覆盖页头和按钮，不扩散到其他组件。

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/shared/ui/MobilePage.test.tsx src/shared/ui/AppButton.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade
git add web/src/shared/ui/visual-tone.ts web/src/shared/ui/MobilePage.tsx web/src/shared/ui/MobilePage.test.tsx web/src/shared/ui/AppButton.tsx web/src/shared/ui/AppButton.test.tsx web/src/app/styles/base.css
git commit -m "feat(web): 建立页面业务态色彩基线"
```

### Task 2: 收口活动卡、状态标签与底部导航的色彩映射

**Files:**
- Create: `web/src/shared/ui/StatusTag.test.tsx`
- Modify: `web/src/shared/ui/ActivityMetaPanel.tsx`
- Modify: `web/src/shared/ui/StatusTag.tsx`
- Modify: `web/src/shared/ui/AppBusinessNav.tsx`
- Modify: `web/src/features/activities/components/ActivityCard.tsx`
- Modify: `web/src/features/activities/components/ActivityCard.test.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.test.tsx`
- Modify: `web/src/app/styles/base.css`

**Step 1: Write the failing tests**

```tsx
expect(screen.getByText("进行中")).toHaveClass("status-tag--ongoing");
expect(screen.getByRole("link", { name: "活动" })).toHaveClass("page-bottom-nav__item--accent-staff");
expect(screen.getByText("进入管理").closest("article")).toHaveAttribute("data-panel-tone", "staff");
```

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/shared/ui/StatusTag.test.tsx src/features/activities/components/ActivityCard.test.tsx src/pages/activities/ActivitiesPage.test.tsx`

Expected: FAIL because 标签、卡片和导航还没有明确的 tone class / data attribute。

**Step 3: Write minimal implementation**

```tsx
<Container className="activity-meta-panel" data-panel-tone={tone}>
```

```tsx
<Tag className={`status-tag status-tag--${status}`}>
```

```tsx
const navTone = pathname === "/profile" ? "brand" : "staff";
```

把活动卡的 tone 规则定死：

- 普通用户列表：`brand`
- 工作人员列表：`staff`

同时在 `base.css` 中补 `activity-meta-panel`、`status-tag`、`page-bottom-nav__item` 的 tone 变体。

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/shared/ui/StatusTag.test.tsx src/features/activities/components/ActivityCard.test.tsx src/pages/activities/ActivitiesPage.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade
git add web/src/shared/ui/ActivityMetaPanel.tsx web/src/shared/ui/StatusTag.tsx web/src/shared/ui/StatusTag.test.tsx web/src/shared/ui/AppBusinessNav.tsx web/src/features/activities/components/ActivityCard.tsx web/src/features/activities/components/ActivityCard.test.tsx web/src/pages/activities/ActivitiesPage.tsx web/src/pages/activities/ActivitiesPage.test.tsx web/src/app/styles/base.css
git commit -m "feat(web): 强化活动卡与导航色彩识别"
```

### Task 3: 覆盖登录、改密与个人中心的品牌态页面

**Files:**
- Modify: `web/src/pages/login/LoginPage.tsx`
- Modify: `web/src/features/auth/components/AccountLoginForm.tsx`
- Modify: `web/src/pages/login/LoginPage.test.tsx`
- Modify: `web/src/pages/change-password/ChangePasswordPage.tsx`
- Modify: `web/src/features/auth/components/ChangePasswordForm.tsx`
- Modify: `web/src/pages/change-password/ChangePasswordPage.test.tsx`
- Modify: `web/src/pages/profile/ProfilePage.tsx`
- Modify: `web/src/pages/profile/ProfilePage.test.tsx`
- Modify: `web/src/app/styles/base.css`

**Step 1: Write the failing tests**

```tsx
expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "brand");
expect(screen.getByRole("button", { name: "登录" })).toHaveClass("app-button--accent-brand");
expect(screen.getByRole("button", { name: "退出登录" })).toHaveClass("app-button--accent-brand");
```

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/pages/login/LoginPage.test.tsx src/pages/change-password/ChangePasswordPage.test.tsx src/pages/profile/ProfilePage.test.tsx`

Expected: FAIL because这些页面还没有显式传入品牌态 tone。

**Step 3: Write minimal implementation**

```tsx
<MobilePage eyebrow="欢迎回来" tone="brand" title="登录">
```

```tsx
<AppButton accentTone="brand" type="submit">
```

让登录、改密、个人中心都固定走品牌态，并在 `base.css` 中给表单外壳、提示条、个人中心摘要卡补品牌态高光和边框层次。

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/pages/login/LoginPage.test.tsx src/pages/change-password/ChangePasswordPage.test.tsx src/pages/profile/ProfilePage.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade
git add web/src/pages/login/LoginPage.tsx web/src/features/auth/components/AccountLoginForm.tsx web/src/pages/login/LoginPage.test.tsx web/src/pages/change-password/ChangePasswordPage.tsx web/src/features/auth/components/ChangePasswordForm.tsx web/src/pages/change-password/ChangePasswordPage.test.tsx web/src/pages/profile/ProfilePage.tsx web/src/pages/profile/ProfilePage.test.tsx web/src/app/styles/base.css
git commit -m "feat(web): 统一品牌态表单与个人中心观感"
```

### Task 4: 覆盖详情页、签到页与签退页的动作态

**Files:**
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`
- Modify: `web/src/features/attendance/components/CodeInput.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.test.tsx`
- Modify: `web/src/pages/checkout/CheckoutPage.tsx`
- Modify: `web/src/app/styles/base.css`

**Step 1: Write the failing tests**

```tsx
expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkin");
expect(screen.getByLabelText("签到验证码")).toHaveClass("code-input--tone-checkin");
expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "checkout");
```

对详情页补一条场景测试：

```tsx
expect(screen.getByRole("button", { name: "去签到" })).toHaveClass("app-button--accent-checkin");
expect(screen.getByRole("button", { name: "去签退" })).toHaveClass("app-button--accent-checkout");
```

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/pages/activity-detail/ActivityDetailPage.test.tsx src/pages/checkin/CheckinPage.test.tsx`

Expected: FAIL because动作页和详情页还没有传 tone，也没有 code input tone class。

**Step 3: Write minimal implementation**

```tsx
<CodeInput label={resolveInputLabel(actionType)} tone={actionType}>
```

```tsx
<MobilePage tone={actionType === "checkout" ? "checkout" : "checkin"}>
```

```tsx
<AppButton accentTone="checkin">去签到</AppButton>
<AppButton accentTone="checkout" tone="secondary">去签退</AppButton>
```

在 `base.css` 中加入签到态 / 签退态的输入框、提示条、结果卡和按钮表面色。

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/pages/activity-detail/ActivityDetailPage.test.tsx src/pages/checkin/CheckinPage.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade
git add web/src/pages/activity-detail/ActivityDetailPage.tsx web/src/pages/activity-detail/ActivityDetailPage.test.tsx web/src/features/attendance/components/CodeInput.tsx web/src/pages/checkin/CheckinPage.tsx web/src/pages/checkin/CheckinPage.test.tsx web/src/pages/checkout/CheckoutPage.tsx web/src/app/styles/base.css
git commit -m "feat(web): 区分签到与签退动作色彩"
```

### Task 5: 覆盖工作人员管理页与名单页的管理态

**Files:**
- Create: `web/src/features/staff/components/DynamicCodePanel.test.tsx`
- Modify: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.test.tsx`
- Modify: `web/src/pages/activity-roster/ActivityRosterPage.tsx`
- Modify: `web/src/pages/activity-roster/ActivityRosterPage.test.tsx`
- Modify: `web/src/app/styles/base.css`

**Step 1: Write the failing tests**

```tsx
expect(screen.getByRole("main")).toHaveAttribute("data-page-tone", "staff");
expect(screen.getByText("123456").closest(".staff-code-panel")).toHaveAttribute("data-panel-tone", "staff");
expect(screen.getByRole("button", { name: "立即刷新" })).toHaveClass("app-button--accent-staff");
```

名单页补一条批量栏断言：

```tsx
expect(screen.getByText(/已选择/).closest(".roster-batch-bar")).toHaveAttribute("data-panel-tone", "staff");
```

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/features/staff/components/DynamicCodePanel.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx src/pages/activity-roster/ActivityRosterPage.test.tsx`

Expected: FAIL because管理页组件还没有显式 staff tone。

**Step 3: Write minimal implementation**

```tsx
<section className="staff-panel" data-panel-tone="staff">
```

```tsx
<MobilePage eyebrow="工作人员" tone="staff" title="活动管理">
```

让管理页和名单页共用 staff tone，并在动态码页签内部继续用青绿 / 橙色细分签到码和签退码。

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/features/staff/components/DynamicCodePanel.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx src/pages/activity-roster/ActivityRosterPage.test.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade
git add web/src/features/staff/components/DynamicCodePanel.tsx web/src/features/staff/components/DynamicCodePanel.test.tsx web/src/pages/staff-manage/StaffManagePage.tsx web/src/pages/staff-manage/StaffManagePage.test.tsx web/src/pages/activity-roster/ActivityRosterPage.tsx web/src/pages/activity-roster/ActivityRosterPage.test.tsx web/src/app/styles/base.css
git commit -m "feat(web): 强化工作人员管理态视觉层级"
```

### Task 6: 全量样式收尾、回归验证与产物清理

**Files:**
- Modify: `web/src/app/styles/base.css`
- Inspect: `web/src/main.tsx`
- Inspect: `web/src/app/router.tsx`
- Verify: `web/src/app/App.test.tsx`
- Verify: `web/src/test/vite-config.test.ts`

**Step 1: Write the final regression assertions if needed**

如果前面没有覆盖到全局 tone 回退逻辑，可在 `web/src/app/App.test.tsx` 或新增轻量测试中补一条：

```tsx
expect(screen.getByRole("main")).toHaveAttribute("data-page-tone");
```

**Step 2: Run focused regression**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test -- src/app/App.test.tsx src/test/vite-config.test.ts`

Expected: PASS。

**Step 3: Run full verification**

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm test`

Expected: PASS with all existing and新增用例通过。

Run: `cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade/web && npm run build`

Expected: PASS and输出生产构建。

**Step 4: Clean build artifacts from git status**

确认 `web/dist` 中因本地构建生成的未跟踪文件没有留在工作区里，`git status --short` 只剩本次真实源代码与文档改动；提交前把生成产物清理掉。

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin/.worktrees/web-color-system-upgrade
git add web/src app docs/plans
git commit -m "feat(web): 完成手机 Web 业务态增色升级"
```
