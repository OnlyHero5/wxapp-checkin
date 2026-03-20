# 手机 Web 改造文档审查与基线说明

文档版本: v1.0  
状态: 审查结论  
更新日期: 2026-03-10  
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
- 动态 6 位码替代二维码后，单独抽出 Web 身份（账号密码 + 强制改密）与会话层，并在接口层收口错误码与契约字段，是必要而不是过度设计。

需要持续锁定的实现口径：

- 账号密码登录基线需要显式收敛：默认密码、强制改密拦截点、会话 TTL、以及动态码限流键。
- 2026-03-09 审查时点的历史主实现仍是“小程序 + 二维码”；当前仓库已经完成 Web-only 收口，但 README、运维说明、测试说明仍要明确标出哪些内容只是历史参考。

### 2.2 代码证据

前端必须重建：

- 历史小程序前端（已删除）强耦合 `App()/Page()/Component()` 与 `wx.*` API（登录、扫码、导航、存储），无法作为手机 Web 的工程基座复用，因此必须新建 `web/`。

后端可复用主干：

- 活动查询主干在 `backend/.../ActivityQueryService.java`，仍可作为 Web 活动列表/详情底座。
- 会话读取与过期判断已集中在 `backend/.../SessionService.java`。
- 状态变更、事件审计、replay guard、outbox 回写已集中在 `backend/.../CheckinConsumeService.java`。
- `LegacySyncService` 与 `OutboxRelayService` 已覆盖 `suda_union` 读写同步边界。

需要按设计补改的代码风险（已在主干收口完成）：

- ✅ 鉴权已切换为“账号密码 + session_token + 首次强制改密”，微信登录相关实现已删除：`backend/src/main/java/com/wxcheckin/backend/application/service/WebPasswordAuthService.java`
- ✅ 管理员发码已切换为动态 6 位码：`backend/src/main/java/com/wxcheckin/backend/application/service/DynamicCodeService.java`
- ✅ 普通用户提交已切换为 `code`（不再接收 `qr_payload`）：`backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java`
- ✅ 活动计数更新已改为原子路径：`backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxActivityProjectionRepository.java`

## 3. 文档现状判断

### 3.1 当前正式基线

以下文档是当前唯一正式产品基线：

- `docs/REQUIREMENTS.md`
- `docs/FUNCTIONAL_SPEC.md`
- `docs/API_SPEC.md`

### 3.2 当前补充文档

以下文档是正式基线的补充说明：

- `docs/WEB_OVERVIEW_DESIGN.md`
- `docs/WEB_DETAIL_DESIGN.md`
- `docs/WEB_COMPATIBILITY.md`
- `docs/WEB_MIGRATION_REVIEW.md`
- `docs/plans/2026-03-10-http-password-auth-implementation-plan.md`

### 3.3 部署文档与历史参考

以下文档不再定义产品基线；其中部署文档用于当前运维/联调，历史资料只用于复盘：

- `docs/DEPLOYMENT.md`
- `backend/README.md`
- `backend/DB_DATABASE_DEEP_DIVE.md`
- `backend/TEST_ENV_TESTING.md`
- `docs/WEB_DESIGN.md`
- `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`
- 2026-03-10 删旧前的历史审查结论

### 3.4 本轮收口动作

- 将 Web 需求、功能和接口正式并入：
  - `docs/REQUIREMENTS.md`
  - `docs/FUNCTIONAL_SPEC.md`
  - `docs/API_SPEC.md`
- 保留 `docs/WEB_OVERVIEW_DESIGN.md`、`docs/WEB_DETAIL_DESIGN.md`、`docs/WEB_COMPATIBILITY.md`、本文档和当前实施计划作为补充文档。
- 更新根 `README.md`、`backend/README.md`、`backend/DB_DATABASE_DEEP_DIVE.md`、`backend/TEST_ENV_TESTING.md` 的定位说明。
- 删除重复文档：
  - `docs/WEB_REQUIREMENTS.md`
  - `docs/WEB_API_SPEC.md`

## 4. 当前推荐阅读顺序

如果目标是理解当前 Web-only 基线并继续维护，请按下面顺序阅读：

1. `docs/WEB_MIGRATION_REVIEW.md`
2. `docs/REQUIREMENTS.md`
3. `docs/FUNCTIONAL_SPEC.md`
4. `docs/API_SPEC.md`
5. `docs/DEPLOYMENT.md`
6. `docs/WEB_OVERVIEW_DESIGN.md`
7. `docs/WEB_DETAIL_DESIGN.md`
8. `docs/WEB_COMPATIBILITY.md`

如果目标是排查当前历史实现或联调基座，再回看：

1. `backend/README.md`
2. `backend/DB_DATABASE_DEEP_DIVE.md`
3. `backend/TEST_ENV_TESTING.md`
4. `docs/WEB_DESIGN.md`
5. `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`
6. 本文中的历史审查证据

## 5. 仍需在实现前锁定的口径

以下内容已经在设计里隐含存在，但还需要在实现阶段显式钉死到代码与部署配置中：

- 默认密码与强制改密口径（默认 `123` + 未改密前阻断业务接口）；
- Web 会话 TTL 的目标值，以及是否允许同一账号多端并发会话；
- 动态码错误尝试的限流维度：
  - `user_id + activity_id`
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
