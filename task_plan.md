# 手机 Web 改造审查与半程推进计划

> **重要变更（2026-03-10）：** 由于部署形态调整为 **HTTP + 内网 IP + 端口号**，本仓库已从“Passkey/WebAuthn”认证方案切换为 **账号密码（默认 123，首次登录强制改密）**，并进一步取消“浏览器唯一绑定 + 解绑审核”的防代签逻辑。下文早期“半程审查/Passkey/绑定/解绑”相关内容仅保留为历史回溯；当前实施请以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 为准。

## 2026-03-10 认证基线变更（HTTP 内网账号密码）

### 目标

- 移除 Passkey/WebAuthn 主链路代码与前端页面。
- 新增账号密码登录：
  - 账号：`student_id`（学号）
  - 默认密码：`123`
  - 首次登录后强制修改密码
- 密码与强制改密状态落库到 `wxcheckin_ext.wx_user_auth_ext`（仅保存 bcrypt hash）。
- 取消浏览器唯一绑定 `X-Browser-Binding-Key` 与解绑审核能力（不再要求与浏览器捆绑）。

### 任务清单（按执行顺序）

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 清理 Passkey/WebAuthn 业务逻辑 | complete | 删除后端 passkey controller/service/DTO/entity/repo；前端移除 `/bind`、`webauthn.ts` 与“不支持 Passkey”提示页 |
| 新增账号密码登录与强制改密 | complete | 新增 `/api/web/auth/login`、`/api/web/auth/change-password`；前端新增 `/change-password` 并在路由/请求层统一拦截 `password_change_required` |
| 数据库迁移与生产 schema 同步 | complete | Flyway 新增 `V9__add_web_password_auth.sql`；同步更新 `backend/scripts/bootstrap-prod-schema.sql` 与运维配置模板 |
| 文档全量同步 | complete | 更新正式基线与历史计划备注，确保不再把 Passkey 作为当前口径 |

## 目标

- 完整复核 `wxapp-checkin` 当前文档基线、历史代码与 `web/` 首批改造成果。
- 对已完成的前四分之一代码做真正的代码审查，而不是只复用上一轮“测试通过”的结论。
- 若发现 bug，则先按 TDD 修复；若首批实现可接受，则继续推进到“总改造进度二分之一”。
- 将审查发现、修复动作、后续实施与验证结果持续沉淀到仓库文档，便于回溯。

## 当前阶段

- 状态：complete
- 阶段 1：复核文档基线、现有计划与首批 Web 代码
- 阶段 2：按 TDD 修复首批代码审查发现的问题
- 阶段 3：推进到半程目标（默认按 `M2.2` 普通用户活动与输入码页执行）
- 阶段 4：运行验证并同步 `progress.md` / `findings.md` / `docs/plans/2026-03-09-web-todo-list.md`

## 任务拆分

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 复核正式基线文档 | complete | 已重读 `REQUIREMENTS` / `FUNCTIONAL_SPEC` / `API_SPEC` / `WEB_DETAIL_DESIGN` / 实施计划 |
| 复核现有首批实现边界 | complete | 已确认首批范围为 `web/` 骨架 + shared 基础层 + `/login` `/bind` |
| 审查首批 Web 代码 | complete | 已发现路由保护、根路由、能力探测、HTTP 归一化、存储降级等问题 |
| 修复首批代码问题 | complete | 已按 TDD 修复路由保护、根路由、能力探测、HTTP 归一化、存储降级与登录跳绑定 |
| 推进半程目标 | complete | 已完成 `M2.2`：活动列表 / 活动详情 / 签到页 / 签退页 |
| 全量验证与清单回写 | complete | 已重新跑 `npm test -- --run`、`npm run build` 并同步 `docs/plans/2026-03-09-web-todo-list.md` |

## 已知约束

- 只允许修改 `wxapp-checkin/`。
- `suda_union/` 与 `suda-gs-ams/` 仅可读取和联调参考。
- 新 Web 功能必须以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 为正式基线。
- 最终目标是删除小程序正式链路，但本轮只推进到“半程”，不提前删旧。

## 范围决策

- “前四分之一”沿用现有计划定义：`M1 + M2.1`，即：
  - 建立 `web/` 工程骨架
  - 建立 Web 公共基础层
  - 实现实名绑定与 Passkey 登录前端
- “推进到二分之一”默认解释为完成下一个独立批次 `M2.2`：
  - 活动列表页
  - 活动详情页
  - 签到 6 位码输入页
  - 签退 6 位码输入页
- M0 决策锁口仍不作为本轮编码完成条件，但相关风险需要持续记录。

## 当前审查问题清单

- 已修：`web/src/app/router.tsx` 补根路由 `/ -> /login|/activities` 与受保护路由。
- 已修：`web/src/shared/device/browser-capability.ts` 收紧 Passkey 基线判断。
- 已修：`web/src/shared/http/client.ts` 补非 JSON / 非 2xx 响应归一化。
- 已修：`web/src/shared/session/session-store.ts` 补 `localStorage` 不可用时降级。
- 已修：`web/src/pages/bind/BindPage.tsx` 与 `web/src/pages/login/LoginPage.tsx` 补不支持浏览器与“未注册 Passkey 跳绑定”处理。

## 错误记录

- 修复阶段的失败测试已全部转绿：
  - `src/app/App.test.tsx`
  - `src/shared/device/browser-capability.test.ts`
  - `src/shared/session/session-store.test.ts`
  - `src/shared/http/client.test.ts`
  - `src/pages/login/LoginPage.test.tsx`
  - `src/pages/bind/BindPage.test.tsx`
- 新鲜验证结果：
  - 首批修复后：`cd web && npm test -- --run` => 7 个测试文件、23 个测试通过
  - 半程实现后：`cd web && npm test -- --run` => 10 个测试文件、28 个测试通过
  - 半程实现后：`cd web && npm run build` => 构建通过

## 2026-03-09 第二阶段任务

### 目标

- 对已完成的首批 Web 改造做代码审查，并修复明确的功能性 bug。
- 若首批质量达标，则继续推进到“整体改造进度二分之一”的下一批前端能力。
- 将审查结论、根因、测试补充和实现过程持续沉淀到仓库内文档。

### 当前阶段

- 状态：in_progress
- 阶段 1：复核文档基线与首批实现一致性
- 阶段 2：完成首批 Web 代码审查并定位根因
- 阶段 3：按 TDD 修复确认的问题
- 阶段 4：补充“从四分之一到二分之一”的设计与实施记录
- 阶段 5：继续推进下一批前端页面并完成验证

### 本轮重点检查项

- 路由是否落实：
  - 未登录跳 `/login`
  - 未绑定跳 `/bind`
  - 管理员与普通用户页面边界
- 绑定页与登录页是否正确处理浏览器 Passkey 能力差异。
- `shared/http/client.ts` 是否对后端异常、非 JSON 响应、会话失效和 API 契约偏差有足够韧性。
- 当前测试是否覆盖关键边界，而不是只覆盖 happy path。

## 2026-03-09 半程复审整改

### 目标

- 对已完成的手机 Web 半程代码做第二轮工程审查，重点处理：
  - GET 重复请求与乱序回写
  - 活动状态 fallback 误判
  - 特殊字符活动 ID 的路由编码
  - 按钮 / 标签 / 错误提示仍停留在手写样式的问题
- 将本轮修复与验证结果同步回文档和根规范。

### 结果

- 状态：complete
- 已完成：
  - 为 `requestJson` 增加 GET in-flight 去重
  - 为活动详情页、签到/签退页、活动列表页增加“只认最后一次请求”的状态保护
  - 修正 `progress_status` 缺失时默认误判为 `completed` 的逻辑
  - 新增活动路由构造辅助函数，统一 UI 路由与 API path 编码
  - 引入 `tdesign-mobile-react`，落按钮、Tag、NoticeBar 组件库收口
- 新增 `ActivityMetaPanel`、`AppButton`、`InlineNotice`、`StatusTag`
- 更新根 `AGENTS.md`，写入注释密度规则

## 2026-03-09 三分之三推进

### 目标

- 在“前端四分之一 + 必要后端支撑”的范围内，把手机 Web 从半程推进到三分之三。
- 以前端 `T-058 ~ T-070` 为主线，同时补齐当前 Web 前端已依赖但后端尚未落地的最小 `/api/web/**`。
- 若发现前半程前后端存在断链、角色态缺失或接口未实现，优先补全，不把问题带到下一阶段。

### 当前阶段

- 状态：complete
- 阶段 1：补设计文档与实施计划，锁定范围
- 阶段 2：按 TDD 补前端角色态、路由守卫和管理员入口
- 阶段 3：按 TDD 补 staff / review 页面
- 阶段 4：按 TDD 补 `/api/web/**` 活动、动态码、批量签退与解绑审核最小后端
- 阶段 5：全量验证并回写 `todo_list` / `changes.md` / 进度文件

### 范围决策

- 采用“前端四分之一 + 必要后端支撑”方案，而不是：
  - 只做前端壳层
  - 直接推进到 `T-128`
- 当前明确纳入本轮：
  - `T-058 ~ T-070`
  - 为支撑这些页面和已完工普通用户页所必需的 Web 后端接口
- 当前明确不纳入本轮：
  - 完整 Passkey 数据模型与浏览器绑定表
  - Playwright / 真机兼容验证
  - 删旧切流

### 结果

- 已完成：
  - 前端 `T-058 ~ T-070`
  - 为支撑管理员页和已完工普通用户页所必需的最小 `/api/web/**`
  - backend 测试基线修复（Mockito subclass mock maker）
  - 活动统计原子计数路径
- 仍保留到后续阶段：
  - 完整 WebAuthn / 浏览器绑定表
  - 浏览器绑定失效与解绑审核的完整闭环
  - Playwright / 真机兼容回归

## 2026-03-10 Web Only 收尾

### 目标

- 按用户确认的验收口径，把项目收口为“本地可运行的 Web-only 完整项目”。
- 完成后端 Web 身份 / 浏览器绑定 / Passkey 最小闭环。
- 删除小程序前端与旧微信 / 二维码正式链路。
- 跑完前后端验证并提交 Git。

### 当前阶段

- 状态：complete
- 阶段 1：补设计文档与实施计划，锁定 Web-only 收尾边界
- 阶段 2：按 TDD 补后端 Web 身份与绑定主链路
- 阶段 3：按 TDD 补解绑失效、审计与并发稳定性
- 阶段 4：补前端认证联调和用户解绑申请入口
- 阶段 5：删除小程序与旧正式链路，更新文档
- 阶段 6：全量验证并提交 Git

### 范围决策

- 采用“本地可运行切流方案”，不以真机 Passkey 实测作为本轮阻塞条件。
- 本轮必须完成：
  - `web/` 作为唯一正式前端
  - `/api/web/**` 作为唯一正式接口入口
  - 删除 `frontend/` 与旧微信 / 二维码正式链路
  - 前后端自动化验证
- 本轮不阻塞：
  - 生产级完整 WebAuthn 验签
  - Playwright 浏览器矩阵
  - 真机兼容性补录

### 结果

- 已完成：
  - Web-only 后端认证闭环
  - 普通用户解绑申请入口
  - 解绑审批后的旧绑定 / 旧凭据 / 旧会话失效
  - 删除 `frontend/` 与根级小程序配置
  - 删除旧微信登录 / 注册 / 兼容控制器与相关 service / DTO
  - README、后端部署文档、正式需求 / 功能 / API 文档更新
- 已完成验证：
  - `cd backend && ./mvnw test` => 27 个测试通过
  - `cd web && npm test -- --run` => 15 个测试文件、48 个测试通过
  - `cd web && npm run build` => 构建通过

## 2026-03-10 Web 改造完成度复核与 URL 冲突审查

### 目标

- 重新审查 `wxapp-checkin` 当前 Web-only 收口是否真实完成，而不是只复述现有文档结论。
- 复核 `wxapp-checkin` 与 `suda-gs-ams` / `suda_union` 的 URL、网关前缀与部署边界是否冲突。
- 若发现前后端真实 bug 或未完成项，直接修复并补验证。
- 同步更新 README、接口文档、变更记录与规划文件。

### 当前阶段

- 状态：complete
- 阶段 1：复核前后端真实代码、测试和文档基线
- 阶段 2：审查跨项目 URL / 路由 / 代理冲突
- 阶段 3：按 TDD 修复配置断链与部署边界问题
- 阶段 4：回写正式文档与仓库内进度文件

### 审查结论

- Web-only 改造主链路已完成：
  - `backend/` 当前只暴露 `/api/web/**`
  - `web/` 已覆盖登录、绑定、活动、动态码、staff、解绑申请与解绑审核
  - 历史 `frontend/` 与旧正式 controller 已删除
- 自动化验证真实通过：
  - `cd backend && ./mvnw test`
  - `cd web && npm test -- --run`
  - `cd web && npm run build`
- 但审查发现仍有一个“测试之外的真实断链”：
  - `web` 所有请求默认走同源 `/api/web`
  - 之前 `vite.config.ts` 没有 dev proxy，也没有可配置 API/base path
  - 导致 README 所写的“本地分别启动前后端”在真实开发环境下会直接 404
- URL 冲突判断：
  - 与 `suda_union` controller 命名本身不直接冲突
  - 与 `suda-gs-ams` 在“同域同网关”部署时存在根路径与通用 `/api/*` 代理冲突风险

### 已完成修复

- `web/` 新增运行时路径配置：
  - `VITE_APP_BASE_PATH`
  - `VITE_API_BASE_PATH`
  - `VITE_API_PROXY_TARGET`
- `BrowserRouter`、HTTP base、Vite `base/proxy` 已统一接入这套配置。
- 默认本地联调改为对齐 `backend/scripts/start-test-env.sh` 的 `9989` 端口。
- 文档已补充：
  - 独立部署与共域部署的推荐路径
  - `/api/web/**` 与通用 `/api/**` 的网关优先级说明
  - `web/.env.example` 使用方式

## 2026-03-10 联调前全面复核与补洞

### 目标

- 在三端联调与真机测试前，重新对 `wxapp-checkin` 的 Web-only 代码和文档做一次工程化复核。
- 不只看“测试是不是绿”，还要补齐：
  - staff 动态码页的并发安全和倒计时体验
  - Web 业务接口对浏览器绑定键的真实校验
  - `support_checkin`、`binding_revoked`、解绑时间字段等契约漂移
  - 本地联调和阅读入口中最容易误导人的文档缺口

### 当前阶段

- 状态：complete
- 阶段 1：重新审查代码、文档与自动化基线
- 阶段 2：按 TDD 修复前端并发 / 倒计时 / 审核入口问题
- 阶段 3：按 TDD 修复后端浏览器绑定校验与契约漂移
- 阶段 4：回写联调文档和测试环境模板
- 阶段 5：重新跑前后端验证

### 结果

- 已完成：
  - `review_admin` 路由与活动列表入口收口
  - staff 动态码页请求乱序保护
  - staff 动态码页视觉倒计时与到期自动刷新
  - staff 页 wake lock 尝试与降级提示
  - `/api/web/**` 业务态浏览器绑定键校验
  - `support_checkin` 在发码 / 验码链路生效
  - 解绑审批后返回 `binding_revoked`
  - 解绑申请时间字段改为毫秒时间戳
  - 本地测试环境模板与联调文档收口
  - 动态码正式口径统一为 10 秒窗口，并同步回写需求 / 设计 / 审查记录
- 当前仍保留到后续阶段：
  - Playwright / 真机兼容矩阵补录

## 2026-03-10 Web 改造审查（补记）

- 状态：complete
- 结论摘要：代码主链路已基本收口，但仍存在解绑自助死角、活动动作可执行性契约不一致、文档口径残留 Passkey 历史内容、以及三项目全链路缺少可复核验收记录等问题。
