# 手机 Web 动态验证码签到详细编码计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 按阶段把 `wxapp-checkin` 从“微信小程序 + 二维码”迁移到“手机 Web + 动态 6 位码”，并产出可验证、可回滚、可逐步删旧的实现结果。

**Architecture:** 新建 `web/` 作为唯一目标前端；`backend/` 保留活动、会话、状态与同步主干，新增 Web 身份、Passkey、动态码、解绑审核与批量签退能力；最后删除 `frontend/` 和旧微信/二维码正式链路。

**Tech Stack:** Vite、React、TypeScript、Vitest、Playwright、Spring Boot、JPA、Flyway、MySQL、WebAuthn/Passkey、现有 `suda_union` 同步链路。

---

## 实施原则

- 只修改 `wxapp-checkin/`。
- 每个阶段都要先补测试，再做最小实现，再跑验证。
- 每个阶段完成后立即提交，避免长时间堆叠大改动。
- 除最后删旧阶段外，不要过早删除历史代码，确保随时可对照和回滚。
- 先建立 Web 新链路，再切流、再删旧，不反过来做。

## 阶段 0：实施前锁口与基线固化

**目标：** 在编码前把最容易导致返工的部署、鉴权和风控口径钉死。

**前置依赖：**

- `docs/REQUIREMENTS.md`
- `docs/API_SPEC.md`
- `docs/WEB_DETAIL_DESIGN.md`

**涉及文件：**

- Modify: `docs/WEB_DETAIL_DESIGN.md`
- Modify: `docs/WEB_COMPATIBILITY.md`
- Optionally Modify: `backend/src/main/resources/application.yml`
- Optionally Modify: `backend/src/main/java/com/wxcheckin/backend/config/AppProperties.java`

**执行步骤：**

1. 锁定 Passkey `RP ID`、允许 `Origin`、本地域名、正式域名。
2. 锁定 Web 会话 TTL、解绑审批通过后的旧会话失效策略。
3. 锁定浏览器绑定口径：
   - 是否签发稳定 `binding_id`
   - 指纹哈希参与哪些因子
4. 锁定动态码风控：
   - 限流维度
   - 阈值
   - 解锁策略
5. 将最终口径补回文档，避免编码过程中口径漂移。

**验证命令：**

- Run: `rg -n "RP ID|Origin|TTL|限流|binding" docs/WEB_DETAIL_DESIGN.md docs/API_SPEC.md docs/WEB_COMPATIBILITY.md`
- Expected: 核心口径在文档中均可检索

**完成定义：**

- 后端和前端都知道正式域名 / 本地域名方案。
- 不再存在“做完代码后才发现 WebAuthn 域配置不对”的风险。

## 阶段 1：建立 `web/` 工程骨架

**目标：** 先把新前端宿主搭起来，形成可测试、可构建、可路由的最小壳层。

**依赖：** 阶段 0 完成。

**涉及文件：**

- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/app/App.tsx`
- Create: `web/src/app/router.tsx`
- Create: `web/src/app/styles/base.css`
- Create: `web/src/test/setup.ts`
- Test: `web/src/app/App.test.tsx`

**执行步骤：**

1. 先写 `App.test.tsx`，断言 `/login`、`/bind`、`/activities` 基础路由可渲染。
2. 初始化 Vite + React + TypeScript + Vitest 工具链。
3. 建立手机优先布局、路由入口和全局样式。
4. 跑单测与构建，确保新前端壳层可持续演进。
5. 提交一个只包含工程骨架的独立提交。

**验证命令：**

- Run: `cd web && npm install`
- Expected: 依赖安装成功
- Run: `cd web && npm test -- --run`
- Expected: 基础测试通过
- Run: `cd web && npm run build`
- Expected: 构建成功

**提交建议：**

```bash
git add web
git commit -m "feat(web): bootstrap mobile web app"
```

## 阶段 2：建立 Web 公共基础层

**目标：** 在所有业务页面之前先统一会话、HTTP、浏览器能力检测和页面生命周期。

**涉及文件：**

- Create: `web/src/shared/http/client.ts`
- Create: `web/src/shared/http/errors.ts`
- Create: `web/src/shared/session/session-store.ts`
- Create: `web/src/shared/device/browser-capability.ts`
- Create: `web/src/shared/device/page-lifecycle.ts`
- Create: `web/src/shared/ui/MobilePage.tsx`
- Create: `web/src/shared/ui/UnsupportedBrowser.tsx`
- Test: `web/src/shared/session/session-store.test.ts`
- Test: `web/src/shared/device/browser-capability.test.ts`

**执行步骤：**

1. 为会话读写和能力探测补失败测试。
2. 实现统一 HTTP 客户端，封装 `Authorization: Bearer`、错误码和 401 清理逻辑。
3. 实现 `session-store`，统一管理 `session_token`。
4. 实现 Passkey、`visibilitychange`、Wake Lock 能力探测。
5. 实现 `UnsupportedBrowser` 和手机宽容器基础组件。
6. 跑共享层测试并提交。

**验证命令：**

- Run: `cd web && npm test -- --run session-store browser-capability`
- Expected: 共享层测试通过

**提交建议：**

```bash
git add web/src/shared
git commit -m "feat(web): add shared session and capability layer"
```

## 阶段 3：实现实名绑定与 Passkey 登录前端

**目标：** 打通用户首次绑定和后续登录主链路。

**涉及文件：**

- Create: `web/src/features/auth/api.ts`
- Create: `web/src/features/auth/webauthn.ts`
- Create: `web/src/features/auth/components/IdentityBindForm.tsx`
- Create: `web/src/features/auth/components/PasskeyLoginPanel.tsx`
- Create: `web/src/pages/login/LoginPage.tsx`
- Create: `web/src/pages/bind/BindPage.tsx`
- Modify: `web/src/app/router.tsx`
- Test: `web/src/pages/login/LoginPage.test.tsx`
- Test: `web/src/pages/bind/BindPage.test.tsx`

**执行步骤：**

1. 为绑定页和登录页分别补失败测试。
2. 实现 `/bind`：
   - 学号姓名输入
   - 实名校验
   - Passkey 注册
3. 实现 `/login`：
   - 浏览器能力检测
   - Passkey 登录
   - 成功后写入会话
4. 实现登录成功后的路由跳转。
5. 跑前端测试并提交。

**验证命令：**

- Run: `cd web && npm test -- --run LoginPage BindPage`
- Expected: 登录与绑定相关测试通过

**提交建议：**

```bash
git add web/src/features/auth web/src/pages/login web/src/pages/bind web/src/app/router.tsx
git commit -m "feat(web): add identity bind and passkey login flows"
```

## 阶段 4：实现普通用户活动页与输入码页前端

**目标：** 打通普通用户的活动浏览、签到、签退主链路。

**涉及文件：**

- Create: `web/src/features/activities/api.ts`
- Create: `web/src/features/activities/components/ActivityCard.tsx`
- Create: `web/src/features/attendance/components/CodeInput.tsx`
- Create: `web/src/pages/activities/ActivitiesPage.tsx`
- Create: `web/src/pages/activity-detail/ActivityDetailPage.tsx`
- Create: `web/src/pages/checkin/CheckinPage.tsx`
- Create: `web/src/pages/checkout/CheckoutPage.tsx`
- Test: `web/src/pages/activities/ActivitiesPage.test.tsx`
- Test: `web/src/pages/checkin/CheckinPage.test.tsx`

**执行步骤：**

1. 为活动列表可见性和 6 位码输入控件补测试。
2. 实现活动列表页与活动详情页。
3. 实现签到页和签退页：
   - 当前活动名称
   - 当前动作类型
   - 6 位码输入
   - 结果反馈
4. 处理过期码、错误码、重复提交和会话失效。
5. 跑测试并提交。

**验证命令：**

- Run: `cd web && npm test -- --run ActivitiesPage CheckinPage`
- Expected: 活动与输入码相关测试通过

**提交建议：**

```bash
git add web/src/features/activities web/src/features/attendance web/src/pages/activities web/src/pages/activity-detail web/src/pages/checkin web/src/pages/checkout
git commit -m "feat(web): add user activities and code input pages"
```

## 阶段 5：实现管理员动态码、一键全部签退与解绑审核前端

**目标：** 补齐管理员侧 Web 能力。

**涉及文件：**

- Create: `web/src/features/staff/api.ts`
- Create: `web/src/features/staff/components/DynamicCodePanel.tsx`
- Create: `web/src/features/staff/components/BulkCheckoutButton.tsx`
- Create: `web/src/features/review/components/UnbindReviewList.tsx`
- Create: `web/src/pages/staff-manage/StaffManagePage.tsx`
- Create: `web/src/pages/unbind-reviews/UnbindReviewPage.tsx`
- Test: `web/src/pages/staff-manage/StaffManagePage.test.tsx`
- Test: `web/src/pages/unbind-reviews/UnbindReviewPage.test.tsx`

**执行步骤：**

1. 为动态码刷新、一键全部签退确认、解绑审核状态展示补测试。
2. 实现动态码管理页：
   - 切换 `checkin` / `checkout`
   - 展示剩余时间与统计
   - 监听 `visibilitychange`
3. 实现一键全部签退按钮和确认弹窗。
4. 实现解绑审核列表和审批动作。
5. 跑测试并提交。

**验证命令：**

- Run: `cd web && npm test -- --run StaffManagePage UnbindReviewPage`
- Expected: 管理员页面测试通过

**提交建议：**

```bash
git add web/src/features/staff web/src/features/review web/src/pages/staff-manage web/src/pages/unbind-reviews
git commit -m "feat(web): add staff manage and unbind review pages"
```

## 阶段 6：新增 Web 身份与审核数据库模型

**目标：** 给 Web 身份、浏览器绑定、解绑审核和管理员审计提供持久化基础。

**涉及文件：**

- Create: `backend/src/main/resources/db/migration/V6__add_web_identity_tables.sql`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebPasskeyCredentialEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebBrowserBindingEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebUnbindReviewEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WebAdminAuditLogEntity.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebPasskeyCredentialRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebBrowserBindingRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebUnbindReviewRepository.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WebAdminAuditLogRepository.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxUserAuthExtEntity.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/config/FlywayMigrationTest.java`

**执行步骤：**

1. 先补 migration 级失败测试。
2. 编写 Flyway 脚本，建立新表、索引和唯一约束。
3. 实现 Entity 和 Repository。
4. 扩展 `WxUserAuthExtEntity` 的 Web 语义字段。
5. 跑 migration 测试并提交。

**验证命令：**

- Run: `cd backend && ./mvnw test -Dtest=FlywayMigrationTest`
- Expected: migration 通过

**提交建议：**

```bash
git add backend/src/main/resources/db/migration/V6__add_web_identity_tables.sql backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository backend/src/test/java/com/wxcheckin/backend/config/FlywayMigrationTest.java
git commit -m "feat(backend): add web identity schema"
```

## 阶段 7：实现后端实名校验、Passkey 与会话接口

**目标：** 让前端绑定和登录可以打到真实后端。

**涉及文件：**

- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebAuthController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebBindVerifyRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyRegisterOptionsResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyRegisterCompleteRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyLoginOptionsResponse.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebPasskeyLoginCompleteRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/WebIdentityService.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/PasskeyChallengeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/SessionService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/LegacyUserLookupService.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/WebIdentityServiceTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/api/WebAuthControllerTest.java`

**执行步骤：**

1. 先为实名不匹配、绑定冲突、登录成功签发会话补失败测试。
2. 实现 `verify-identity` 与 `bind_ticket` 签发。
3. 实现注册 challenge 与登录 challenge 服务。
4. 实现 `register/complete` 和 `login/complete`。
5. 在成功路径中创建或刷新 `wx_session`。
6. 跑测试并提交。

**验证命令：**

- Run: `cd backend && ./mvnw test -Dtest=WebIdentityServiceTest,WebAuthControllerTest`
- Expected: 认证相关测试通过

**提交建议：**

```bash
git add backend/src/main/java/com/wxcheckin/backend/api/controller/WebAuthController.java backend/src/main/java/com/wxcheckin/backend/api/dto backend/src/main/java/com/wxcheckin/backend/application/service/WebIdentityService.java backend/src/main/java/com/wxcheckin/backend/application/service/PasskeyChallengeService.java backend/src/main/java/com/wxcheckin/backend/application/service/SessionService.java backend/src/main/java/com/wxcheckin/backend/application/service/LegacyUserLookupService.java backend/src/test/java/com/wxcheckin/backend/application/service/WebIdentityServiceTest.java backend/src/test/java/com/wxcheckin/backend/api/WebAuthControllerTest.java
git commit -m "feat(backend): add web auth and passkey flows"
```

## 阶段 8：实现活动查询、动态码生成与消费接口

**目标：** 完成 Web 版发码和验码核心业务后端。

**涉及文件：**

- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebActivityController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebAttendanceController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/api/dto/WebCodeConsumeRequest.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/DynamicCodeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/ActivityQueryService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxCheckinEventEntity.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxReplayGuardEntity.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/DynamicCodeServiceTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/CheckinConsumeServiceTest.java`

**执行步骤：**

1. 先为“同 slot 同码 / 不同 activity 不同码 / 过期拒绝 / 重复拒绝”补测试。
2. 实现 `DynamicCodeService`，返回 `code + slot + expires_in_ms + server_time_ms`。
3. 新增 Web 活动列表和详情控制器。
4. 把 `CheckinConsumeService` 改为消费 `activity_id + action_type + code`。
5. 更新事件与 replay guard 的新字段语义。
6. 跑后端测试并提交。

**验证命令：**

- Run: `cd backend && ./mvnw test -Dtest=DynamicCodeServiceTest,CheckinConsumeServiceTest`
- Expected: 动态码与消费测试通过

**提交建议：**

```bash
git add backend/src/main/java/com/wxcheckin/backend/api/controller/WebActivityController.java backend/src/main/java/com/wxcheckin/backend/api/controller/WebAttendanceController.java backend/src/main/java/com/wxcheckin/backend/api/dto/WebCodeConsumeRequest.java backend/src/main/java/com/wxcheckin/backend/application/service/DynamicCodeService.java backend/src/main/java/com/wxcheckin/backend/application/service/ActivityQueryService.java backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxCheckinEventEntity.java backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/entity/WxReplayGuardEntity.java backend/src/test/java/com/wxcheckin/backend/application/service/DynamicCodeServiceTest.java backend/src/test/java/com/wxcheckin/backend/application/service/CheckinConsumeServiceTest.java
git commit -m "feat(backend): add web dynamic code attendance"
```

## 阶段 9：实现管理员一键全部签退与解绑审核后端

**目标：** 补齐管理员高权限能力。

**涉及文件：**

- Create: `backend/src/main/java/com/wxcheckin/backend/api/controller/WebStaffController.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java`
- Create: `backend/src/main/java/com/wxcheckin/backend/application/service/UnbindReviewService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/RecordQueryService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/OutboxRelayService.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/BulkCheckoutServiceTest.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/UnbindReviewServiceTest.java`

**执行步骤：**

1. 先补“一键全部签退只作用于已签到未签退”和“解绑审核通过后失效旧绑定”的失败测试。
2. 实现 `bulk-checkout`。
3. 实现解绑申请、待审列表、批准、拒绝。
4. 接通管理员审计日志。
5. 更新 outbox 回写以兼容批量动作。
6. 跑测试并提交。

**验证命令：**

- Run: `cd backend && ./mvnw test -Dtest=BulkCheckoutServiceTest,UnbindReviewServiceTest`
- Expected: 管理员后端测试通过

**提交建议：**

```bash
git add backend/src/main/java/com/wxcheckin/backend/api/controller/WebStaffController.java backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java backend/src/main/java/com/wxcheckin/backend/application/service/UnbindReviewService.java backend/src/main/java/com/wxcheckin/backend/application/service/RecordQueryService.java backend/src/main/java/com/wxcheckin/backend/application/service/OutboxRelayService.java backend/src/test/java/com/wxcheckin/backend/application/service/BulkCheckoutServiceTest.java backend/src/test/java/com/wxcheckin/backend/application/service/UnbindReviewServiceTest.java
git commit -m "feat(backend): add bulk checkout and unbind review"
```

## 阶段 10：修复并发计数与一致性风险

**目标：** 在共享 6 位码高并发场景下保证活动统计准确。

**涉及文件：**

- Modify: `backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxActivityProjectionRepository.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java`
- Test: `backend/src/test/java/com/wxcheckin/backend/application/service/AttendanceCounterConcurrencyTest.java`

**执行步骤：**

1. 先补并发签到、并发签退计数不丢失的失败测试。
2. 将统计更新改为原子 SQL 或显式锁。
3. 让 `BulkCheckoutService` 复用同一计数路径。
4. 跑并发测试并提交。

**验证命令：**

- Run: `cd backend && ./mvnw test -Dtest=AttendanceCounterConcurrencyTest`
- Expected: 并发测试稳定通过

**提交建议：**

```bash
git add backend/src/main/java/com/wxcheckin/backend/infrastructure/persistence/repository/WxActivityProjectionRepository.java backend/src/main/java/com/wxcheckin/backend/application/service/CheckinConsumeService.java backend/src/main/java/com/wxcheckin/backend/application/service/BulkCheckoutService.java backend/src/test/java/com/wxcheckin/backend/application/service/AttendanceCounterConcurrencyTest.java
git commit -m "fix(backend): make attendance counters atomic"
```

## 阶段 11：建立 Web 联调与移动兼容回归

**目标：** 给新 Web 路线建立可持续回归能力，而不是只靠人工点点看。

**涉及文件：**

- Create: `web/playwright.config.ts`
- Create: `web/tests/auth-flow.spec.ts`
- Create: `web/tests/checkin-flow.spec.ts`
- Create: `web/tests/staff-flow.spec.ts`
- Modify: `docs/WEB_COMPATIBILITY.md`
- Modify: `progress.md`

**执行步骤：**

1. 先列失败场景：
   - 首绑失败
   - 登录失败
   - 过期码失败
   - 批量签退成功
2. 建立 Playwright 手机视口测试。
3. 覆盖普通用户和管理员关键流程。
4. 记录已实测浏览器与问题单。
5. 把结果写回 `docs/WEB_COMPATIBILITY.md` 和 `progress.md`。

**验证命令：**

- Run: `cd web && npx playwright test`
- Expected: 关键 Web 流程通过

**提交建议：**

```bash
git add web/playwright.config.ts web/tests docs/WEB_COMPATIBILITY.md progress.md
git commit -m "test(web): add mobile browser regression suite"
```

## 阶段 12：删除小程序与旧微信/二维码正式链路

**目标：** 完成最终切换，不再保留历史正式路径。

**进入条件：**

- 前端 Web 测试通过
- 后端 Web 接口测试通过
- 真机兼容性矩阵补齐
- 与 `suda_union` 的同步验证通过

**涉及文件：**

- Delete: `frontend/`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/AuthController.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/api/controller/CheckinController.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/AuthService.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/WeChatIdentityResolver.java`
- Modify: `backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java`
- Modify: `docs/REQUIREMENTS.md`
- Modify: `docs/FUNCTIONAL_SPEC.md`
- Modify: `docs/API_SPEC.md`
- Modify: `docs/changes.md`

**执行步骤：**

1. 先逐条核对删旧前检查清单。
2. 删除 `frontend/`。
3. 移除 `wx-login` 与二维码正式接口。
4. 更新正式文档口径，去掉历史“正式链路”表述。
5. 跑完整验证。
6. 提交最终删旧改动。

**验证命令：**

- Run: `cd backend && ./mvnw test`
- Expected: 后端测试通过
- Run: `cd web && npm test -- --run && npm run build`
- Expected: 前端测试与构建通过

**提交建议：**

```bash
git add -A
git commit -m "refactor: remove miniapp and legacy qr flows"
```

## 推荐实施节奏

推荐以 4 个里程碑推进：

1. M1 基础设施：阶段 0-2
2. M2 主链路：阶段 3-8
3. M3 管理员与稳定性：阶段 9-11
4. M4 正式切换：阶段 12

## 完成定义

以下条件同时满足，才算本次改造完成：

- `web/` 成为唯一正式前端。
- `/api/web/**` 成为唯一正式 Web 接口。
- Web 端绑定、登录、活动浏览、签到、签退、管理员展示码、批量签退、解绑审核全部可用。
- 活动统计在共享 6 位码并发场景下不丢失。
- 与 `suda_union` 的最终一致性回写正常。
- 小程序与旧微信/二维码正式链路已删除。
