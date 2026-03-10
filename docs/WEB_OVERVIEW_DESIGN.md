# 手机 Web 动态验证码签到概要设计说明书

文档版本: v1.0
状态: 实施执行稿
更新日期: 2026-03-09
项目: `wxapp-checkin`
定位: 本文档基于当前正式基线与现有实施计划整理，作为后续分阶段编码的大图说明，不替代 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md`。

## 1. 编写目的

本文档用于回答后续实施最先要统一的 5 个问题：

- 这次改造到底替换什么、保留什么；
- 目标系统的总体结构是什么；
- 核心业务闭环如何跑通；
- 为什么必须“前端重建 + 后端演进”，而不是继续在小程序上修补；
- 后续编码应按什么阶段推进，才能尽量降低返工。

## 2. 输入基线

本概要设计是在完整阅读以下材料后整理形成：

- 正式产品基线：
  - `docs/REQUIREMENTS.md`
  - `docs/FUNCTIONAL_SPEC.md`
  - `docs/API_SPEC.md`
- 补充设计与实施材料：
  - `docs/WEB_DESIGN.md`
  - `docs/WEB_COMPATIBILITY.md`
  - `docs/WEB_MIGRATION_REVIEW.md`
  - `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`
- 当前代码与迁移基座：
  - `frontend/` 历史微信小程序实现
  - `backend/` Spring Boot 后端
  - `backend/DB_DATABASE_DEEP_DIVE.md`
  - `backend/README.md`

## 3. 改造结论摘要

当前改造路线已经明确，可以直接进入实施准备阶段，结论如下：

- 前端必须新建 `web/`，不能继续在 `frontend/` 小程序工程上做平移式改造。
- 后端不需要推倒重来，但需要把“微信登录 + 二维码签发/消费”重构为“Web 身份 + Passkey + 动态 6 位码”。
- `suda_union` 继续作为实名、报名与最终回写的事实源，仅允许只读查询和最终一致性回写，不做业务逻辑改造。
- `wxapp-checkin` 的扩展库、状态机、会话、outbox、活动投影等后端主干具有复用价值。
- 最终目标不是“双前端长期并行”，而是 Web 路线稳定后彻底删除小程序正式链路。

## 4. 设计目标与非目标

### 4.1 设计目标

- 建立纯手机浏览器 Web 版签到/签退系统。
- 以“实名绑定 + Passkey 登录 + 临时会话 + 浏览器唯一绑定”替代当前微信小程序登录模型。
- 以“管理员动态 6 位码展示 + 用户输入 6 位码提交”替代当前二维码扫码模型。
- 保留 `wxcheckin_ext` 主写库、`wx_sync_outbox` 同步回写与 `suda_union` 事实读取链路。
- 为后续分阶段编码提供清晰的模块边界、文件落点与阶段拆分。

### 4.2 非目标

- 不继续增强微信小程序产品能力。
- 不改造 `suda_union/` 与 `suda-gs-ams/` 业务逻辑。
- 不引入短信验证码、人脸识别、身份证 OCR 等新身份体系。
- 不承诺桌面端最佳体验。

## 5. 关键约束

- 只允许改动 `wxapp-checkin/`。
- 正式业务形态是手机 Web，不再以微信小程序作为产品基线。
- 首次使用必须通过 `student_id + name` 做实名校验。
- 登录必须经过 Passkey 验证。
- 一个账号默认仅允许一个活跃浏览器绑定。
- 更换浏览器或更换设备必须经过管理员解绑审核。
- 动态码按 `activity + action_type + 10 秒时间片` 生成。
- 同活动、同动作、同时间片内所有管理员看到同一个 6 位码。
- 所有时效判断以后端时间为准。
- 正式环境必须运行在 HTTPS。

## 6. 总体架构

### 6.1 系统上下文

```text
┌──────────────────────────────────────────────┐
│ 手机浏览器 Web 前端                          │
│ - normal 用户                                │
│ - staff / review_admin 管理员                │
└───────────────────┬──────────────────────────┘
                    │ HTTPS + JSON
┌───────────────────▼──────────────────────────┐
│ wxapp-checkin/backend                        │
│ - Web 身份与 Passkey                          │
│ - 活动查询与可见性                            │
│ - 动态码生成与消费                            │
│ - 批量签退与解绑审核                          │
│ - 会话、审计、同步                            │
└───────────────┬───────────────────────┬──────┘
                │                       │
┌───────────────▼──────────────┐ ┌──────▼───────────────┐
│ wxcheckin_ext                │ │ suda_union           │
│ 扩展域主写库                 │ │ 实名/报名事实源 + 回写 │
└──────────────────────────────┘ └──────────────────────┘
```

### 6.2 仓库级模块边界

| 路径 | 角色 | 目标状态 |
| --- | --- | --- |
| `web/` | 新手机 Web 前端 | 新建并逐步成为唯一前端 |
| `backend/` | 唯一业务后端 | 保留主干并做 Web 化重构 |
| `frontend/` | 历史小程序 | 迁移参考，最终删除 |
| `docs/` | 需求、设计、计划、兼容性 | 作为唯一文档入口持续更新 |

## 7. 核心业务闭环

### 7.1 闭环一：实名绑定与登录

1. 未绑定用户访问 `/login`。
2. 前端判断当前浏览器无有效绑定，跳转 `/bind`。
3. 用户提交 `student_id + name`。
4. 后端只读查询 `suda_union` 完成实名校验，并生成一次性 `bind_ticket`。
5. 前端拉取 Passkey 注册 challenge。
6. 浏览器完成 `navigator.credentials.create()`。
7. 后端保存身份扩展、浏览器绑定、Passkey 凭据并签发 `session_token`。
8. 用户进入 `/activities`。

### 7.2 闭环二：管理员展示动态码，用户输入动态码

1. 管理员进入 `/staff/activities/:id/manage`。
2. 前端请求 `/api/web/activities/{id}/code-session`。
3. 后端基于 `activity_id + action_type + slot + secret` 生成稳定 6 位码。
4. 管理员看到当前动态码、剩余有效时间与签到统计。
5. 普通用户进入具体活动的签到页或签退页。
6. 用户输入 6 位码后提交 `/api/web/activities/{id}/code-consume`。
7. 后端校验会话、绑定、报名资格、状态、动态码、防重放和时间片。
8. 成功后写状态、事件、replay guard、outbox，并更新活动统计。

### 7.3 闭环三：解绑审核与一键全部签退

1. 用户发起解绑申请，形成待审记录。
2. 管理员在 `/staff/unbind-reviews` 审核申请。
3. 审核通过后失效旧绑定、旧会话，并允许重新绑定。
4. 审核拒绝后保持原绑定状态不变。
5. 管理员在活动管理页执行“一键全部签退”。
6. 后端只处理“已签到未签退”的用户，并统一使用服务端时间作为签退时间。
7. 批量写状态、事件、管理员审计与 outbox。

## 8. 模块拆分原则

### 8.1 前端模块

- `auth`：实名绑定、Passkey 注册、Passkey 登录、会话恢复。
- `activities`：活动列表、活动详情、活动状态显示。
- `attendance`：签到码输入、签退码输入、结果反馈。
- `staff`：动态码展示、前台恢复刷新、一键全部签退。
- `review`：解绑申请、审核列表、审批动作。
- `shared`：HTTP 客户端、会话存储、能力探测、页面生命周期、通用移动端 UI。

### 8.2 后端模块

- `WebAuthController + WebIdentityService`：实名校验、Passkey challenge、登录与会话签发。
- `WebActivityController + ActivityQueryService`：活动列表、活动详情、可见性与用户状态。
- `WebAttendanceController + DynamicCodeService + CheckinConsumeService`：发码、验码、状态流转、防重放、事件审计。
- `WebStaffController + BulkCheckoutService + UnbindReviewService`：批量签退、解绑申请与审核。
- `OutboxRelayService + LegacySyncService`：最终一致性回写和 legacy 同步。

## 9. 复用与重写边界

### 9.1 可直接复用或轻改的部分

- `backend` 中的活动查询、用户状态、会话抽取、错误处理、outbox 回写。
- 现有扩展表：
  - `wx_session`
  - `wx_activity_projection`
  - `wx_user_activity_status`
  - `wx_checkin_event`
  - `wx_replay_guard`
  - `wx_sync_outbox`
  - `wx_admin_roster`

### 9.2 必须重构的部分

- 微信登录链路：
  - `AuthController`
  - `AuthService`
  - `WeChatIdentityResolver`
- 二维码签发/消费链路：
  - `ActivityController` 中的 `qr-session`
  - `CheckinController`
  - `QrSessionService`
  - `CheckinConsumeService` 中与 `qr_payload` 强耦合的部分
- 小程序前端：
  - `frontend/pages/**`
  - `frontend/utils/**`
  - 依赖 `wx.*` 的运行时能力

## 10. 迁移阶段建议

### Phase 0: 实施前锁口

- 锁定 Passkey `RP ID` / `Origin` / 本地开发域名。
- 锁定会话 TTL、解绑后旧会话失效策略。
- 锁定浏览器绑定唯一性口径与指纹辅助策略。
- 锁定动态码限流维度。

### Phase 1: 前端骨架与公共基础层

- 建立 `web/` 工程。
- 建立路由、会话存储、HTTP 客户端、能力探测和移动端基线样式。

### Phase 2: Web 身份与登录

- 实现实名绑定页。
- 实现 Passkey 注册 / 登录页。
- 实现浏览器不支持提示与登录态恢复。

### Phase 3: 活动与动态码主链路

- 实现活动列表、活动详情、签到页、签退页。
- 实现动态码展示页与前台恢复刷新。
- 后端完成 `/api/web/**` 主链路接口。

### Phase 4: 管理员能力与审核

- 实现一键全部签退。
- 实现解绑申请和审核。
- 增加管理员审计能力。

### Phase 5: 并发治理、联调回归与删旧

- 修复活动统计并发更新。
- 增加 Playwright 真机/模拟机回归。
- 删除小程序与旧微信/二维码正式链路。

## 11. 核心风险与对策

| 风险 | 说明 | 对策 |
| --- | --- | --- |
| Passkey 上线口径未锁定 | `RP ID`、`Origin`、域名和 HTTPS 口径不清会导致实现后不可用 | Phase 0 先锁口，再进入编码 |
| 浏览器绑定定义漂移 | 只靠本地存储或不明确的指纹策略会导致换机和解绑流程混乱 | 服务端持久化绑定为主，指纹只作风控辅助 |
| 共享 6 位码下并发高 | 多人同一时间片提交会放大计数更新冲突 | 统计更新改为原子 SQL 或显式锁 |
| 前后台切换导致倒计时漂移 | 手机浏览器后台定时器不可靠 | 一切以后端时间为准，回前台强制刷新 |
| 文档基线混用 | 团队误把历史小程序文档当正式基线 | 开发入口统一使用 Web 正式基线和本执行包 |

## 12. 交付物关系

建议后续阅读与执行顺序如下：

1. `docs/WEB_MIGRATION_REVIEW.md`
2. `docs/REQUIREMENTS.md`
3. `docs/FUNCTIONAL_SPEC.md`
4. `docs/API_SPEC.md`
5. `docs/WEB_OVERVIEW_DESIGN.md`
6. `docs/WEB_DETAIL_DESIGN.md`
7. `docs/plans/2026-03-09-web-detailed-coding-plan.md`
8. `docs/plans/2026-03-09-web-todo-list.md`

## 13. 本文档的使用方式

- 统一大图时看本文档。
- 落具体类、表、接口、页面时看 `WEB_DETAIL_DESIGN.md`。
- 真正进入分阶段编码时以 `2026-03-09-web-detailed-coding-plan.md` 和 `2026-03-09-web-todo-list.md` 为执行入口。
