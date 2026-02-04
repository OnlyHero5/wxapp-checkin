# Moonshot UI Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign four pages and add a minimal “个人中心” tab using Ant Design Mini components and the Moonshot-like dark aesthetic, while keeping existing logic intact and logging all changes.

**Architecture:** Centralize dark theme tokens in `src/app.wxss`, keep page-specific styles minimal, and swap key UI primitives to Ant Design Mini components (buttons, containers, lists, tags, inputs). Add a new profile page that reads from `storage` and routes to register when unbound.

**Tech Stack:** WeChat Mini Program (WXML/WXSS/JS), Ant Design Mini (`antd-mini`), existing utils (`storage`, `ui`, `api`).

---

### Task 1: Fix Ant Design Mini dependency & verify install

**Files:**
- Modify: `package.json`
- (Generated, local): `package-lock.json`, `node_modules/`, `src/miniprogram_npm/`

**Step 1: Write the failing test**

Run: `npm list antd-mini`
Expected: FAIL (package missing)

**Step 2: Update dependency**

Edit `package.json`:

```json
{
  "dependencies": {
    "antd-mini": "latest"
  }
}
```

Remove `@ant-design/mini` from dependencies.

**Step 3: Run install**

Run: `npm install`
Expected: SUCCESS, `node_modules/antd-mini` exists

**Step 4: Build npm (WeChat DevTools)**

Action: In WeChat DevTools, run “Tools → Build npm”.
Expected: `src/miniprogram_npm/antd-mini` generated.

**Step 5: Re-run the test**

Run: `npm list antd-mini`
Expected: PASS (version listed)

**Step 6: Commit**

```bash
git add package.json package-lock.json

git commit -m "chore: switch to antd-mini dependency"
```

---

### Task 2: Dark theme tokens & shared styles

**Files:**
- Modify: `src/app.wxss`

**Step 1: Write the failing test**

Run: `rg -n "--bg" src/app.wxss`
Expected: FAIL (no tokens)

**Step 2: Implement tokens + dark styles**

Add/replace base styles and tokens (merge with existing classes):

```css
page {
  --bg: #0b0d12;
  --surface: #0f172a;
  --surface-elevated: #111b30;
  --border: rgba(148, 163, 184, 0.18);
  --text: #f8fafc;
  --muted: #94a3b8;
  --accent: #65f0c2;
  --danger: #f87171;
  background-color: var(--bg);
  color: var(--text);
  font-family: "HarmonyOS Sans", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.card,
.list-card,
.status-card,
.success-card {
  background: var(--surface);
  border: 1rpx solid var(--border);
  box-shadow: 0 20rpx 40rpx rgba(0, 0, 0, 0.35);
}

.label,
.list-meta,
.hint {
  color: var(--muted);
}

.value,
.title,
.status-title,
.list-title {
  color: var(--text);
}

.btn-primary {
  background: var(--accent);
  color: #0b0d12;
  letter-spacing: 2rpx;
}

.btn-ghost {
  background: transparent;
  color: var(--text);
  border: 1rpx solid var(--border);
}

.network-banner {
  background: rgba(248, 113, 113, 0.12);
  border: 1rpx solid rgba(248, 113, 113, 0.3);
  color: #fecaca;
}
```

Adjust gradients, dividers, and inputs to dark theme where needed.

**Step 3: Re-run the test**

Run: `rg -n "--bg" src/app.wxss`
Expected: PASS (tokens found)

**Step 4: Commit**

```bash
git add src/app.wxss

git commit -m "style: add moonshot dark theme tokens"
```

---

### Task 3: Update index page to AntD components

**Files:**
- Modify: `src/pages/index/index.wxml`
- Modify: `src/pages/index/index.json`

**Step 1: Write the failing test**

Run: `rg -n "ant-" src/pages/index/index.wxml`
Expected: FAIL (no AntD components)

**Step 2: Register components**

Update `src/pages/index/index.json`:

```json
{
  "navigationBarTitleText": "活动签到",
  "usingComponents": {
    "ant-container": "antd-mini/Container/index",
    "ant-button": "antd-mini/Button/index",
    "ant-tag": "antd-mini/Tag/index"
  }
}
```

**Step 3: Replace WXML primitives with AntD**

Example structure (keep existing data bindings):

```xml
<ant-container className="card info-card">
  <!-- existing info rows -->
</ant-container>

<ant-button type="primary" className="btn-primary" loading="{{loading}}" disabled="{{!isOnline || loading}}" bindtap="onScan">
  {{loading ? '正在验证...' : '扫码签到'}}
</ant-button>

<ant-container className="status-card" wx:if="{{lastStatus}}">
  <!-- status content -->
</ant-container>

<ant-button type="light" className="btn-ghost" bindtap="goRecords">查看记录</ant-button>
```

**Step 4: Re-run the test**

Run: `rg -n "ant-" src/pages/index/index.wxml`
Expected: PASS (AntD tags found)

**Step 5: Commit**

```bash
git add src/pages/index/index.wxml src/pages/index/index.json

git commit -m "ui: refactor index page with AntD components"
```

---

### Task 4: Update records list page

**Files:**
- Modify: `src/pages/records/records.wxml`
- Modify: `src/pages/records/records.json`

**Step 1: Write the failing test**

Run: `rg -n "ant-" src/pages/records/records.wxml`
Expected: FAIL

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "签到记录",
  "usingComponents": {
    "ant-list": "antd-mini/List/index",
    "ant-list-item": "antd-mini/List/ListItem/index",
    "ant-tag": "antd-mini/Tag/index"
  }
}
```

**Step 3: Replace list cards**

Use `ant-list` + `ant-list-item` for each record and `ant-tag` for status.

**Step 4: Re-run the test**

Run: `rg -n "ant-" src/pages/records/records.wxml`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/records/records.wxml src/pages/records/records.json

git commit -m "ui: refactor records page with AntD cards"
```

---

### Task 5: Update record detail page

**Files:**
- Modify: `src/pages/record-detail/record-detail.wxml`
- Modify: `src/pages/record-detail/record-detail.json`

**Step 1: Write the failing test**

Run: `rg -n "ant-" src/pages/record-detail/record-detail.wxml`
Expected: FAIL

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "签到详情",
  "usingComponents": {
    "ant-container": "antd-mini/Container/index",
    "ant-button": "antd-mini/Button/index"
  }
}
```

**Step 3: Replace detail card + back button**

Use `ant-container` for the detail block and `ant-button` for 返回.

**Step 4: Re-run the test**

Run: `rg -n "ant-" src/pages/record-detail/record-detail.wxml`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/record-detail/record-detail.wxml src/pages/record-detail/record-detail.json

git commit -m "ui: refactor record detail with AntD"
```

---

### Task 6: Update register page with AntD inputs

**Files:**
- Modify: `src/pages/register/register.wxml`
- Modify: `src/pages/register/register.json`
- Modify: `src/pages/register/register.js`

**Step 1: Write the failing test**

Run: `rg -n "ant-input" src/pages/register/register.wxml`
Expected: FAIL

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "注册绑定",
  "usingComponents": {
    "ant-container": "antd-mini/Container/index",
    "ant-input": "antd-mini/Input/index",
    "ant-button": "antd-mini/Button/index",
    "ant-tag": "antd-mini/Tag/index"
  }
}
```

**Step 3: Replace inputs with ant-input**

Use `bindchange` events (WeChat) and keep existing handlers:

```xml
<ant-input className="input" placeholder="学号" value="{{studentId}}" bindchange="onInputStudent" />
<ant-input className="input" placeholder="姓名" value="{{name}}" bindchange="onInputName" />
```

**Step 4: Update handlers to read value safely**

```js
onInputStudent(e) {
  const value = e.detail?.value ?? e.detail ?? '';
  this.setData({ studentId: value.trim() });
}
```

Apply same pattern to `onInputName`.

**Step 5: Re-run the test**

Run: `rg -n "ant-input" src/pages/register/register.wxml`
Expected: PASS

**Step 6: Commit**

```bash
git add src/pages/register/register.wxml src/pages/register/register.json src/pages/register/register.js

git commit -m "ui: refactor register inputs with AntD"
```

---

### Task 7: Add 个人中心 page + tabBar item

**Files:**
- Create: `src/pages/profile/profile.wxml`
- Create: `src/pages/profile/profile.wxss`
- Create: `src/pages/profile/profile.json`
- Create: `src/pages/profile/profile.js`
- Modify: `src/app.json`

**Step 1: Write the failing test**

Run: `Test-Path src/pages/profile/profile.wxml`
Expected: FAIL

**Step 2: Add page files**

`profile.json`:

```json
{
  "navigationBarTitleText": "个人中心",
  "usingComponents": {
    "ant-container": "antd-mini/Container/index",
    "ant-avatar": "antd-mini/Avatar/index",
    "ant-tag": "antd-mini/Tag/index",
    "ant-button": "antd-mini/Button/index"
  }
}
```

`profile.js` should read from `storage` and show bound state; if not bound, button routes to register.

**Step 3: Update app.json**

Add page and tabBar item:

```json
"pages": [
  "pages/index/index",
  "pages/records/records",
  "pages/register/register",
  "pages/record-detail/record-detail",
  "pages/profile/profile"
],
"tabBar": {
  "list": [
    { "pagePath": "pages/index/index", "text": "签到" },
    { "pagePath": "pages/records/records", "text": "记录" },
    { "pagePath": "pages/profile/profile", "text": "个人中心" }
  ]
}
```

**Step 4: Re-run the test**

Run: `Test-Path src/pages/profile/profile.wxml`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/profile/profile.* src/app.json

git commit -m "feat: add profile tab page"
```

---

### Task 8: Update changes.md + verification notes

**Files:**
- Create/Modify: `changes.md`
- Modify: `progress.md`
- Modify: `task_plan.md`

**Step 1: Write the failing test**

Run: `Test-Path changes.md`
Expected: FAIL (file missing)

**Step 2: Create changes.md**

Add a dated entry listing: app.wxss retheme, AntD component adoption per page, new profile tab, app.json update.

**Step 3: Log verification**

Add manual checks to `progress.md` (visual pass, tab navigation). Update `task_plan.md` Phase 3 → complete, Phase 4 → in_progress.

**Step 4: Re-run the test**

Run: `Test-Path changes.md`
Expected: PASS

**Step 5: Commit**

```bash
git add changes.md progress.md task_plan.md

git commit -m "docs: log moonshot ui changes"
```

---

## Notes & Constraints

- AntD Mini WeChat paths follow `antd-mini/<Component>/index` per WeChat build docs; if build fails, verify component paths in `src/miniprogram_npm/antd-mini` and adjust.
- For AntD Input on WeChat, use `bindchange` (not `bindinput`).
- Keep all logic in existing JS files unchanged except for input handlers and the new profile page.
- Keep tabBar text-only as requested.

## Suggested Manual Verification

1. Open WeChat DevTools, run “Build npm”, reload project.
2. Check dark theme applied across all pages.
3. Scan flow still works (loading state, success overlay, status card).
4. Records list and detail render correctly.
5. Register inputs accept values and submit.
6. Profile page shows bound info and navigates to register when unbound.

