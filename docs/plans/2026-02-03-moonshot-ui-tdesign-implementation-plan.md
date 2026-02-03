# Moonshot Miniapp UI (TDesign Hybrid) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the Moonshot Obsidian Grid dark UI across the mini program, add a minimal “个人中心” tab page, and adopt a TDesign + custom layout hybrid UI while logging all changes in `docs/changes.md`.

**Architecture:** Centralize visual tokens in `src/app.wxss`, keep layout containers custom for Obsidian Grid texture, and use TDesign for interactive controls (buttons/tags/inputs where safe). Preserve existing business logic in page JS, only adjusting UI bindings as needed.

**Tech Stack:** WeChat Mini Program (WXML/WXSS/JS), TDesign Miniprogram (`tdesign-miniprogram`), existing utils/storage/auth/api.

---

### Task 1: Add TDesign dependency + ignore generated artifacts

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

**Step 1: Replace `package.json` with TDesign dependency**

```json
{
  "name": "wxapp-checkin",
  "private": true,
  "version": "0.1.0",
  "dependencies": {
    "tdesign-miniprogram": "latest"
  }
}
```

**Step 2: Ensure `.gitignore` includes npm artifacts**

Add if missing:
```
node_modules/
src/miniprogram_npm/
```

**Step 3: Install npm dependencies**

Run:
```
npm install
```
Expected: `node_modules/` created and lockfile generated.

**Step 4: Build NPM in WeChat DevTools (manual)**

Tools → Build NPM.

**Step 5: Commit**

```bash
git add package.json .gitignore

git commit -m "chore: add tdesign miniprogram dependency"
```

---

### Task 2: Apply global Obsidian Grid theme

**Files:**
- Modify: `src/app.wxss`

**Step 1: Replace `src/app.wxss` with dark theme tokens + base styles**

```css
:root {
  --bg: #0b0d12;
  --surface: #0f172a;
  --surface-2: #101826;
  --border: rgba(148, 163, 184, 0.18);
  --text: #f8fafc;
  --muted: #94a3b8;
  --accent: #65f0c2;
  --accent-strong: #22c55e;
  --danger: #f87171;
  --shadow-soft: 0 16rpx 40rpx rgba(0, 0, 0, 0.35);
}

page {
  background-color: var(--bg);
  color: var(--text);
  font-family: "HarmonyOS Sans", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.mono {
  font-family: "SFMono-Regular", "Menlo", "Consolas", "Liberation Mono", monospace;
}

view, text {
  box-sizing: border-box;
}

button {
  border: none;
  line-height: 1.2;
  background: transparent;
}

button::after {
  border: none;
}

.page {
  min-height: 100vh;
  padding: 40rpx 30rpx 120rpx;
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at 20% 10%, rgba(101, 240, 194, 0.08), transparent 45%),
    radial-gradient(circle at 80% 0%, rgba(96, 165, 250, 0.05), transparent 40%),
    var(--bg);
}

.page::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(148, 163, 184, 0.06) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(148, 163, 184, 0.04) 1rpx, transparent 1rpx);
  background-size: 32rpx 32rpx;
  opacity: 0.35;
  pointer-events: none;
}

.content {
  position: relative;
  z-index: 1;
}

.header {
  margin-bottom: 28rpx;
  padding-top: 6rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.title-line {
  width: 72rpx;
  height: 2rpx;
  margin-top: 10rpx;
  background: linear-gradient(90deg, var(--accent), rgba(101, 240, 194, 0.05));
  opacity: 0.9;
}

.card {
  padding: 30rpx;
  border-radius: 22rpx;
  background: var(--surface);
  border: 1rpx solid var(--border);
  box-shadow: var(--shadow-soft);
}

.info-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  font-size: 24rpx;
  color: var(--muted);
}

.value {
  font-size: 26rpx;
  color: var(--text);
  text-align: right;
  max-width: 68%;
  line-height: 1.4;
  word-break: break-all;
}

.divider {
  height: 1rpx;
  background: var(--border);
  margin: 12rpx 0 18rpx;
}

.hint {
  font-size: 22rpx;
  color: var(--muted);
  margin-top: 16rpx;
}

.btn-primary {
  margin-top: 24rpx;
  background: var(--accent);
  color: #07110d;
  font-weight: 600;
  border-radius: 999rpx;
  padding: 20rpx 32rpx;
  box-shadow: 0 16rpx 30rpx rgba(101, 240, 194, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  min-height: 90rpx;
  letter-spacing: 4rpx;
}

.btn-primary:active {
  transform: translateY(2rpx) scale(0.98);
}

.btn-primary[disabled] {
  opacity: 0.45;
}

.btn-ghost {
  margin-top: 18rpx;
  background: transparent;
  color: var(--text);
  border: 1rpx solid var(--border);
  border-radius: 999rpx;
  padding: 14rpx 28rpx;
  transition: transform 0.15s ease;
}

.btn-ghost:active {
  transform: translateY(2rpx) scale(0.98);
}

.input {
  background: rgba(15, 23, 42, 0.7);
  border-radius: 14rpx;
  padding: 18rpx 20rpx;
  margin-top: 18rpx;
  color: var(--text);
  border: 1rpx solid var(--border);
}

.input::placeholder {
  color: rgba(148, 163, 184, 0.7);
}

.tag {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  background: rgba(101, 240, 194, 0.12);
  color: var(--accent);
  border: 1rpx solid rgba(101, 240, 194, 0.3);
}

.network-banner {
  padding: 14rpx 20rpx;
  border-radius: 14rpx;
  background: rgba(248, 113, 113, 0.12);
  color: #fecaca;
  margin-bottom: 20rpx;
  border: 1rpx solid rgba(248, 113, 113, 0.3);
}

.status-card {
  margin-top: 26rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: var(--surface-2);
  border: 1rpx solid var(--border);
}

.status-title {
  font-size: 28rpx;
  font-weight: 600;
}

.status-message {
  font-size: 24rpx;
  color: var(--muted);
  margin-top: 10rpx;
}

.status-meta {
  font-size: 22rpx;
  color: rgba(148, 163, 184, 0.8);
  margin-top: 10rpx;
}

.success-overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 11, 18, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
  animation: fadeIn 0.25s ease-out;
  backdrop-filter: blur(6rpx);
}

.success-card {
  width: 520rpx;
  padding: 36rpx;
  border-radius: 28rpx;
  background: var(--surface);
  border: 1rpx solid rgba(101, 240, 194, 0.3);
  text-align: center;
  animation: popIn 0.3s ease-out;
  box-shadow: 0 24rpx 40rpx rgba(0, 0, 0, 0.4);
}

.checkmark {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(101, 240, 194, 0.12);
  border: 2rpx solid var(--accent);
  margin: 0 auto 18rpx;
  position: relative;
}

.checkmark::after {
  content: "";
  position: absolute;
  width: 34rpx;
  height: 18rpx;
  border-left: 6rpx solid var(--accent);
  border-bottom: 6rpx solid var(--accent);
  transform: rotate(-45deg);
  top: 32rpx;
  left: 28rpx;
}

@keyframes popIn {
  from {
    transform: scale(0.92);
    opacity: 0.6;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.list-card {
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--surface);
  border: 1rpx solid var(--border);
  margin-bottom: 18rpx;
  transition: transform 0.15s ease;
}

.list-card:active {
  transform: translateY(2rpx) scale(0.99);
}

.list-title {
  font-size: 28rpx;
  font-weight: 600;
  max-width: 75%;
}

.list-meta {
  font-size: 22rpx;
  color: var(--muted);
  margin-top: 8rpx;
}

.empty {
  text-align: center;
  color: var(--muted);
  margin-top: 60rpx;
}
```

**Step 2: Commit**

```bash
git add src/app.wxss

git commit -m "style: apply Obsidian Grid global theme"
```

---

### Task 3: Update app.json for new tab

**Files:**
- Modify: `src/app.json`

**Step 1: Add profile page and tabBar item**

```json
{
  "pages": [
    "pages/index/index",
    "pages/records/records",
    "pages/register/register",
    "pages/record-detail/record-detail",
    "pages/profile/profile"
  ],
  "tabBar": {
    "color": "#9aa6b2",
    "selectedColor": "#65f0c2",
    "backgroundColor": "#0b0d12",
    "borderStyle": "black",
    "list": [
      { "pagePath": "pages/index/index", "text": "签到" },
      { "pagePath": "pages/records/records", "text": "记录" },
      { "pagePath": "pages/profile/profile", "text": "个人中心" }
    ]
  }
}
```

**Step 2: Commit**

```bash
git add src/app.json

git commit -m "feat: add profile tab and page entry"
```

---

### Task 4: Refactor 签到页 UI (TDesign buttons)

**Files:**
- Modify: `src/pages/index/index.wxml`
- Modify: `src/pages/index/index.json`

**Step 1: Update WXML**

```xml
<view class="page page-home">
  <view class="content">
    <view wx:if="{{!isOnline}}" class="network-banner">当前无网络，无法签到</view>

    <view class="header">
      <text class="title">活动签到</text>
      <view class="title-line"></view>
    </view>

    <view class="card info-card">
      <view class="info-row">
        <text class="label">活动</text>
        <text class="value">{{activity.activity_title || '—'}}</text>
      </view>
      <view class="divider"></view>
      <view class="info-row">
        <text class="label">身份</text>
        <text class="value">{{name}} · {{studentId}}</text>
      </view>
      <view class="info-row">
        <text class="label">二维码有效期</text>
        <text class="value">{{activity.qr_expire_seconds || 10}} 秒</text>
      </view>
    </view>

    <t-button class="btn-primary" bindtap="onScan" disabled="{{!isOnline || loading}}">
      {{loading ? '正在验证...' : '扫码签到'}}
    </t-button>
    <text class="hint">二维码每 10 秒更新，过期将判无效</text>

    <view class="status-card" wx:if="{{lastStatus}}">
      <text class="status-title">{{lastStatus.title}}</text>
      <text class="status-message">{{lastStatus.message}}</text>
      <text class="status-meta" wx:if="{{lastStatus.meta}}">{{lastStatus.meta}}</text>
    </view>
  </view>

  <view class="success-overlay" wx:if="{{showSuccess}}" bindtap="closeSuccess">
    <view class="success-card">
      <view class="checkmark"></view>
      <text class="status-title">签到成功</text>
      <text class="status-message">记录已保存，可在签到记录查看</text>
      <t-button class="btn-ghost" bindtap="goRecords">查看记录</t-button>
    </view>
  </view>
</view>
```

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "活动签到",
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button"
  }
}
```

**Step 3: Commit**

```bash
git add src/pages/index/index.wxml src/pages/index/index.json

git commit -m "feat: use tdesign buttons on index"
```

---

### Task 5: Refactor 记录页 UI (TDesign tag)

**Files:**
- Modify: `src/pages/records/records.wxml`
- Modify: `src/pages/records/records.json`

**Step 1: Update WXML**

```xml
<view class="page page-records">
  <view class="content">
    <view wx:if="{{!isOnline}}" class="network-banner">当前无网络，无法刷新记录</view>

    <view class="header">
      <text class="title">签到记录</text>
      <view class="title-line"></view>
    </view>

    <view wx:if="{{loading}}" class="hint">正在加载记录...</view>

    <view wx:for="{{records}}" wx:key="record_id" class="list-card" bindtap="openDetail" data-id="{{item.record_id}}">
      <view class="info-row">
        <text class="list-title">{{item.activity_title}}</text>
        <t-tag class="tag">已签</t-tag>
      </view>
      <text class="list-meta">{{item.time}}</text>
      <text class="list-meta">{{item.location}}</text>
    </view>

    <view wx:if="{{!loading && records.length === 0}}" class="empty">暂无签到记录</view>
  </view>
</view>
```

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "签到记录",
  "usingComponents": {
    "t-tag": "tdesign-miniprogram/tag/tag"
  }
}
```

**Step 3: Commit**

```bash
git add src/pages/records/records.wxml src/pages/records/records.json

git commit -m "feat: use tdesign tag on records"
```

---

### Task 6: Refactor 详情页 UI (TDesign button)

**Files:**
- Modify: `src/pages/record-detail/record-detail.wxml`
- Modify: `src/pages/record-detail/record-detail.json`

**Step 1: Update WXML**

```xml
<view class="page page-detail">
  <view class="content">
    <view wx:if="{{!isOnline}}" class="network-banner">当前无网络，无法刷新详情</view>

    <view class="header">
      <text class="title">签到详情</text>
      <view class="title-line"></view>
    </view>

    <view class="card info-card">
      <view class="info-row">
        <text class="label">活动</text>
        <text class="value">{{detail.activity_title || '—'}}</text>
      </view>
      <view class="info-row">
        <text class="label">时间</text>
        <text class="value">{{detail.time || '—'}}</text>
      </view>
      <view class="info-row">
        <text class="label">地点</text>
        <text class="value">{{detail.location || '—'}}</text>
      </view>
      <view class="divider"></view>
      <text class="hint">{{detail.description || '无更多描述'}}</text>
    </view>

    <view class="hint">可截图保存作为签到凭证</view>
    <t-button class="btn-ghost" bindtap="goBack">返回</t-button>
  </view>
</view>
```

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "签到详情",
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button"
  }
}
```

**Step 3: Commit**

```bash
git add src/pages/record-detail/record-detail.wxml src/pages/record-detail/record-detail.json

git commit -m "feat: use tdesign button on detail"
```

---

### Task 7: Refactor 注册页 UI (TDesign button + tag)

**Files:**
- Modify: `src/pages/register/register.wxml`
- Modify: `src/pages/register/register.json`

**Step 1: Update WXML**

```xml
<view class="page page-register">
  <view class="content">
    <view wx:if="{{!isOnline}}" class="network-banner">当前无网络，无法注册</view>

    <view class="header">
      <text class="title">注册绑定</text>
      <view class="title-line"></view>
    </view>

    <view class="card">
      <view class="info-row">
        <text class="label">微信身份</text>
        <t-tag class="tag">{{wxIdentity ? '已识别' : '未获取'}}</t-tag>
      </view>
      <view class="divider"></view>
      <input class="input" placeholder="学号" value="{{studentId}}" bindinput="onInputStudent" />
      <input class="input" placeholder="姓名" value="{{name}}" bindinput="onInputName" />
      <t-button class="btn-primary" bindtap="onSubmit" disabled="{{!isOnline || submitting}}">
        {{submitting ? '提交中...' : '完成绑定'}}
      </t-button>
    </view>
  </view>
</view>
```

**Step 2: Register components**

```json
{
  "navigationBarTitleText": "注册绑定",
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button",
    "t-tag": "tdesign-miniprogram/tag/tag"
  }
}
```

**Step 3: Commit**

```bash
git add src/pages/register/register.wxml src/pages/register/register.json

git commit -m "feat: use tdesign controls on register"
```

---

### Task 8: Add 个人中心 page

**Files:**
- Create: `src/pages/profile/profile.wxml`
- Create: `src/pages/profile/profile.json`
- Create: `src/pages/profile/profile.js`
- Create: `src/pages/profile/profile.wxss`

**Step 1: Create `profile.wxml`**

```xml
<view class="page page-profile">
  <view class="content">
    <view class="header">
      <text class="title">个人中心</text>
      <view class="title-line"></view>
    </view>

    <view class="card">
      <view class="profile-row">
        <view class="avatar"></view>
        <view class="profile-info">
          <text class="profile-name">{{name || '未绑定'}}</text>
          <text class="profile-meta">{{studentId || '学号未设置'}} · {{wxIdentity ? '微信已识别' : '未识别'}}</text>
        </view>
      </view>
      <view class="divider"></view>
      <view class="info-row">
        <text class="label">身份状态</text>
        <t-tag class="tag">{{isBound ? '已绑定' : '未绑定'}}</t-tag>
      </view>
      <t-button class="btn-primary" bindtap="goBind">{{isBound ? '重新绑定' : '去绑定'}}</t-button>
    </view>
  </view>
</view>
```

**Step 2: Create `profile.json`**

```json
{
  "navigationBarTitleText": "个人中心",
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button",
    "t-tag": "tdesign-miniprogram/tag/tag"
  }
}
```

**Step 3: Create `profile.js`**

```js
const storage = require("../../utils/storage");

Page({
  data: {
    name: "",
    studentId: "",
    wxIdentity: "",
    isBound: false
  },
  onShow() {
    this.setData({
      name: storage.getName(),
      studentId: storage.getStudentId(),
      wxIdentity: storage.getWxIdentity(),
      isBound: storage.isBound()
    });
  },
  goBind() {
    wx.navigateTo({ url: "/pages/register/register" });
  }
});
```

**Step 4: Create `profile.wxss`**

```css
.profile-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(101, 240, 194, 0.5);
  background: radial-gradient(circle at 30% 30%, rgba(101, 240, 194, 0.25), rgba(15, 23, 42, 0.9));
}

.profile-info {
  display: flex;
  flex-direction: column;
}

.profile-name {
  font-size: 30rpx;
  font-weight: 600;
}

.profile-meta {
  font-size: 22rpx;
  color: var(--muted);
  margin-top: 6rpx;
}
```

**Step 5: Commit**

```bash
git add src/pages/profile

git commit -m "feat: add minimal profile page"
```

---

### Task 9: Update `docs/changes.md`

**Files:**
- Modify: `docs/changes.md`

**Step 1: Append a new 2026-02-03 section**

Include bullet points for:
- Obsidian Grid dark theme applied
- TDesign Miniprogram dependency added
- Updated four pages to dark minimal UI + TDesign buttons/tags
- Added 个人中心 tab/page

**Step 2: Commit**

```bash
git add docs/changes.md

git commit -m "docs: log Moonshot UI changes"
```

---

### Task 10: Manual verification

**Step 1: Open project in WeChat DevTools**
- Build NPM packages
- Verify 5 pages render with dark theme
- Confirm tab navigation and action buttons
- Confirm network banner + status cards visible

**Step 2: Record results in `progress.md`**

---

## Notes
- There is no automated test harness; rely on manual verification in DevTools.
- Keep JS logic unchanged unless required by UI bindings.
- Follow `docs/plans/2026-02-03-moonshot-miniapp-tdesign-design.md` for visual intent.
