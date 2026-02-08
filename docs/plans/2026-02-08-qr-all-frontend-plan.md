# QR 全前端化（后端仅业务计算）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 二维码生成、轮换、渲染、扫码解析全部在小程序端完成；后端只做业务规则校验与数据落库。

**Architecture:** 管理员端在本地按时间片生成二维码文本并渲染 canvas；普通用户端扫码得到文本后上报业务接口；后端不再生成二维码/二维码会话，仅依据业务状态（活动时间、权限、重复提交、状态流转）进行判定。

**Tech Stack:** WeChat Mini Program (`wx.scanCode`, canvas)、`weapp-qrcode-canvas-2d`（或 `weapp-qrcode`）、现有 `src/utils/api.js`。

## 方案边界（按你的要求）
- 不使用微信官方二维码生成接口（`wxacode`）。
- 不让后端承担高频“每 10 秒换码”负载。
- 后端仅处理业务：活动有效性、角色权限、签到签退状态、重复提交、统计更新。

## 风险说明（必须明确）
- 如果后端完全不校验二维码来源，仅校验业务字段，二维码内容可被伪造。
- 因此建议保留“业务级防伪”最小集合：
  1. 服务端时间窗校验（slot + grace）
  2. 活动状态与权限校验
  3. 防重放键（userId + activityId + actionType + slot）
  4. 频率限制（同用户短时请求限制）
- 上述校验都属于业务计算，不属于“后端生成二维码”。

## Task 1: 抽离前端二维码 payload 规范
**Files:**
- Create: `src/utils/qr-payload.js`
- Modify: `src/pages/staff-qr/staff-qr.js`
- Modify: `src/pages/scan-action/scan-action.js`
- Test: `src/tests/qr-checkin-flow.test.js`

**Step 1: 定义统一 payload 格式**
- 文本格式：`wxcheckin:v1:<activityId>:<actionType>:<slot>:<nonce>`
- `slot` = `Math.floor(serverNowMs / (rotateSeconds*1000))`

**Step 2: 提供工具函数**
- `buildQrPayload({ activityId, actionType, slot, nonce })`
- `parseQrPayload(text)`
- `isSlotExpired({ slot, nowMs, rotateSeconds, graceSeconds })`

**Step 3: 测试先行**
Run: `node src/tests/qr-checkin-flow.test.js`
Expected: 增加针对 build/parse/过期判断的失败用例

## Task 2: staff-qr 改为纯前端换码与渲染
**Files:**
- Modify: `src/pages/staff-qr/staff-qr.js`
- Modify: `src/pages/staff-qr/staff-qr.wxml`
- Modify: `src/pages/staff-qr/staff-qr.wxss`
- Modify: `src/package.json`

**Step 1: 引入二维码绘制库**
- 安装 `weapp-qrcode-canvas-2d`（或保留等价库）

**Step 2: 移除高频后端换码调用**
- 删除/下线当前每秒倒计时触发 `refreshQrSession({auto:true})` 的高频网络逻辑
- 改为本地计时器每 10 秒生成下一个 `payload`

**Step 3: 本地渲染二维码**
- 使用 canvas 渲染当前 payload
- 保留“手动刷新”按钮，仅重置本地 nonce/slot，不调用后端换码接口

**Step 4: UI 回归**
- 倒计时文案仍展示“显示剩余/提交宽限”

## Task 3: scan-action 扫码解析前端化
**Files:**
- Modify: `src/pages/scan-action/scan-action.js`
- Modify: `src/utils/api.js`
- Test: `src/tests/qr-checkin-flow.test.js`

**Step 1: 统一扫码结果提取**
- 保留现有 `path/result` 解析
- 优先解析 `wxcheckin:v1:...` 文本；兼容旧 `scene` 数据

**Step 2: consume 请求字段调整**
- 发送结构化业务字段：`activity_id/action_type/slot/nonce/raw_result`
- 后端不再依赖“会话二维码池”解析 payload

**Step 3: 错误语义稳定**
- 保持 `success/duplicate/expired/forbidden/invalid_qr`

## Task 4: 后端（mock）收敛为业务计算
**Files:**
- Modify: `src/utils/api.js`
- Test: `src/tests/qr-checkin-flow.test.js`

**Step 1: 删除二维码生成职责**
- 下线 `createQrSession` 与 `qrSessions` 动态换码存储逻辑
- `createStaffQrSession` 改为可选：仅返回业务配置（`rotate_seconds/grace_seconds/server_time`）

**Step 2: consume 只做业务判定**
- 校验 activity 是否存在/是否进行中
- 校验 action 与活动规则（是否支持签退）
- 校验 slot 是否在可接受窗口
- 校验重复提交与状态流转
- 更新 `checkin_count/checkout_count` 和个人状态

**Step 3: 安全兜底（业务层）**
- 加入用户级限流（mock 可简化为内存计数）

## Task 5: 文档与回归
**Files:**
- Modify: `docs/API_SPEC.md`
- Modify: `docs/FUNCTIONAL_SPEC.md`
- Modify: `docs/REQUIREMENTS.md`
- Modify: `README.md`
- Modify: `docs/changes.md`
- Modify: `changes.md`

**Step 1: 明确“二维码前端生成，后端仅业务计算”**
**Step 2: 写清 payload 格式与窗口规则**
**Step 3: 更新联调清单与异常码说明**

## 验收标准
1. staff 页面断网情况下仍可本地换码和渲染。
2. 普通用户扫码后，后端仅依赖业务字段完成判定。
3. 不再存在“每 10 秒一次后端生成二维码”的请求。
4. 所有旧测试 + 新增测试通过。

## 建议实施顺序
1. 先做 Task 1 + Task 4（协议与业务校验稳定）
2. 再做 Task 2 + Task 3（页面行为改造）
3. 最后 Task 5（文档收口）
