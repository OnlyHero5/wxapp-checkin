# 手机 Web 改造文档审查与基线说明

文档版本: v1.0  
状态: 审查结论  
更新日期: 2026-03-09  
项目: `wxapp-checkin`

## 1. 文档目的

本文档用于回答三件事：

- 当前“微信小程序转手机 Web 前端”的改造计划是否合理；
- 现有文档体系是否完整、是否存在冲突；
- 后续实施时应以哪些文档为正式基线。

## 2. 审查结论

### 2.1 结论摘要

结论：改造大方向已被证明合理，且 2026-03-10 已完成 Web-only 主链路收口；本文后续内容保留为迁移复盘，而不是“仍待开始的改造方案”。

合理之处：

- 前端必须重建为 `web/`，不能在现有小程序页面上做低成本平移。
- 后端不需要推倒重来，活动、会话、状态流转、同步回写主干可以继续复用。
- 将 `suda_union` 继续作为只读实名/报名事实源，并保留 outbox 最终一致性回写，是当前代码基础上风险最低的路线。
- 动态 6 位码替代二维码后，单独抽出 Web 身份、Passkey、浏览器绑定、解绑审核，是必要而不是过度设计。

需要持续锁定的实现口径：

- Passkey 上线所需的部署口径仍需显式收敛，例如 RP ID / Origin、HTTPS、会话 TTL、绑定口径、限流键。
- 2026-03-09 审查时点的历史主实现仍是“小程序 + 二维码”；当前仓库已经完成 Web-only 收口，但 README、运维说明、测试说明仍要明确标出哪些内容只是历史参考。

### 2.2 代码证据

前端必须重建：

- `frontend/` 普遍使用 `App()` / `Page()` / `Component()`，不是 Web 框架组件模型。
- 登录链路绑定 `wx.login()`，见 `frontend/utils/auth.js`。
- 请求、提示、导航、存储都绑定 `wx.*`，见 `frontend/utils/request-core.js`、`frontend/utils/ui.js`、`frontend/utils/storage.js`。
- 普通用户主动作仍是 `wx.scanCode()` 扫码，见 `frontend/pages/scan-action/scan-action.js`。

后端可复用主干：

- 活动查询主干在 `backend/.../ActivityQueryService.java`，仍可作为 Web 活动列表/详情底座。
- 会话读取与过期判断已集中在 `backend/.../SessionService.java`。
- 状态变更、事件审计、replay guard、outbox 回写已集中在 `backend/.../CheckinConsumeService.java`。
- `LegacySyncService` 与 `OutboxRelayService` 已覆盖 `suda_union` 读写同步边界。

需要按设计补改的代码风险：

- 当前鉴权仍以微信身份为核心，见 `backend/.../AuthService.java` 与 `backend/.../WeChatIdentityResolver.java`。
- 当前管理员发码仍是二维码 payload，见 `backend/.../QrSessionService.java`。
- 当前用户提交仍以 `qr_payload` 消费，见 `backend/.../CheckinConsumeService.java` 与 `backend/.../CheckinController.java`。
- 当前活动计数仍是读后写更新，共享 6 位码会放大并发冲突，需按实施计划改为原子更新。

## 3. 文档现状判断

### 3.1 当前正式基线

以下文档是当前唯一正式产品基线：

- `docs/REQUIREMENTS.md`
- `docs/FUNCTIONAL_SPEC.md`
- `docs/API_SPEC.md`

### 3.2 当前补充文档

以下文档是正式基线的补充说明：

- `docs/WEB_DESIGN.md`
- `docs/WEB_COMPATIBILITY.md`
- `docs/WEB_MIGRATION_REVIEW.md`
- `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`

### 3.3 当前历史参考与迁移基座文档

以下文档不再定义产品基线，只用于理解现状代码、部署和测试环境：

- `backend/README.md`
- `backend/DB_DATABASE_DEEP_DIVE.md`
- `backend/TEST_ENV_TESTING.md`
- 2026-03-10 删旧前的历史审查结论

### 3.4 本轮收口动作

- 将 Web 需求、功能和接口正式并入：
  - `docs/REQUIREMENTS.md`
  - `docs/FUNCTIONAL_SPEC.md`
  - `docs/API_SPEC.md`
- 保留 `docs/WEB_DESIGN.md`、`docs/WEB_COMPATIBILITY.md`、本文档和实施计划作为补充文档。
- 更新根 `README.md`、`backend/README.md`、`backend/DB_DATABASE_DEEP_DIVE.md`、`backend/TEST_ENV_TESTING.md` 的定位说明。
- 删除重复文档：
  - `docs/WEB_REQUIREMENTS.md`
  - `docs/WEB_API_SPEC.md`

## 4. 当前推荐阅读顺序

如果目标是开始做手机 Web 改造，请按下面顺序阅读：

1. `docs/WEB_MIGRATION_REVIEW.md`
2. `docs/REQUIREMENTS.md`
3. `docs/FUNCTIONAL_SPEC.md`
4. `docs/API_SPEC.md`
5. `docs/WEB_DESIGN.md`
6. `docs/WEB_COMPATIBILITY.md`
7. `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`

如果目标是排查当前历史实现或联调基座，再回看：

1. `backend/README.md`
2. `backend/DB_DATABASE_DEEP_DIVE.md`
3. `backend/TEST_ENV_TESTING.md`
4. 本文中的历史审查证据

## 5. 仍需在实现前锁定的口径

以下内容已经在设计里隐含存在，但还需要在实现阶段显式钉死到代码与部署配置中：

- Passkey 的 `RP ID`、`Origin`、本地开发域名与正式域名方案；
- Web 会话 TTL 的目标值，以及解绑审批后旧会话失效策略；
- 浏览器绑定的唯一性口径：
  - 是以服务端签发的持久浏览器标识为主；
  - 还是以指纹哈希为辅、签发标识为主；
- 动态码错误尝试的限流维度：
  - `user_id + activity_id`
  - `binding_id + activity_id`
  - `IP + activity_id`
- Web 前端与后端的部署关系：
  - 同域部署；
  - 还是跨域部署并配置 CORS。

这些内容不影响“总体路线是否合理”的判断，但会直接影响后续编码与上线。

## 6. 审查结论的最终口径

- 方案方向合理，可以继续推进。
- 当前最需要避免的风险不是“设计错了”，而是“团队继续把历史小程序资料当正式基线”。
- 从本轮开始，凡是新 Web 功能开发，均应以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 为正式基线，并结合设计、兼容性与实施计划落地。
- 历史小程序相关文档仅用于理解当前代码和迁移对照。
