# Moonshot UI (TDesign) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all Ant Design usage with TDesign miniprogram components, keep Moonshot dark UI, and finish the 5-page UI overhaul with proper tabBar and change log.

**Architecture:** Keep the global dark theme tokens in `src/app.wxss`, switch all UI components (buttons, inputs, tags, list/cell, avatar) to TDesign via `usingComponents`, and preserve existing JS logic. New profile page reads from `storage` and routes to register when unbound.

**Tech Stack:** WeChat Mini Program (WXML/WXSS/JS), TDesign miniprogram (`tdesign-miniprogram`), existing utils (`storage`, `ui`, `api`).

---

### Task 1: Switch dependency to TDesign and remove AntD

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`

**Step 1: Write the failing test**

Run: `npm list tdesign-miniprogram`
Expected: FAIL (empty or missing)

**Step 2: Update dependency**

Edit `package.json`:

```json
{
  "dependencies": {
    "tdesign-miniprogram": "latest"
  }
}
```

Remove any `antd-mini` dependency.

Ensure `.gitignore` includes:

```
node_modules/
src/miniprogram_npm/
```

**Step 3: Install**

Run: `npm uninstall antd-mini`

Run: `npm install`
Expected: `node_modules/tdesign-miniprogram` exists

**Step 4: Build npm (WeChat DevTools)**

Action: In WeChat DevTools, run “Tools → Build npm”.
Expected: `src/miniprogram_npm/tdesign-miniprogram` generated.

**Step 5: Re-run the test**

Run: `npm list tdesign-miniprogram`
Expected: PASS (version listed)

**Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore

git commit -m "chore: switch to tdesign-miniprogram"
```

---

### Task 2: Update index page to TDesign components

**Files:**
- Modify: `src/pages/index/index.wxml`
- Modify: `src/pages/index/index.json`

**Step 1: Write the failing test**

Run: `rg -n "t-" src/pages/index/index.wxml`
Expected: FAIL (no TDesign components yet)

**Step 2: Register components**

Update `src/pages/index/index.json`:

```json
{
  "navigationBarTitleText": "活动签到",
  "usingComponents": {
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-button": "tdesign-miniprogram/button/button",
    "t-tag": "tdesign-miniprogram/tag/tag"
  }
}
```

**Step 3: Replace WXML with TDesign**

```xml
<t-cell-group class="card info-card">
  <t-cell title="活动" note="{{activity.activity_title || '—'}}" />
  <t-cell title="身份" note="{{name}} · {{studentId}}" />
  <t-cell title="二维码有效期" note="{{activity.qr_expire_seconds || 10}} 秒" />
</t-cell-group>

<t-button theme="primary" class="btn-primary" loading="{{loading}}" disabled="{{!isOnline || loading}}" bindtap="onScan">
  {{loading ? '正在验证...' : '扫码签到'}}
</t-button>

<t-cell-group class="status-card" wx:if="{{lastStatus}}">
  <t-cell title="{{lastStatus.title}}" note="{{lastStatus.message}}" />
  <t-cell wx:if="{{lastStatus.meta}}" title="记录号" note="{{lastStatus.meta}}" />
</t-cell-group>

<view class="success-overlay" wx:if="{{showSuccess}}" bindtap="closeSuccess">
  <view class="success-card">
    <view class="checkmark"></view>
    <text class="status-title">签到成功</text>
    <text class="status-message">记录已保存，可在签到记录查看</text>
    <t-button theme="default" class="btn-ghost" bindtap="goRecords">查看记录</t-button>
  </view>
</view>
```

**Step 4: Re-run the test**

Run: `rg -n "t-" src/pages/index/index.wxml`
Expected: PASS (TDesign tags found)

**Step 5: Commit**

```bash
git add src/pages/index/index.wxml src/pages/index/index.json

git commit -m "ui: refactor index page with TDesign"
```

---

### Task 3: Update records page to TDesign list/cell

**Files:**
- Modify: `src/pages/records/records.wxml`
- Modify: `src/pages/records/records.json`

**Step 1: Write the failing test**

Run: `rg -n "t-cell" src/pages/records/records.wxml`
Expected: FAIL

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "签到记录",
  "usingComponents": {
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-tag": "tdesign-miniprogram/tag/tag"
  }
}
```

**Step 3: Replace list cards**

```xml
<t-cell-group wx:for="{{records}}" wx:key="record_id" class="list-card" bindtap="openDetail" data-id="{{item.record_id}}">
  <view class="info-row">
    <text class="list-title">{{item.activity_title}}</text>
    <t-tag theme="success" variant="light" class="chip">已签</t-tag>
  </view>
  <text class="list-meta">{{item.time}}</text>
  <text class="list-meta">{{item.location}}</text>
</t-cell-group>
```

**Step 4: Re-run the test**

Run: `rg -n "t-cell" src/pages/records/records.wxml`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/records/records.wxml src/pages/records/records.json

git commit -m "ui: refactor records page with TDesign"
```

---

### Task 4: Update record detail page to TDesign

**Files:**
- Modify: `src/pages/record-detail/record-detail.wxml`
- Modify: `src/pages/record-detail/record-detail.json`

**Step 1: Write the failing test**

Run: `rg -n "t-cell" src/pages/record-detail/record-detail.wxml`
Expected: FAIL

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "签到详情",
  "usingComponents": {
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-button": "tdesign-miniprogram/button/button"
  }
}
```

**Step 3: Replace detail card + back button**

```xml
<t-cell-group class="card info-card">
  <t-cell title="活动" note="{{detail.activity_title || '—'}}" />
  <t-cell title="时间" note="{{detail.time || '—'}}" />
  <t-cell title="地点" note="{{detail.location || '—'}}" />
</t-cell-group>

<text class="hint">{{detail.description || '无更多描述'}}</text>

<t-button theme="default" class="btn-ghost" bindtap="goBack">返回</t-button>
```

**Step 4: Re-run the test**

Run: `rg -n "t-cell" src/pages/record-detail/record-detail.wxml`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pages/record-detail/record-detail.wxml src/pages/record-detail/record-detail.json

git commit -m "ui: refactor record detail with TDesign"
```

---

### Task 5: Update register page to TDesign inputs

**Files:**
- Modify: `src/pages/register/register.wxml`
- Modify: `src/pages/register/register.json`
- Modify: `src/pages/register/register.js`

**Step 1: Write the failing test**

Run: `rg -n "t-input" src/pages/register/register.wxml`
Expected: FAIL

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "注册绑定",
  "usingComponents": {
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-input": "tdesign-miniprogram/input/input",
    "t-button": "tdesign-miniprogram/button/button",
    "t-tag": "tdesign-miniprogram/tag/tag"
  }
}
```

**Step 3: Replace inputs with t-input**

```xml
<t-cell-group class="card">
  <view class="info-row">
    <text class="label">微信身份</text>
    <t-tag theme="primary" variant="light" class="tag">{{wxIdentity ? '已识别' : '未获取'}}</t-tag>
  </view>
  <view class="divider"></view>
  <t-input class="input" placeholder="学号" value="{{studentId}}" bindchange="onInputStudent" />
  <t-input class="input" placeholder="姓名" value="{{name}}" bindchange="onInputName" />
  <t-button theme="primary" class="btn-primary" loading="{{submitting}}" disabled="{{!isOnline || submitting}}" bindtap="onSubmit">
    {{submitting ? '提交中...' : '完成绑定'}}
  </t-button>
</t-cell-group>
```

**Step 4: Update handlers**

```js
onInputStudent(e) {
  const value = (e.detail && e.detail.value) ? e.detail.value : '';
  this.setData({ studentId: value.trim() });
}

onInputName(e) {
  const value = (e.detail && e.detail.value) ? e.detail.value : '';
  this.setData({ name: value.trim() });
}
```

**Step 5: Re-run the test**

Run: `rg -n "t-input" src/pages/register/register.wxml`
Expected: PASS

**Step 6: Commit**

```bash
git add src/pages/register/register.wxml src/pages/register/register.json src/pages/register/register.js

git commit -m "ui: refactor register page with TDesign"
```

---

### Task 6: Add 个人中心 page + tabBar item (TDesign)

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
    "t-avatar": "tdesign-miniprogram/avatar/avatar",
    "t-tag": "tdesign-miniprogram/tag/tag",
    "t-button": "tdesign-miniprogram/button/button"
  }
}
```

`profile.wxml` (minimal):

```xml
<view class="page page-profile">
  <view class="content">
    <view class="header">
      <text class="title">个人中心</text>
      <view class="title-line"></view>
    </view>

    <view class="card info-card">
      <t-avatar size="large"></t-avatar>
      <view class="info-row" style="margin-top: 20rpx;">
        <text class="label">姓名</text>
        <text class="value">{{name || '—'}}</text>
      </view>
      <view class="info-row">
        <text class="label">学号</text>
        <text class="value">{{studentId || '—'}}</text>
      </view>
      <view class="info-row">
        <text class="label">状态</text>
        <t-tag theme="success" variant="light" class="tag">{{bound ? '已绑定' : '未绑定'}}</t-tag>
      </view>
      <t-button theme="primary" class="btn-primary" bindtap="onAction">
        {{bound ? '重新绑定' : '去绑定'}}
      </t-button>
    </view>
  </view>
</view>
```

`profile.js`:

```js
const storage = require("../../utils/storage");

Page({
  data: {
    name: "",
    studentId: "",
    bound: false
  },
  onShow() {
    this.setData({
      name: storage.getName(),
      studentId: storage.getStudentId(),
      bound: storage.isBound()
    });
  },
  onAction() {
    wx.navigateTo({ url: "/pages/register/register" });
  }
});
```

**Step 3: Update app.json**

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

git commit -m "feat: add profile page with TDesign"
```

---

### Task 7: Clean up AntD references + update changes log

**Files:**
- Modify/Create: `changes.md`
- Modify: `progress.md`
- Modify: `task_plan.md`

**Step 1: Write the failing test**

Run: `rg -n "ant-" src`
Expected: FAIL (AntD tags remain)

**Step 2: Remove remaining AntD references**

Ensure no `ant-` tags or `antd-mini` references remain in WXML/JSON/JS.

**Step 3: Re-run the test**

Run: `rg -n "ant-" src`
Expected: PASS (no matches)

**Step 4: Update changes.md**

Create `changes.md` with a dated entry: dependency switch, page refactors, profile tab, app.json updates.

**Step 5: Update progress + task_plan**

Mark Phase 3 complete and Phase 4 in_progress, log verification notes.

**Step 6: Commit**

```bash
git add changes.md progress.md task_plan.md

git commit -m "docs: log TDesign UI changes"
```

---

## Suggested Manual Verification

1. WeChat DevTools: Build npm, reload project.
2. Check dark theme on all pages.
3. Scan flow still works (loading state, success overlay, status card).
4. Records list and detail render correctly.
5. Register inputs accept values and submit.
6. Profile page shows bound info and navigates to register when unbound.
