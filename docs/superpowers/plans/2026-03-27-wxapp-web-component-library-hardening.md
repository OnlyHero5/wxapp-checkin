# wxapp-checkin Web 组件库硬化整改 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 `wxapp-checkin/web` 中“表面用了组件库、实际仍深度手写”的共享壳层与表单链路问题，并把整改落实到测试、实现与验证。

**Architecture:** 优先把共享壳层从 TDesign 内部 DOM 覆写改成自有稳定容器；保留 TDesign 负责控件与信息单元，避免继续改写 `.t-*` 内部类名。表单改为真实 `Form` 提交与校验链路，按钮只做视觉适配，不再承担提交流程本身。

**Tech Stack:** React 18、Vite、Vitest、React Testing Library、tdesign-mobile-react 0.21.2

---

### Task 1: 锁定新的测试契约

**Files:**
- Create: `web/src/app/styles/base.test.ts`
- Modify: `web/src/shared/ui/MobilePage.test.tsx`
- Modify: `web/src/shared/ui/ActivityMetaPanel.test.tsx`
- Modify: `web/src/features/staff/components/DynamicCodePanel.test.tsx`
- Modify: `web/src/pages/login/LoginPage.test.tsx`
- Modify: `web/src/pages/checkin/CheckinPage.test.tsx`

- [ ] **Step 1: 新增样式契约测试，要求 `base.css` 不再直接耦合 `.t-*` 内部类名**
- [ ] **Step 2: 调整 `MobilePage`/`ActivityMetaPanel`/`DynamicCodePanel` 测试，改为断言自有稳定 surface/slot，而不是 `.t-cell-group--card` 这类内部结构**
- [ ] **Step 3: 调整登录页与签到页测试，要求表单支持真实 `submit` 提交流程**
- [ ] **Step 4: 运行针对性测试，确认这些新测试先失败**

### Task 2: 重构共享壳层并清理全局样式

**Files:**
- Modify: `web/src/shared/ui/MobilePage.tsx`
- Modify: `web/src/shared/ui/ActivityMetaPanel.tsx`
- Modify: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Modify: `web/src/features/staff/components/AttendanceRosterList.tsx`
- Modify: `web/src/app/styles/base.css`

- [ ] **Step 1: 把 `MobilePage` 改成自有 hero/content surface，移除把 `CellGroup` 当页面壳层的做法**
- [ ] **Step 2: 把 `ActivityMetaPanel` 和 staff 动态码 hero 收口到自有稳定 surface，保留 TDesign 负责明细行与控件**
- [ ] **Step 3: 清掉 `base.css` 中全部 `.t-*` 直接选择器与失效类，改为只使用自有类和 CSS 变量**
- [ ] **Step 4: 运行针对性测试，确认共享壳层改造通过**

### Task 3: 让表单真正接入 TDesign Form 能力

**Files:**
- Modify: `web/src/features/auth/components/AccountLoginForm.tsx`
- Modify: `web/src/features/attendance/components/CodeInput.tsx`
- Modify: `web/src/shared/ui/AppButton.tsx`

- [ ] **Step 1: 给登录表单补 `Form` 提交、校验规则与 `submit` 按钮语义**
- [ ] **Step 2: 给验证码表单补 `Form` 提交、6 位码校验与 `submit` 按钮语义**
- [ ] **Step 3: 保持 `AppButton` 作为视觉层，不再依赖点击事件才能提交表单**
- [ ] **Step 4: 运行登录页与签到页测试，确认表单链路通过**

### Task 4: 全量验证与提交

**Files:**
- Modify: `docs/superpowers/plans/2026-03-27-wxapp-web-component-library-hardening.md`

- [ ] **Step 1: 运行 `npm test`**
- [ ] **Step 2: 运行 `npm run lint`**
- [ ] **Step 3: 运行 `npm run build`**
- [ ] **Step 4: 检查 `git -C wxapp-checkin status --short`，确认仅包含本轮变更**
- [ ] **Step 5: 在 `wxapp-checkin` 子仓库提交本轮整改，保持工作区干净**
