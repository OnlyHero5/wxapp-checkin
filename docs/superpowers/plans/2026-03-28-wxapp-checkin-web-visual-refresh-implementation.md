# wxapp-checkin Web Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `wxapp-checkin/web` 重做成统一、鲜明、移动端友好的活动工作台，并修复截图中暴露的动态码错图、名单修正塌陷和全站层级弱的问题。

**Architecture:** 保留现有业务 hook、接口与 `tdesign-mobile-react` 组件原语，集中重构全局 token、页面壳层和共享 UI 映射层，再按“活动链路页面 -> staff 页面”顺序逐批改造。高风险展示块只在组件库无法覆盖时做最小自定义，并通过测试锁住关键 DOM 结构，防止重新回退到手写壳层或错乱装饰。

**Tech Stack:** React + TypeScript + Vite + Vitest + `tdesign-mobile-react` + CSS variables

---

### Task 1: 锁定截图问题的关键回归测试

**Files:**
- Modify: `web/src/features/staff/components/DynamicCodeHero.test.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.rendering.test.tsx`
- Modify: `web/src/features/staff/components/AttendanceBatchActionBar.test.tsx`
- Test: `web/src/features/staff/components/DynamicCodeHero.test.tsx`
- Test: `web/src/pages/activities/ActivitiesPage.rendering.test.tsx`
- Test: `web/src/features/staff/components/AttendanceBatchActionBar.test.tsx`

- [ ] **Step 1: 写失败测试，锁住动态码区不再使用 `Badge ribbon` 包裹主卡**

目标断言：
- `DynamicCodeHero` 仍显示动作标题、码值、倒计时
- 不再依赖 `.t-badge` 作为主卡根结构
- 存在新的自定义头部 / 主体结构 class

- [ ] **Step 2: 运行单测确认当前实现按预期失败**

Run:
```bash
cd /home/psx/app/wxapp-checkin/web
npx vitest run src/features/staff/components/DynamicCodeHero.test.tsx
```

Expected:
- `DynamicCodeHero` 相关断言失败，因为当前仍在用 `Badge`

- [ ] **Step 3: 写失败测试，锁住活动列表页存在新的页面骨架 class 和更明确的 section 结构**

目标断言：
- `main` 根节点继续保留 tone data attribute
- 页面正文出现新的内容壳层 class
- 页面描述 / 搜索 / tabs / 列表仍可定位

- [ ] **Step 4: 写失败测试，锁住批量修正区的主操作信息结构**

目标断言：
- `AttendanceBatchActionBar` 仍走组件库 `ActionSheet.show` / `Dialog.confirm`
- 同时新增 summary / action 区分离的结构 class，避免未来再塌成一块

- [ ] **Step 5: 运行目标测试并记录当前 red 状态**

Run:
```bash
cd /home/psx/app/wxapp-checkin/web
npx vitest run \
  src/features/staff/components/DynamicCodeHero.test.tsx \
  src/features/staff/components/AttendanceBatchActionBar.test.tsx \
  src/pages/activities/ActivitiesPage.rendering.test.tsx
```

Expected:
- 至少动态码和新结构断言处于 FAIL

### Task 2: 重构全局 token、页面壳层与共享视觉组件

**Files:**
- Modify: `web/src/app/styles/tokens.css`
- Modify: `web/src/app/styles/page-shell.css`
- Modify: `web/src/app/styles/layouts.css`
- Modify: `web/src/app/styles/staff-page.css`
- Modify: `web/src/shared/ui/MobilePage.tsx`
- Modify: `web/src/shared/ui/ActivityMetaPanel.tsx`
- Modify: `web/src/shared/ui/AppButton.tsx`
- Modify: `web/src/shared/ui/InlineNotice.tsx`
- Modify: `web/src/shared/ui/StatusTag.tsx`
- Modify: `web/src/shared/ui/AppBusinessNav.tsx`

- [ ] **Step 1: 调整设计 token**

实现内容：
- 把当前灰白 token 调成更强层级的浅底多色系统
- 新增品牌 / staff / checkin / checkout 的 surface、border、shadow、text token
- 保留 CSS 变量体系，不引入第二套 theme 机制

- [ ] **Step 2: 重做 `MobilePage` 壳层结构**

实现内容：
- 增加页面头部、正文、次级操作区的稳定容器 class
- 保留 `Navbar` 作为导航组件，不手写导航行为
- 为不同 tone 输出稳定 class / data hook，方便页面级投影

- [ ] **Step 3: 重做共享视觉映射层**

实现内容：
- `ActivityMetaPanel` 增加更清晰的 section 包裹关系与动作区布局
- `AppButton` 继续映射到 TDesign Button，但补充统一 class 便于全站风格对齐
- `InlineNotice`、`StatusTag`、`AppBusinessNav` 增加统一视觉 class，不重写组件库行为

- [ ] **Step 4: 运行相关测试，确认共享改动未打断基础页面结构**

Run:
```bash
cd /home/psx/app/wxapp-checkin/web
npx vitest run src/pages/activities/ActivitiesPage.rendering.test.tsx src/pages/profile/ProfilePage.test.tsx
```

Expected:
- 共享壳层相关测试 PASS，若失败则先修正共享结构再继续

### Task 3: 改造普通用户链路页面

**Files:**
- Modify: `web/src/pages/login/LoginPage.tsx`
- Modify: `web/src/features/auth/components/AccountLoginForm.tsx`
- Modify: `web/src/pages/activities/ActivitiesPage.tsx`
- Modify: `web/src/features/activities/components/ActivityCard.tsx`
- Modify: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.tsx`
- Modify: `web/src/pages/checkout/CheckoutPage.tsx`
- Modify: `web/src/pages/profile/ProfilePage.tsx`

- [ ] **Step 1: 重做登录页和登录表单的视觉层级**

实现内容：
- 强化登录页首屏识别、输入区、错误提示与主按钮关系
- 表单仍使用 TDesign `Form` / `Input`
- 补中文注释说明哪些结构是组件库原语，哪些是页面级品牌壳层

- [ ] **Step 2: 重做活动列表页与活动卡**

实现内容：
- 提升列表页页头、搜索、Tabs、卡片的层级
- 活动卡建立标题、状态、时间地点、动作的稳定排序
- 保留 `ActivityMetaPanel`，避免重写卡片组件库

- [ ] **Step 3: 重做详情页、签到页、签退页、个人页**

实现内容：
- 详情页形成“活动主信息 + 可执行动作”结构
- 签到 / 签退页形成高聚焦输入流，不堆无关信息
- 个人页改成更完整的账户面板

- [ ] **Step 4: 运行普通用户链路测试**

Run:
```bash
cd /home/psx/app/wxapp-checkin/web
npx vitest run \
  src/pages/login/LoginPage.test.tsx \
  src/pages/activities/ActivitiesPage.rendering.test.tsx \
  src/pages/activity-detail/ActivityDetailPage.test.tsx \
  src/pages/checkin/CheckinPage.test.tsx \
  src/pages/profile/ProfilePage.test.tsx
```

Expected:
- 以上页面测试 PASS

### Task 4: 改造 staff 管理页与名单页

**Files:**
- Modify: `web/src/features/staff/components/DynamicCodeHero.tsx`
- Modify: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Modify: `web/src/features/staff/components/AttendanceBatchActionBar.tsx`
- Modify: `web/src/features/staff/components/AttendanceRosterList.tsx`
- Modify: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Modify: `web/src/pages/activity-roster/ActivityRosterPage.tsx`

- [ ] **Step 1: 重做 `DynamicCodeHero`**

实现内容：
- 去掉 `Badge shape=\"ribbon-left\"`
- 改成自有头部条 + 码值区 + 倒计时区
- 继续复用 TDesign `CountDown` 与 `Skeleton`
- 补中文注释解释为何这里保留最小自定义结构

- [ ] **Step 2: 重做 staff 管理页布局**

实现内容：
- 让 tabs、动态码主卡、统计块、刷新动作形成更稳的单列移动布局
- 提高颜色区分和主次关系，避免截图里的“灰 + 挤 + 弱”

- [ ] **Step 3: 重做名单页和批量修正区**

实现内容：
- 保留 `SwipeCell` 与 `Checkbox` 行为
- 重新布局成员信息卡与左右动作块，避免竖条塌陷
- 批量修正区拆成 summary 与主按钮层次

- [ ] **Step 4: 运行 staff 页面测试**

Run:
```bash
cd /home/psx/app/wxapp-checkin/web
npx vitest run \
  src/features/staff/components/DynamicCodeHero.test.tsx \
  src/features/staff/components/AttendanceBatchActionBar.test.tsx \
  src/pages/staff-manage/StaffManagePage.lifecycle.test.tsx \
  src/pages/staff-manage/StaffManagePage.code-session.test.tsx \
  src/pages/activity-roster/ActivityRosterPage.test.tsx
```

Expected:
- staff 关键页面与结构测试 PASS

### Task 5: 全量验证与视觉复核

**Files:**
- Modify: `web/src/**/*.tsx`
- Modify: `web/src/app/styles/*.css`

- [ ] **Step 1: 运行 lint**

Run:
```bash
cd /home/psx/app/wxapp-checkin/web
npm run lint
```

Expected:
- exit code 0

- [ ] **Step 2: 运行 build**

Run:
```bash
cd /home/psx/app/wxapp-checkin/web
npm run build
```

Expected:
- exit code 0

- [ ] **Step 3: 人工对照截图复核**

检查项：
- 动态码区不再出现错乱图片
- 名单修正区不再塌陷
- 活动列表 / 详情 / 登录 / 签到签退 / 我的 / 管理页风格统一
- 颜色明显丰富，但仍按业务语义分色
- 组件优先策略没有被破坏

- [ ] **Step 4: 提交**

```bash
git -C /home/psx/app/wxapp-checkin add web
git -C /home/psx/app/wxapp-checkin commit -m "fix(web): 重做移动端前端视觉体系"
```
