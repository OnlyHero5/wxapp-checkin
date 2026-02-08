# QR 前端主导改造 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将二维码相关能力改为前端主导，显著降低后端高频换码压力，同时保留必要的后端安全校验。

**Architecture:** 工作人员端在前端本地生成并轮换二维码；普通用户端前端扫码并解析；后端仅承担“低频发放签名材料 + 最终 consume 校验 + 防重放入库”。

**Tech Stack:** WeChat Mini Program (`wx.scanCode`, canvas)、`weapp-qrcode`/`weapp-qrcode-canvas-2d`、现有 `src/utils/api.js`。

## 1. 现状复盘（代码）
- 现状每 10 秒换码依赖后端接口：`src/pages/staff-qr/staff-qr.js:166` -> `api.createStaffQrSession`。
- 后端 mock 会话创建与解析集中在：`src/utils/api.js:309`、`src/utils/api.js:333`、`src/utils/api.js:545`。
- 普通用户扫码提交依赖：`src/pages/scan-action/scan-action.js:211` -> `api.consumeCheckinAction`（`src/utils/api.js:720`）。

## 2. 联网调研结论（硬约束）
1. `wx.scanCode` 可直接返回二维码内容；扫到小程序码时返回 `path`（含 `scene`）。
2. `wxacode.getUnlimited` 文档标注应在服务端调用，并受 `scene` 长度限制（32 可见字符）。
3. 客户端硬编码密钥可被逆向提取；授权与对象访问校验需服务端逐请求执行。
4. 一次性口令类方案可用 RFC 4226/6238 的时间窗口与防重放原则。

## 3. 架构选项对比
### 方案 A：纯前端离线判定（不推荐）
- 做法：前端生成码 + 前端判定有效性 + 本地累计后再同步。
- 优点：后端压力最低。
- 缺点：安全不可控（可伪造、可重放、可越权），不适合生产签到。

### 方案 B：前端本地轮换 + 后端下发短时 seed（轻后端）
- 做法：后端只在页面打开时下发短时 seed；前端按 slot 本地生成 token；后端 consume 时按同算法校验。
- 优点：后端换码接口压力最低。
- 缺点：seed 落在客户端，存在被提取后伪造风险（需极短 TTL + 设备绑定 + 强风控）。

### 方案 C：前端本地轮换 + 后端批量预签 token（推荐）
- 做法：后端低频返回未来 N 个时间片 token（如 5-10 分钟）；前端本地定时切换展示；consume 只做签名验真+防重放。
- 优点：
  - 相比当前每 10 秒请求一次，后端生成压力可降一个数量级以上；
  - 私钥不下放客户端，安全性明显高于方案 B；
  - 前端体验仍是“本地即时换码”。
- 缺点：需要新增/改造一个“批量签发”协议。

## 4. 推荐路线（采用方案 C）
### Phase 0: 协议冻结（0.5 天）
- 冻结 token 结构：`version.activityId.actionType.slot.nonce.sig`（短编码，兼容 `scene<=32` 或普通二维码文本）。
- 明确窗口：`rotate=10s`、`grace=20s`（保持现有体验）。
- 明确重放键：`activityId + actionType + slot + userId`。

### Phase 1: 后端“减负改造”最小集（0.5-1 天）
- 将高频 `/qr-session` 改为低频批量签发（可复用原接口返回批次数据）。
- `consume` 增加：签名验真、slot 窗口校验、防重放校验。
- 可选：活动详情轮询从 3s 放宽到 10-15s，进一步减压。

### Phase 2: 前端 staff-qr 前端化（1 天）
- 引入二维码绘制库，改为本地渲染当前 slot token。
- 本地计时器驱动换码；批次余量低于阈值时后台续批。
- 保留手动刷新和断网提示。

### Phase 3: 前端 scan-action 兼容（0.5 天）
- 统一解析普通二维码字符串 + 小程序码 `path/scene`。
- consume 失败场景细化：过期、重放、无权限、活动已结束。

### Phase 4: 验证与灰度（0.5 天）
- 压测对比：当前模式 vs 批量签发模式（接口调用次数、平均响应时间）。
- 安全回归：重放攻击、越权活动 ID、过期 token。
- 文档更新：`docs/API_SPEC.md`、`docs/FUNCTIONAL_SPEC.md`、`README.md`。

## 5. 预期收益
- 后端换码接口调用频次从“每活动每 10 秒一次”降至“每活动每 5-10 分钟一次批量请求”。
- 前端换码体验不变（仍可 10 秒滚动）。
- 安全性维持服务端最终裁决，不把核心签名密钥暴露在客户端。

## 6. 需要你确认的决策点
1. 是否同意从“小程序码主路径”切换为“普通二维码文本主路径”（保留对 `scene` 的兼容解析）？
2. 是否接受推荐方案 C（批量预签）作为正式方案，而不是更轻但更冒险的 seed 下放方案？
3. 轮换/宽限窗口是否继续保持 `10s + 20s`？

## Sources
- https://wdk-docs.github.io/wxadev-docs/api/wx.scanCode.html
- https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/openapi/wxacode/wxacode.getUnlimited.html
- https://www.aigwa.com/novel/Content/detail/35.html
- https://github.com/wuxudong/weapp-qrcode
- https://github.com/wuxudong/weapp-qrcode-canvas-2d
- https://www.rfc-editor.org/rfc/rfc6238
- https://www.rfc-editor.org/rfc/rfc4226
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- https://mas.owasp.org/MASWE/MASVS-AUTH/MASWE-0005/
- https://developer.android.com/privacy-and-security/risks/hardcoded-cryptographic-secrets
