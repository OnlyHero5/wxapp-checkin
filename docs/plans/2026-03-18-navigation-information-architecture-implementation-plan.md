# Web 导航信息架构重构 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `wxapp-checkin/web` 的导航从“混合底部栏”重构为“活动 / 我的”两级信息架构，并补齐个人中心页面。

**Architecture:** 在受保护业务路由外层增加统一业务壳层，集中渲染顶级导航并做激活态映射。活动子页面全部归属 `活动` 域，列表页内部再用页内二级导航承载 `进行中 / 历史活动`，同时新增 `ProfilePage` 承接个人信息、改密入口和退出登录。

**Tech Stack:** React、React Router、TypeScript、Vite、Vitest、tdesign-mobile-react、现有 `shared/ui` 共享层

---

### Task 1: 建立业务态全局导航壳层

**Files:**
- Create: `web/src/shared/ui/AppBusinessNav.tsx`
- Modify: `web/src/shared/ui/MobilePage.tsx`
- Modify: `web/src/app/router.tsx`
- Modify: `web/src/app/styles/base.css`
- Test: `web/src/app/App.test.tsx`

**Step 1: Write the failing test**

在 `web/src/app/App.test.tsx` 新增用例，断言：

- 已登录访问 `/activities` 时显示顶级导航 `活动 / 我的`
- 已登录访问 `/activities/test-1/checkin` 时顶级导航仍高亮 `活动`
- 未登录访问 `/login` 时不显示业务态顶级导航

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/app/App.test.tsx`

Expected:

- FAIL，原因是当前没有统一业务态导航壳层，也没有 `我的` 顶级入口

**Step 3: Write minimal implementation**

实现要点：

- 新建 `AppBusinessNav.tsx`
- 只渲染两个顶级入口：`活动`、`我的`
- 用当前 pathname 判断激活态
- `MobilePage` 保留页面内容容器职责，不再要求每个页面自己拼顶级底部栏
- `router.tsx` 为所有受保护业务页包一层统一壳层

建议实现骨架：

```tsx
const activityMatchers = [
  /^\/activities(\/.*)?$/,
  /^\/staff\/activities(\/.*)?$/
];

function resolveBusinessNavKey(pathname: string) {
  if (activityMatchers.some((pattern) => pattern.test(pathname))) {
    return "activities";
  }
  if (pathname === "/profile") {
    return "profile";
  }
  return "";
}
```

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/app/App.test.tsx`

Expected:

- PASS，业务态页面都能看到统一顶级导航

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin
git add web/src/shared/ui/AppBusinessNav.tsx web/src/shared/ui/MobilePage.tsx web/src/app/router.tsx web/src/app/styles/base.css web/src/app/App.test.tsx
git commit -m "feat(web): 收口业务态顶级导航"
```

### Task 2: 移除活动子页面对混合底部栏的误用

**Files:**
- Modify: `web/src/shared/ui/PageBottomNav.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Modify: `web/src/pages/activity-roster/ActivityRosterPage.tsx`
- Test: `web/src/pages/activity-detail/ActivityDetailPage.test.tsx`
- Test: `web/src/pages/checkin/CheckinPage.test.tsx`
- Test: `web/src/pages/staff-manage/StaffManagePage.test.tsx`

**Step 1: Write the failing test**

新增或调整测试，断言：

- 活动详情页不再出现把 `活动列表 / 活动详情` 并排渲染成 tab 的结构
- 签到页结果态和输入态不再把返回链路伪装成底部导航
- 管理页和名单页继续有返回入口，但不再自己渲染顶级 tab

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/pages/activity-detail/ActivityDetailPage.test.tsx src/pages/checkin/CheckinPage.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx`

Expected:

- FAIL，原因是这些页面当前仍在直接使用 `PageBottomNav`

**Step 3: Write minimal implementation**

实现要点：

- `PageBottomNav` 不再承担顶级导航职责
- 活动详情、签到、管理、名单页改成页头返回或文本返回
- 页面只保留和当前内容强相关的操作按钮

建议处理方式：

- 若 `MobilePage` 已支持 header back action，则统一接入
- 若尚未支持，可先在标题区下方保留一个稳定的 `返回活动列表` 或 `返回活动详情` 文本入口

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/pages/activity-detail/ActivityDetailPage.test.tsx src/pages/checkin/CheckinPage.test.tsx src/pages/staff-manage/StaffManagePage.test.tsx`

Expected:

- PASS，活动子页面不再伪装顶级导航

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin
git add web/src/shared/ui/PageBottomNav.tsx web/src/pages/activities/ActivitiesPage.tsx web/src/pages/activity-detail/ActivityDetailPage.tsx web/src/pages/checkin/CheckinPage.tsx web/src/pages/staff-manage/StaffManagePage.tsx web/src/pages/activity-roster/ActivityRosterPage.tsx web/src/pages/activity-detail/ActivityDetailPage.test.tsx web/src/pages/checkin/CheckinPage.test.tsx web/src/pages/staff-manage/StaffManagePage.test.tsx
git commit -m "fix(web): 纠正活动子页面导航层级"
```

### Task 3: 新增个人中心页面与路由

**Files:**
- Create: `web/src/pages/profile/ProfilePage.tsx`
- Create: `web/src/pages/profile/ProfilePage.test.tsx`
- Modify: `web/src/app/router.tsx`
- Modify: `web/src/shared/session/session-store.ts`
- Modify: `web/src/app/styles/base.css`

**Step 1: Write the failing test**

在 `ProfilePage.test.tsx` 新增用例，断言：

- 页面能展示 `name / student_id / department / club`
- staff 登录态能显示角色或权限提示
- 页面包含 `修改密码` 和 `退出登录` 动作

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/pages/profile/ProfilePage.test.tsx`

Expected:

- FAIL，原因是页面和路由都不存在

**Step 3: Write minimal implementation**

实现要点：

- 从 `session-store` 读取 `user_profile / role / permissions`
- 第一版只展示本地已有信息，不额外发新请求
- `退出登录` 直接调用 `clearSession()` 后跳 `/login`
- `修改密码` 先接现有改密页能力

建议页面结构：

```tsx
<MobilePage eyebrow="个人中心" title="我的">
  <section className="profile-summary-card">...</section>
  <section className="profile-actions-card">...</section>
</MobilePage>
```

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/pages/profile/ProfilePage.test.tsx`

Expected:

- PASS，个人中心基础信息和动作完整可见

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin
git add web/src/pages/profile/ProfilePage.tsx web/src/pages/profile/ProfilePage.test.tsx web/src/app/router.tsx web/src/shared/session/session-store.ts web/src/app/styles/base.css
git commit -m "feat(web): 新增个人中心页面"
```

### Task 4: 把活动列表页的二级分段收回页面内部

**Files:**
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/app/styles/base.css`
- Test: `web/src/pages/activities/ActivitiesPage.test.tsx`

**Step 1: Write the failing test**

调整测试，断言：

- 活动列表页存在清晰的页内二级分段：`进行中`、`历史活动`
- 分段切换或锚点入口位于内容区内部，而不是业务态全局底部导航
- 普通用户和 staff 都仍能看到正确分组

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/pages/activities/ActivitiesPage.test.tsx`

Expected:

- FAIL，原因是当前活动页仍依赖 `PageBottomNav` 渲染分组锚点

**Step 3: Write minimal implementation**

实现要点：

- 二级分段改为页面头部附近的 tabs / segmented control / anchor chips
- 保持当前 `groupVisibleActivities` 的业务分组逻辑不变
- 不在全局导航区域承载这两个分组

推荐优先级：

- 优先用 `tdesign-mobile-react` 已有 tabs 或项目现有共享样式
- 若只保留锚点跳转，也应把入口挪到活动页内容头部

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/pages/activities/ActivitiesPage.test.tsx`

Expected:

- PASS，活动分组保留，但语义已降为页内二级导航

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin
git add web/src/pages/activities/ActivitiesPage.tsx web/src/app/styles/base.css web/src/pages/activities/ActivitiesPage.test.tsx
git commit -m "refactor(web): 收口活动页二级分段导航"
```

### Task 5: 放开个人中心自助改密入口

**Files:**
- Modify: `web/src/app/router.tsx`
- Modify: `web/src/pages/change-password/ChangePasswordPage.tsx`
- Modify: `web/src/pages/change-password/ChangePasswordPage.test.tsx`
- Modify: `web/src/pages/profile/ProfilePage.tsx`

**Step 1: Write the failing test**

新增测试，断言：

- 已登录且不处于强制改密状态的用户，也可以从 `我的` 页进入改密页
- 改密成功后返回 `我的` 或活动页，不会被路由守卫立即踢回 `/activities`

**Step 2: Run test to verify it fails**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/pages/change-password/ChangePasswordPage.test.tsx src/pages/profile/ProfilePage.test.tsx`

Expected:

- FAIL，原因是当前 `/change-password` 只允许强制改密场景进入

**Step 3: Write minimal implementation**

实现要点：

- 保留“强制改密优先”的原规则
- 增加“自助改密模式”入口
- 区分进入来源，避免改密成功后一律跳活动页

推荐方式：

- 使用 query 参数或 location state 标识 `self_service`
- `PasswordChangeRoute` 在有会话时允许两种模式进入

**Step 4: Run test to verify it passes**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run src/pages/change-password/ChangePasswordPage.test.tsx src/pages/profile/ProfilePage.test.tsx`

Expected:

- PASS，自助改密和强制改密两条链路都成立

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin
git add web/src/app/router.tsx web/src/pages/change-password/ChangePasswordPage.tsx web/src/pages/change-password/ChangePasswordPage.test.tsx web/src/pages/profile/ProfilePage.tsx
git commit -m "feat(web): 打通个人中心改密入口"
```

### Task 6: 执行全量验证并更新文档

**Files:**
- Modify: `docs/changes.md`
- Modify: `README.md`

**Step 1: Write the failing test**

这一步以验证命令和文档核对为主，不新增业务测试文件，但必须确认：

- 现有页面测试全部通过
- 构建通过
- 文档中明确说明导航层级调整和个人中心落地

**Step 2: Run verification commands**

Run: `cd /home/psx/app/wxapp-checkin/web && npm test -- --run`

Expected:

- PASS，现有页面与新增页面测试全绿

Run: `cd /home/psx/app/wxapp-checkin/web && npm run build`

Expected:

- PASS，`dist/` 成功产出

**Step 3: Write minimal documentation updates**

更新内容：

- `docs/changes.md` 记录“活动 / 我的”顶级导航收口
- `README.md` 或相关 Web 文档补充个人中心与导航层级说明

**Step 4: Re-run verification if docs changed alongside code**

Run: `cd /home/psx/app/wxapp-checkin && git status --short`

Expected:

- 只剩本任务文档改动，确认无脏文件遗漏

**Step 5: Commit**

```bash
cd /home/psx/app/wxapp-checkin
git add docs/changes.md README.md
git commit -m "docs: 同步导航信息架构调整"
```
