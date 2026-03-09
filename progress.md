# 执行进度日志

## 2026-03-09

### 本轮新增进度

- 已重新读取：
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`
  - `docs/plans/2026-03-09-web-detailed-coding-plan.md`
  - `docs/plans/2026-03-09-web-todo-list.md`
- 已重新读取首批 Web 相关代码：
  - `web/src/app/**`
  - `web/src/shared/**`
  - `web/src/features/auth/**`
  - `web/src/pages/login/**`
  - `web/src/pages/bind/**`
- 已重新对照正式文档：
  - `docs/REQUIREMENTS.md`
  - `docs/FUNCTIONAL_SPEC.md`
  - `docs/API_SPEC.md`
  - `docs/WEB_DETAIL_DESIGN.md`
- 已复跑验证：
  - `cd web && npm test -- --run` => 6 个测试文件、13 个测试通过
  - `cd web && npm run build` => 构建通过
- 已确认当前问题属于“测试漏测的产品级 bug”，不是上一轮实现未运行成功：
  - 根路由 `/` 错误落 404
  - `/activities` 未做登录态保护
  - Passkey 能力检测存在假阳性
  - HTTP 错误归一化不稳
  - 会话存储缺少降级处理
- 已进入“先补失败测试，再修复首批问题”的 TDD 阶段。
- 已完成首批修复对应的 TDD：
  - `src/app/App.test.tsx` 新增根路由与未登录访问保护断言
  - `src/shared/device/browser-capability.test.ts` 新增“仅基础 WebAuthn 不算 Passkey”断言
  - `src/shared/session/session-store.test.ts` 新增 `localStorage` 不可用降级断言
  - `src/shared/http/client.test.ts` 新增非 2xx / 非 JSON / `session_expired` 断言
  - `src/pages/login/LoginPage.test.tsx` 已覆盖 `passkey_not_registered -> /bind`
  - `src/pages/bind/BindPage.test.tsx` 已覆盖不支持 Passkey 时显示不支持页
- 已完成首批修复对应实现：
  - `web/src/app/router.tsx`
  - `web/src/shared/device/browser-capability.ts`
  - `web/src/shared/session/session-store.ts`
  - `web/src/shared/http/client.ts`
  - `web/src/pages/login/LoginPage.tsx`
  - `web/src/pages/bind/BindPage.tsx`
- 已完成新鲜验证：
  - `cd web && npm test -- --run` => 7 个测试文件、23 个测试全部通过
  - `cd web && npm run build` => 构建通过
- 已转入 `M2.2` 读取与设计对照阶段，准备实现：
  - 活动列表页
  - 活动详情页
  - 签到 6 位码输入页
  - 签退 6 位码输入页
- 已完成 `M2.2` TDD：
  - 新增 `src/pages/activities/ActivitiesPage.test.tsx`
  - 新增 `src/pages/activity-detail/ActivityDetailPage.test.tsx`
  - 新增 `src/pages/checkin/CheckinPage.test.tsx`
  - 更新 `src/app/App.test.tsx` 以适配真实活动页路由
- 已完成 `M2.2` 代码实现：
  - `src/features/activities/api.ts`
  - `src/features/activities/view-model.ts`
  - `src/features/activities/components/ActivityCard.tsx`
  - `src/features/attendance/components/CodeInput.tsx`
  - `src/pages/activities/ActivitiesPage.tsx`
  - `src/pages/activity-detail/ActivityDetailPage.tsx`
  - `src/pages/checkin/CheckinPage.tsx`
  - `src/pages/checkout/CheckoutPage.tsx`
  - `src/app/router.tsx`
  - `src/app/styles/base.css`
- 已完成半程验证：
  - `cd web && npm test -- --run src/pages/activities/ActivitiesPage.test.tsx src/pages/activity-detail/ActivityDetailPage.test.tsx src/pages/checkin/CheckinPage.test.tsx src/app/App.test.tsx` => 4 个测试文件、11 个测试通过
  - `cd web && npm test -- --run` => 10 个测试文件、28 个测试通过
  - `cd web && npm run build` => 构建通过
- 已同步 `docs/plans/2026-03-09-web-todo-list.md`，将 `T-044` 到 `T-057` 标记完成。
- 已完成半程源码注释增强：
  - 范围：`web/src` 非测试源码
  - 重点：路由、页面状态流、WebAuthn、活动 view-model、shared 基础层、CSS 分层
  - 注释语言：中文
  - 注释密度：约 `575 / 2290 = 25.1%`
- 已完成注释增强后的新鲜验证：
  - `cd web && npm test -- --run` => 10 个测试文件、28 个测试全部通过
  - `cd web && npm run build` => 构建通过

### 进行中

- 已读取实施计划、详细编码计划和 `todo_list`。
- 已读取正式基线文档：
  - `docs/REQUIREMENTS.md`
  - `docs/FUNCTIONAL_SPEC.md`
  - `docs/API_SPEC.md`
- 已读取补充文档：
  - `docs/WEB_DESIGN.md`
  - `docs/WEB_DETAIL_DESIGN.md`
  - `docs/WEB_COMPATIBILITY.md`
  - `docs/WEB_MIGRATION_REVIEW.md`
  - `docs/changes.md`
- 已开始梳理当前 `frontend/` 与 `backend/` 目录结构。
- 已启动并行子代理汇总文档、前端、后端现状。
- 已确认前端可迁移的核心是请求层韧性、会话存储抽象、活动视图模型和输入校验逻辑。
- 已确认后端可复用的核心是会话、活动投影、状态机、审计与 outbox 主干；微信登录和二维码链路需要替换。
- 已明确本批编码范围为：
  - `web/` 工程骨架
  - `web/src/shared/**` 基础层
  - `/login`、`/bind` 与 Passkey 前端主链路
- 已明确 M0 决策锁口暂不作为本批编码完成条件，只保留配置入口与阻塞记录。
- 已通过子代理补充确认：
  - 小程序登录主链路集中在 `frontend/utils/auth.js`
  - 小程序活动领域逻辑可迁移，小程序宿主 API 与二维码链路不可直接复用
  - 后端当前可直接复用会话、统一错误响应、角色权限与活动查询主干
- 已执行 `cd web && npm install`，Web 工具链依赖安装完成。
- 已执行 `cd web && npm test -- --run`，当前基线失败：
  - `src/app/App.test.tsx`
  - 原因是 `router.tsx` 仍为纯文本占位，尚未实现测试要求的基础页面壳层

### 已完成

- 已按 TDD 补齐 `web/` 首批实现：
  - `src/app/router.tsx` 从文本占位升级为真实页面壳层
  - `src/shared/**` 已补会话存储、浏览器能力探测、页面生命周期、HTTP 客户端、统一错误对象、共享移动端容器
  - `src/features/auth/**` 已补绑定/登录 API 封装、WebAuthn 包装、绑定表单与 Passkey 登录面板
  - `src/pages/login/LoginPage.tsx` 与 `src/pages/bind/BindPage.tsx` 已接入会话写入和成功跳转
- 已补测试：
  - `src/app/App.test.tsx`
  - `src/shared/session/session-store.test.ts`
  - `src/shared/device/browser-capability.test.ts`
  - `src/shared/device/page-lifecycle.test.ts`
  - `src/pages/login/LoginPage.test.tsx`
  - `src/pages/bind/BindPage.test.tsx`
- 已完成验证：
  - `cd web && npm test -- --run` => 6 个测试文件、13 个测试全部通过
  - `cd web && npm run build` => `tsc --noEmit` 与 Vite 构建通过
- 已开始同步 `docs/plans/2026-03-09-web-todo-list.md`，将首批完成项标记为已完成。

### 下一步

- 下一批建议转入 `M2.2`：
  - 活动列表页
  - 活动详情页
  - 签到 / 签退 6 位码输入页
- 在进入后端 WebAuthn 真链路前，仍需继续跟进 M0 的域名、Origin、TTL 与解绑失效口径锁定。

### 第二阶段：首批代码审查

- 已复读当前规划与代码状态：
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`
  - `docs/plans/2026-03-09-web-detailed-coding-plan.md`
  - `docs/plans/2026-03-09-web-todo-list.md`
- 已读取首批 Web 代码：
  - `web/src/app/**`
  - `web/src/features/auth/**`
  - `web/src/pages/login/**`
  - `web/src/pages/bind/**`
  - `web/src/shared/**`
- 已对照正式文档基线：
  - `docs/REQUIREMENTS.md`
  - `docs/FUNCTIONAL_SPEC.md`
  - `docs/API_SPEC.md`
  - `docs/WEB_DESIGN.md`
  - `docs/WEB_DETAIL_DESIGN.md`
  - `docs/WEB_COMPATIBILITY.md`
- 已执行验证：
  - `cd web && npm test -- --run` => 6 个测试文件、13 个测试全部通过
  - `cd web && npm run build` => 构建通过
- 已识别需要进入根因修复阶段的问题：
  - 路由守卫缺失
  - 绑定页缺少浏览器能力拦截
  - HTTP 客户端对异常响应不够稳健
