# 发现记录

## 2026-03-10

### 认证基线变更补记（HTTP 内网账号密码）

- 需求变更：部署形态确定为 **HTTP + 内网 IP + 端口号**，因此 Passkey/WebAuthn 方案在主流浏览器下不可用（安全上下文限制），必须移除主链路依赖。
- 当前认证结论：
  - 登录账号口径统一为 `student_id`（学号）。
  - 默认密码固定为 `123`，仅保存 bcrypt hash（不存明文）。
  - 首次登录强制改密：`must_change_password=true` 时，除改密接口外统一返回 `password_change_required`。
  - 密码与强制改密字段落在 `wxcheckin_ext.wx_user_auth_ext`。
  - 已取消浏览器唯一绑定与解绑审核；Web 端仅依赖 `session_token`，同一账号允许多端同时登录（多个会话并存）。
- 说明：本文件中 2026-03-09 的 “/bind / Passkey / WebAuthn” 相关结论仅保留为历史回溯，当前请以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 与 `docs/plans/2026-03-10-http-password-auth-*.md` 为准。

## 2026-03-09

### 本轮复核结论

- 已复核 `task_plan.md`、`progress.md`、`docs/plans/2026-03-09-web-only-migration-implementation-plan.md`、`docs/plans/2026-03-09-web-detailed-coding-plan.md` 与 `docs/plans/2026-03-09-web-todo-list.md`，确认“前四分之一”对应 `M1 + M2.1`。
- 已重新执行 `cd web && npm test -- --run` 与 `cd web && npm run build`，现有 13 个测试和构建全部通过，但这只证明工具链没坏，不能证明首批产品行为正确。
- 文档已明确要求：
  - 访问系统先落 `/login`
  - 未登录跳 `/login`
  - 未绑定跳 `/bind`
  - `/activities` 只对已登录用户开放
  - 浏览器能力检测要提前识别“不支持 Passkey”的环境

### 首批 Web 审查新增问题

- `web/src/app/router.tsx` 目前没有根路由 `/`，用户直接打开站点首页会进入“页面不存在”，与 `FUNCTIONAL_SPEC` 中“访问系统先进入 `/login`”冲突。
- `web/src/app/router.tsx` 目前没有登录态路由保护，未登录用户也能直接打开 `/activities` 占位页，与 `WEB_DETAIL_DESIGN` 中“未登录跳 `/login`”冲突。
- `web/src/shared/device/browser-capability.ts` 把 `PublicKeyCredential + navigator.credentials` 的存在直接当作 “hasPasskeySupport”，会对只具备基础 WebAuthn 能力但不满足 Passkey 基线的环境产生假阳性。
- `web/src/shared/http/client.ts` 目前无条件 `response.json()`，且不检查 `response.ok`；若网关返回空响应、HTML 错页或非 JSON，前端会抛原生解析异常而不是统一错误。
- `web/src/shared/session/session-store.ts` 默认假设 `localStorage` 永远可访问，未覆盖隐私模式或 WebView 禁用存储时的降级路径。

### 首批 Web 审查修复结果

- `web/src/app/router.tsx` 已补：
  - `/` 自动落到 `/login` 或 `/activities`
  - `/activities` 必须有本地会话才可进入
  - 已有会话访问 `/login`、`/bind` 时回到 `/activities`
- `web/src/shared/device/browser-capability.ts` 已改为要求存在 `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable`，避免把“仅基础 WebAuthn”误判成 Passkey 可用。
- `web/src/shared/http/client.ts` 已补：
  - 非 2xx JSON 响应统一抛 `ApiError`
  - 非 2xx 非 JSON 响应统一抛 `ApiError`
  - 2xx 非 JSON 响应统一抛 `NetworkError`
  - `session_expired` 仍优先清会话并抛 `SessionExpiredError`
- `web/src/shared/session/session-store.ts` 已对 `localStorage` getter、`getItem`、`setItem`、`removeItem` 做降级保护。
- `web/src/pages/bind/BindPage.tsx` 已补浏览器能力兜底，不支持 Passkey 时直接展示 `UnsupportedBrowser`。
- `web/src/pages/login/LoginPage.tsx` 已补 `passkey_not_registered -> /bind` 跳转，符合“当前浏览器尚未绑定时进入实名绑定”的产品路径。

### 半程（M2.2）实现决策

- 采用 `docs/plans/2026-03-09-web-detailed-coding-plan.md` 中的 `M2.2` 作为“从四分之一推进到二分之一”的默认边界：
  - 活动列表页
  - 活动详情页
  - 签到页
  - 签退页
- 活动列表仍保留服务端过滤为主，但前端额外用 `my_registered / my_checked_in / my_checked_out` 做一次可见性收口，避免后端新旧口径并存时把普通用户不该看到的活动直接渲染出来。

## 2026-03-11

### 三项目联调全覆盖报告（重点：数据同步）暴露问题

已阅读 `docs/TEST_REPORT_2026-03-11_INTEGRATION.md`，自动化测试全绿，但联调链路暴露出以下确定性问题与整改项：

- P1（确定复现）：`LegacySyncService.syncLegacyActivities()` 的统计口径与投影状态机不一致。
  - 现状：legacy pull 的 SQL 把 `checkin_count` 统计为 `check_in=1` 的总人数（包含已签退），会周期性覆盖投影表的“已签到未签退”口径，出现 `checkin_count < checkout_count` 等不可能状态。
  - 修复方向：对齐口径为：
    - `checkin_count = SUM(check_in=1 AND check_out=0)`
    - `checkout_count = SUM(check_in=1 AND check_out=1)`
- P2（体验）：普通用户首次登录改密后，活动列表依赖 pull 同步补齐 `wx_user_activity_status`，存在“列表空白等待”空窗期。
  - 修复方向（推荐）：当普通用户首次访问活动列表且本地无 status 时，触发一次“按 legacy_user_id 的即时同步”（只同步该用户相关状态，必要时补齐其关联活动投影）。
- P2（可靠性）：outbox 事件被标记为 `failed/skipped` 后默认不重试，存在最终一致性风险。
  - 修复方向：引入可重试机制（`retry_count` + 指数退避或延后 `available_at`），失败/依赖未齐场景回到 `pending`，达到上限后再标记终态 `failed`。
- P3（脚本误报）：`local_dev/scripts/start_3_projects_integration.sh` 内置登录校验使用 `admin/123`，与当前 seed 账号不一致，导致一键启动误报警告。
  - 修复方向：把校验账号参数化，并默认使用 seed 中 staff 账号。
- P3（测试噪声）：`ProdProfileSafetyConfigTest` 在 H2 空库上触发 QR 清理任务，出现 `wx_qr_issue_log` 表不存在相关日志。
  - 修复方向：该测试显式关闭 `app.qr.cleanup-enabled`（或全局关闭 scheduling），提升测试信噪比。
- 活动详情页在后端尚未稳定输出 `can_checkin / can_checkout` 时，前端用 `support_* + my_* + progress_status` 做兜底推导，降低前后端并行迭代期的页面不可用风险。
- 签到/签退输入页采用同一套 `AttendanceActionPage` 逻辑收口，避免两套页面后续在错误码映射、会话失效和前后台切换刷新上漂移。
- 6 位码输入当前采用单输入框 + 数字约束，而不是 6 个独立输入格：
  - 满足 `inputmode="numeric"`、`pattern="[0-9]*"`、`enterkeyhint="done"` 的正式契约；
  - 先优先保证可用性、测试覆盖和移动端单手输入效率；
  - 后续若需更强视觉表现，可在不改业务逻辑的前提下替换为多格 UI。

### 半程（M2.2）实现结果

- `web/src/features/activities/api.ts` 已落：
  - `getActivities`
  - `getActivityDetail`
  - `consumeActivityCode`
- `web/src/features/activities/view-model.ts` 已沉淀：
  - 活动时间解析
  - 进度归一化
  - 我的状态归一化
  - 列表分组
  - 详情页动作兜底判断
- `web/src/pages/activities/ActivitiesPage.tsx` 已支持：
  - 拉取活动列表
  - “正在进行 / 已完成”分组展示
  - 普通用户可见性收口
  - 会话失效跳回 `/login`
- `web/src/pages/activity-detail/ActivityDetailPage.tsx` 已支持：
  - 展示标题、时间、地点、说明、当前状态、我的状态、统计
  - 根据状态给出“去签到 / 去签退”入口
- `web/src/pages/checkin/CheckinPage.tsx` / `web/src/pages/checkout/CheckoutPage.tsx` 已支持：
  - 读取详情
  - 6 位数字码输入
  - 调用 `/code-consume`
  - 成功结果页
  - `invalid_code` / `expired` / `duplicate` 文案映射
  - 前后台切换后重拉详情

### 半程代码注释增强结果

- 已在 `web/src` 的非测试源码范围内补充大量中文注释，覆盖：
  - 路由保护与页面入口分流
  - 认证 / 绑定 / Passkey 序列化链路
  - 活动列表与详情的 view-model 归一化逻辑
  - 签到 / 签退动作页的数据流、结果态与错误码翻译
  - HTTP / session / browser capability 等 shared 基础层
  - 全局 CSS 的分层职责与维护建议
- 本轮注释增强的目标不是解释语法，而是解释：
  - 为什么这样设计
  - 这段状态流转服务哪条业务链路
  - 后续维护时哪些地方不能轻易拆散或复制
- 以 `web/src` 非测试源码统计：
  - 总行数约 `2290`
  - 注释行数约 `575`
  - 注释占比约 `25.1%`
- 注释口径统一使用中文，符合仓库文档与维护说明要求。

### 文档基线

- `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 是唯一正式基线。
- `docs/WEB_DESIGN.md`、`docs/WEB_DETAIL_DESIGN.md`、`docs/WEB_COMPATIBILITY.md`、`docs/WEB_MIGRATION_REVIEW.md` 和 `docs/plans/2026-03-09-web-only-migration-implementation-plan.md` 是补充设计与实施文档。
- `docs/plans/2026-03-09-web-todo-list.md` 是本次实施完成后必须同步的执行清单。

### 首批范围候选

- 实施计划前 3 个任务分别是：
  - 建立 `web/` 工程骨架
  - 建立 Web 公共基础层
  - 实现实名绑定与 Passkey 登录前端
- 这三块合起来恰好覆盖 `todo_list` 的 M1 以及 M2.1，是“前四分之一”最自然的一批，因为它们形成完整的 Web 入口主链路。

### 风险与阻塞

- 文档明确指出仍需锁定 Passkey `RP ID`、允许 `Origin`、本地域名、Web 会话 TTL、解绑后旧会话失效策略、绑定唯一性口径、动态码限流维度与阈值。
- 若这些口径未最终确定，首批前端可先以接口契约和能力检测为主，后端真实 WebAuthn 落地应避免提前写死正式值。

### 现有代码现状

- `frontend/` 仍是微信小程序实现，不能直接平移为 Web。
- `backend/` 已有活动、会话、签到状态机、审计和 outbox 同步主干，具备复用价值。

### 小程序前端可复用 / 不可复用边界

- 最值得迁移到 `web/` 的是：
  - `frontend/utils/request-core.js` 的会话失效识别、GET 重试、并发去重思路。
  - `frontend/utils/storage.js` 的统一会话与角色状态抽象。
  - `frontend/pages/index/index.js` 里的活动时间解析、普通用户可见性筛选、活动分组排序。
  - `frontend/utils/validators.js` 的输入归一化和错误文案策略。
- 明显不能复用的是：
  - `wx.login`、`wx.request`、`wx.scanCode`、`wx.navigateTo`、`wx.*StorageSync` 等宿主 API。
  - 二维码 payload、扫码提交、二维码宽限期等旧产品口径。
  - 小程序页面和 `app.json` 导航结构。

### 后端可复用 / 需替换边界

- 可直接复用主干：
  - `SessionService`、`WxSessionEntity`、`WxSessionRepository`
  - `SessionTokenExtractor`
  - `ActivityQueryService`
  - `WxActivityProjectionEntity`、`WxUserActivityStatusEntity`
  - `LegacyUserLookupService`
  - `OutboxRelayService`、`WxSyncOutboxEntity`
  - `WxReplayGuardEntity`
- 需要整体替换或重构：
  - 微信登录与 `WeChatIdentityResolver`
  - 二维码签发与扫码消费接口
  - `QrSessionService`、`CheckinConsumeService` 中基于 `qr_payload` 的逻辑
  - 历史兼容接口 `/api/checkin/**`、`/api/staff/activity-action` 等

### 对首批任务的判断

- 结合实施计划与现状代码，最自然的“前四分之一”是：
  - `web/` 工程骨架
  - shared 公共基础层
  - 认证与绑定前端主链路
- 理由：
  - 这三块合起来能形成一个完整、可跑通、可测试的 `web/` 新入口。
  - 先落前端壳层和共享基础层，能在不破坏旧小程序正式链路的前提下尽快建立新主干。
  - 二维码消费和后端 WebAuthn 真落地耦合更深，放在第二批以后更稳。

### 当前代码与文档进一步对齐结果

- `frontend/utils/auth.js` 证明当前登录强依赖 `wx.login` 和 `/api/auth/wx-login`，因此新 Web 登录必须新建 `features/auth/api.ts` 与 `features/auth/webauthn.ts`，不能复用旧登录入口。
- `frontend/utils/request-core.js` 现有的会话过期识别、GET 去重、幂等重试值得迁移到 `web/src/shared/http/client.ts`。
- `frontend/pages/scan-action/scan-action.js` 与 `frontend/pages/staff-qr/staff-qr.js` 说明旧产品主链路是“扫码消费 + 二维码展示”，新 Web 首批无需复用其 UI，但其“结果态映射、服务端时间偏移、前后台刷新意识”值得保留。
- `backend/src/main/java/com/wxcheckin/backend/application/service/SessionService.java` 和 `ActivityQueryService.java` 已能支撑 Web 首批前端的会话抽象与活动读取心智模型。
- `backend/src/main/resources/application.yml` 现有 `app.session.ttl-seconds` 默认值为 `7200`，这可以作为文档中的默认开发 TTL 参考，但本批不据此把生产会话口径写死。
- `docs/WEB_DETAIL_DESIGN.md` 已明确开放项的默认建议：
  - Passkey 域配置先采用同域部署口径
  - 浏览器绑定以服务端持久化绑定为主，指纹只作辅助
  - 会话采用短 TTL，不自动静默续期
  - 动态码风控以 `binding_id + activity_id` 为主
  - 前后端部署优先同域

### 子代理补充确认

- 小程序前端真实登录入口不在 `pages/login/login.js`，而是在 `frontend/utils/auth.js` 里统一通过 `auth.ensureSession()` 触发 `wx.login -> /api/auth/wx-login`。
- 小程序活动链路的核心可迁移资产主要集中在：
  - `frontend/utils/request-core.js` 的请求韧性逻辑
  - `frontend/pages/index/index.js` 的活动状态归一化、可见性过滤和分组
  - `frontend/utils/validators.js` 的输入校验
- 小程序二维码链路与微信宿主深度绑定，不应迁入首批 Web：
  - `wx.scanCode`
  - 小程序码 `scene`
  - `scanResult.path`
  - 二维码 payload / slot / grace window 语义
- 后端首批 Web 最可复用的是：
  - `SessionService`
  - `SessionTokenExtractor`
  - `ApiExceptionHandler` / `BusinessException`
  - `ActivityQueryService`
  - `RoleType` / `PermissionCatalog`
- 后端后续必须替换的是：
  - `/api/auth/wx-login`
  - `WeChatIdentityResolver`
  - `RegisterPayloadIntegrityService` 当前的小程序签名壳
  - `QrSessionService` / `CheckinConsumeService` 为中心的二维码正式链路

### Web 骨架当前真实状态

- `web/` 已存在未提交初稿，包含 `package.json`、Vite 配置、测试配置与 `App.test.tsx`。
- 当前 `App.test.tsx` 已先行定义最小目标：`/login` 和 `/activities` 必须渲染带标题的基础壳层。
- 当前 `web/src/app/router.tsx` 仅返回 `login placeholder` / `bind placeholder` / `activities placeholder`，与测试不一致。
- 已执行 `cd web && npm install` 完成依赖安装。
- 已执行 `cd web && npm test -- --run`，失败根因明确为“路由只渲染裸文本占位，缺少可访问 heading 壳层”，不是工具链或测试环境故障。

### 首批实现落地结果

- `web/` 骨架已从占位态收口为可运行的移动端页面壳层，路由层已真实挂载 `/login`、`/bind` 与 `/activities` 占位页。
- `web/src/shared/http/client.ts` 已采用 `/api/web` 前缀、`Authorization: Bearer` 会话注入、`session_expired` 清理会话、统一业务错误抛出。
- `web/src/shared/session/session-store.ts` 已以 `localStorage` 承载 `session_token`，并提供 `getSession / setSession / clearSession`。
- `web/src/shared/device/browser-capability.ts` 已统一探测 Passkey、Credential Manager、Visibility Lifecycle 与 Wake Lock 能力。
- `web/src/shared/device/page-lifecycle.ts` 已提供回到前台后的统一订阅入口。
- `web/src/features/auth/api.ts` 已按文档首批契约落到：
  - `verify-identity`
  - `register/options`
  - `register/complete`
  - `login/options`
  - `login/complete`
- `web/src/features/auth/webauthn.ts` 已补：
  - WebAuthn options 标准化
  - `ArrayBuffer` 与 base64url 互转
  - attestation / assertion 响应序列化
- `BindPage` 与 `LoginPage` 当前已达到的前端行为：
  - 绑定页未填学号/姓名不可提交
  - 绑定成功后执行实名校验 -> register/options -> `navigator.credentials.create` 包装 -> register/complete -> 写会话 -> 跳 `/activities`
  - 登录页在不支持 Passkey 时显示不支持页面
  - 登录成功后执行 login/options -> `navigator.credentials.get` 包装 -> login/complete -> 写会话 -> 跳 `/activities`

### 2026-03-09 第二阶段审查发现

- 当前 `web/` 测试与构建均通过：
  - `cd web && npm test -- --run`
  - `cd web && npm run build`
- 但首批实现与设计基线存在两个高风险偏差：
  - `src/app/router.tsx` 仅声明了静态路由，没有落实文档要求的登录态 / 绑定态守卫，导致未登录或未绑定用户仍可直接进入 `/activities` 占位页。

### 半程复审新增发现与修复

- `web/src/shared/http/client.ts` 缺少 GET 并发去重：
  - 在 React StrictMode、手动重试和回前台刷新下会重复发起相同读取请求。
  - 已补 `inflightGetRequests` 去重，并新增回归测试。
- `web/src/features/activities/view-model.ts` 在 `progress_status` 缺失时把“开始时间早于当前时间”的活动直接判为 `completed`：
  - 会误伤仍在进行中的活动，并连带隐藏签到 / 签退入口。
  - 已改为在缺少显式状态时保守回落到 `ongoing`，并新增 `view-model.test.ts`。
- `web/src/features/activities/api.ts` 和页面路由拼接策略不一致：
  - API 会对 `activity_id` 做 path segment 编码，但 `Link` 之前直接拼原值。
  - 已新增 `buildActivityDetailPath` / `buildActivityActionPath` 并在卡片、详情页、签到页统一复用。
- `web/src/pages/activity-detail/ActivityDetailPage.tsx`、`web/src/pages/checkin/CheckinPage.tsx`、`web/src/pages/activities/ActivitiesPage.tsx` 存在旧请求覆盖新状态风险：
  - 已补 request version 保护，并在活动详情 / 签到页新增路由切换回归测试。
- `web/src` 的交互控件仍主要依赖手写 CSS：
  - 已引入 `tdesign-mobile-react`
  - 已新增 `AppButton`、`InlineNotice`、`StatusTag`
  - 已新增 `ActivityMetaPanel` 收口活动信息块，减少列表 / 详情 / 输入页重复结构
- `web/src/app/styles/base.css` 存在较强“手写质感样式”倾向：
  - 已收敛为更克制的浅色移动端基线，降低大渐变、超大圆角和伪按钮样式占比。

## 2026-03-10 Web 完成度复核与 URL 冲突审查

### 真实完成度判断

- 以当前仓库代码而非文档自述为准，`wxapp-checkin` 的 Web-only 主链路已经完成：
  - `backend/src/main/java/com/wxcheckin/backend/api/controller` 当前只剩 `WebAuthController`、`WebActivityController`、`WebAttendanceController`、`WebStaffController`
  - `web/` 已覆盖普通用户、staff、解绑申请、解绑审核等正式页面
  - `frontend/` 与根级小程序配置已删除
- 当前自动化结果仍然真实成立：
  - `cd backend && ./mvnw test` => 27 个测试通过
  - `cd web && npm test -- --run` => 48 个测试通过
  - `cd web && npm run build` => 构建通过

### 审查新增发现：本地联调断链

- `web/src/shared/http/client.ts` 之前把请求固定写成 `fetch("/api/web${path}")`。
- `web/vite.config.ts` 之前没有 `server.proxy`，也没有任何 API/base path 环境变量。
- 因此当开发者按 README 分别启动：
  - `cd backend && ./scripts/start-test-env.sh`
  - `cd web && npm run dev`
  前端请求会落到 Vite 本身，而不是后端 `9989`，真实结果是 404。
- 这是“自动化测试测不出，但本地联调一定会踩”的未完成项，必须修。

### 审查新增发现：跨项目冲突边界

- 与 `suda_union` 的 controller 命名本身不直接冲突：
  - `suda_union` 仍是 `/activity`、`/user`、`/session`、`/department`、`/suda_login`、`/token`
  - `wxapp-checkin` 是 `/api/web/**`
- 但如果与 `suda-gs-ams` 共用同一域名 / 网关，会有两类实际风险：
  - 两个 SPA 都默认占用 `/` 和 `/login`
  - `suda-gs-ams` 生态里存在更宽的 `/api/*` 代理规则，可能把 `wxapp-checkin` 的 `/api/web/*` 错路由
- 这不是“接口名重名”，而是“路由前缀优先级和部署边界没写清楚”。

### 本轮修复结果

- 新增 `web/src/shared/runtime/runtime-config.ts`，统一管理：
  - `VITE_APP_BASE_PATH`
  - `VITE_API_BASE_PATH`
  - `VITE_API_PROXY_TARGET`
- `App.tsx`、`shared/http/client.ts`、`vite.config.ts` 已统一接入。
- 新增回归测试：
  - `web/src/shared/runtime/runtime-config.test.ts`
  - `web/src/test/vite-config.test.ts`
- 新增 `web/.env.example`，并回写 README / backend README / API_SPEC / changes。

## 2026-03-10

### Web-only 收尾重新定界

- 用户已明确确认本轮完成判定采用：
  - 本地开发环境可启动
  - 前后端自动化测试通过
  - Web 主链路代码完整可联调
- 用户未要求把真机 Passkey 实测作为本轮阻塞项，因此本轮可以采用“开发可运行”的后端 WebAuthn 闭环。

### 当前缺口确认

- `web/` 前端与 `/api/web/activities/**`、管理员页、解绑审核页已基本存在，但“后端 Web 身份与浏览器绑定”仍未真实落地。
- `backend/` 当前仍保留：
  - `/api/auth/wx-login`
  - 旧二维码签发与消费正式入口
  - `WeChatIdentityResolver`
  - `frontend/` 小程序目录与小程序配置文件
- 这意味着仓库仍处于“双链路并存”状态，不满足 Web-only 收尾目标。

### 本轮实施策略

- 后端认证采用“真实 challenge + 真实落库 + 真实会话流转 + 开发可运行”的收口方案。
- 不在本轮引入重型 WebAuthn 服务端库，避免超出用户确认的验收口径。
- 删旧目标明确包含：
  - 删除 `frontend/`
  - 删除根级小程序配置
  - 删掉旧微信登录与旧二维码正式接口入口
  - README / API / 功能文档全部切到 Web-only

### 本轮收尾结果

- 后端现已新增并打通：
  - `WebAuthController`
  - `WebIdentityService`
  - `PasskeyChallengeService`
  - `web_browser_binding`
  - `web_passkey_credential`
  - `web_passkey_challenge`
  - `web_admin_audit_log`
- 后端认证当前具备：
  - `verify-identity`
  - `register/options`
  - `register/complete`
  - `login/options`
  - `login/complete`
  - `client_data_json` 的 challenge/type/origin 基础校验
- 解绑审批现已不只是“删 session”：
  - 同时失效旧浏览器绑定
  - 同时失效旧 Passkey 凭据
  - 写管理员审计日志
- 前端现已补齐：
  - `X-Browser-Binding-Key` 自动注入
  - 浏览器绑定键本地持久化
  - 普通用户解绑申请页 `/unbind-request`
  - 活动列表页普通用户解绑入口
- 删旧已完成：
  - 删除 `frontend/`
  - 删除根级 `project.config.json` / `project.private.config.json`
  - 删除旧 `AuthController` / `CheckinController` / `CompatibilityController` / `ActivityController`
  - 删除旧 `AuthService` / `RegistrationService` / `WeChatIdentityResolver` / `RegisterPayloadIntegrityService`

### 三分之三阶段新增发现

- 当前 `web/` 半程并不只是缺管理员页，后端 `/api/web/**` 也基本未真实落地：
  - `web/src/features/activities/api.ts` 指向 `/api/web/activities/**`
  - backend 现状仍主要暴露 `/api/staff/**`、`/api/checkin/**`、`/api/auth/**`
- 前端当前会话模型只有 `session_token`，没有把已有响应字段里的 `role / permissions / user_profile` 持久化：
  - 导致 staff 无法在 Web 前端进入真正的角色化页面
  - 也导致现有活动列表对 staff 会被普通用户过滤逻辑误伤
- backend 可直接复用的主干比预估更高：
  - `SessionService`
  - `ActivityQueryService`
  - `CheckinConsumeService`
  - `QrSessionService`
  - `OutboxRelayService`
- 本轮最合适的后端策略不是完整重构，而是：
  - 新增 Web DTO / Controller 适配层
  - 新增最小 `DynamicCodeService`
  - 在 `CheckinConsumeService` 内兼容 6 位码输入
  - 新增最小 `web_unbind_review` 表支撑审核页
- 已联网核对当前组件库依据：
  - 本地依赖为 `tdesign-mobile-react@0.21.2`
  - 官方包与官方仓库均可确认 `Tabs`、`Dialog`、`NoticeBar`、`Cell`、`CellGroup`、`List`、`Toast` 等组件仍可用
  - 因此管理员页与审核页继续优先复用组件库能力

### 三分之三阶段实现后结论

- 前端层面：
  - `session-store` 已支持角色、权限与用户画像持久化。
  - `ActivitiesPage` 已修正 staff 被普通用户过滤逻辑误伤的问题。
  - `ActivityDetailPage` 已在 staff 身份下展示“进入管理”入口，并关闭普通用户动作按钮。
  - `router.tsx` 已补 `/staff/activities/:id/manage` 与 `/staff/unbind-reviews`，并增加 `StaffRoute` / `ReviewRoute`。
  - `StaffManagePage` 已支持：
    - `checkin/checkout` 切换
    - 回前台刷新
    - 一键全部签退确认
  - `UnbindReviewPage` 已支持：
    - `pending/approved/rejected` 状态切换
    - approve / reject 动作后刷新
- 后端层面：
  - `/api/web/activities`、`/api/web/activities/{id}` 已真实落地，不再是前端空对空调用。
  - `/api/web/activities/{id}/code-session` 已返回 6 位动态码而不是旧 `qr_payload`。
  - `/api/web/activities/{id}/code-consume` 已支持 `action_type + code`，同时不破坏旧二维码消费。
  - `/api/web/staff/activities/{id}/bulk-checkout` 与 `/api/web/unbind-reviews` / `/api/web/staff/unbind-reviews/**` 已打通最小闭环。
  - `web_unbind_review` 当前只承载审核流与旧会话失效，不包含完整浏览器绑定失效语义；这仍是后续 `web_browser_binding` 阶段要补的点。
- 测试与环境层面：
  - backend 原有测试环境在当前 WSL/JDK 17 下会因为 Mockito inline mock maker 自附加失败而整体不可测。
  - 通过在 `src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker` 切回 subclass mock maker 后，测试基线恢复可用。
- 当前 `web/src` 非测试源码注释统计更新为：
  - 注释行数约 `653`
  - 总行数约 `2608`
  - 注释占比约 `25.0%`
  - `src/pages/bind/BindPage.tsx` 未在发起实名绑定前检查 Passkey 能力，当前不支持 Passkey 的浏览器可以进入实名校验流程，直到调用 `navigator.credentials.create()` 才以运行时错误失败。
- `src/shared/http/client.ts` 还有一个明显的 API 韧性风险：
  - 默认假设所有响应都是 JSON，且只看响应体里的 `status` 字段决定成功或失败；
  - 一旦后端/网关返回空响应、HTML 错页或缺少 `status` 字段的 4xx/5xx JSON，前端会抛出原生解析异常或把异常响应误当成功。
- 当前测试偏向 happy path，尚未覆盖：
  - 已有会话访问 `/login` 时的跳转行为；
  - 未绑定访问 `/activities` 时的跳转行为；
  - 绑定页在不支持 Passkey 时的拦截行为；
  - `requestJson()` 对非 JSON / 非 2xx / 缺少 `status` 的异常响应处理。

## 2026-03-10 联调前全面复核新增发现

### 已修复的真实问题

- `web/src/pages/staff-manage/StaffManagePage.tsx` 原先没有“只认最后一次请求”的保护：
  - 快速切换签到码 / 签退码时，旧响应可能回写新页面。
  - 现已为详情请求和动态码请求分别加版本保护，并把详情拉取与动作页签切换解耦。
- `web/src/features/staff/components/DynamicCodePanel.tsx` 原先只展示一次性 `expires_in_ms` 快照：
  - 倒计时不会递减，到期也不会自动刷新当前动态码。
  - 现已按 `expires_at + server_time_ms` 做本地对时、视觉倒计时和到期自动刷新。
- `web/src/pages/staff-manage/StaffManagePage.tsx` 原先没有任何防息屏提示：
  - 管理员长时间亮屏展示动态码时，页面不会尝试 `Wake Lock`，也不会提示手动常亮。
  - 现已在支持时尝试申请 `screen wake lock`，不支持或失败时给出非阻塞提示。
- `web/src/shared/session/session-store.ts` 与 `web/src/pages/activities/ActivitiesPage.tsx` 原先没有显式支持 `review_admin`：
  - 审核管理员会被误判成普通用户，首页入口和审核路由都会错。
  - 现已显式支持 `review_admin`，并把首页审核入口与解绑申请入口拆开判断。
- `backend` 原先只在登录/绑定阶段使用 `X-Browser-Binding-Key`：
  - 进入业务态后，`/api/web/**` 大部分接口实际上只校验 `session_token`，浏览器绑定约束失效。
  - 现已把活动、发码、验码、批量签退、解绑申请与审核链路统一接入“session + browser binding key”双校验。
- `backend` 原先只对 `support_checkout` 生效，`support_checkin` 形同展示字段：
  - 现已在 staff 发码与 normal 验码两侧同时补齐 `support_checkin=false` 拦截。
- `backend` 原先在解绑审批后只返回 `passkey_not_registered`：
  - 前端无法区分“从未绑定”与“刚被管理员解绑”。
  - 现已对被撤销的浏览器绑定优先返回 `binding_revoked`。
- `backend` 原先把解绑申请时间返回为展示字符串：
  - 这与 API 规范“时间字段统一毫秒时间戳”冲突。
  - 现已把 `submitted_at` 改为毫秒时间戳。

### 已修复的文档问题

- 根 `README.md` 已把“正式基线”和“历史复盘 / 历史计划”阅读顺序分开。
- `backend/README.md` 已补本地测试环境变量模板使用方式，并说明 Passkey 本地 / 自定义域名联调填写规则。
- 新增 `backend/scripts/test-env.example.sh`，避免第一次接手时直接卡在缺失 `~/.wxapp-checkin-test-env.sh`。
- `backend/TEST_ENV_TESTING.md` 已从历史小程序口径改成 Web-only 联调口径。
- `docs/WEB_MIGRATION_REVIEW.md` 已修正“当前完成态”和“历史审查时态”混写。
- `docs/WEB_COMPATIBILITY.md` 已标出“自动化已验证 / 真机矩阵仍待补录”的当前状态。

### 口径决策补记

- 2026-03-10 已确认把动态码正式口径统一为 10 秒窗口：
  - 保持当前后端实现、配置和测试基线不变；
  - 正式需求与补充设计文档已同步收口到 10 秒；
  - 后续不再使用旧动态码窗口口径作为联调或验收标准。

## 2026-03-10 审查补记（代码/文档/联调）

- 新鲜验证：`cd web && npm test`、`cd web && npm run build`、`cd backend && ./mvnw test -q` 均通过。
- 实机级联调证据（命令行）：已验证 `POST /api/web/auth/login`、`POST /api/web/auth/change-password`、`GET /api/web/activities`、解绑申请/审核/旧浏览器失效/新浏览器重登成功。
- 文档问题：`docs/REQUIREMENTS.md` 仍引用旧 Passkey 实施计划；`backend/TEST_ENV_TESTING.md` 仍写“Passkey 正式登录”；`docs/WEB_DESIGN.md` 仍写 `frontend/` 过渡目录；`backend/DB_DATABASE_DEEP_DIVE.md` 未补密码字段口径。
- 高风险问题 1：解绑申请必须先登录且存在活跃绑定；当用户在新浏览器被 `account_bound_elsewhere` / `binding_conflict` 拒绝时，缺少 Web 自助解绑入口。
- 高风险问题 2：`LegacySyncService` 仅按 legacy `state` 推导 `progress_status`，`WebActivityController` 又直接据此返回 `can_checkin/can_checkout`；当前联调数据中活动详情显示可签到，但 `code-session` 因真实时间窗返回 `outside_activity_time_window`，存在前后端契约不一致。
- 性能问题：活动列表与解绑审核列表均无分页；登录路径按 `legacy_user_id` 查找但 `V1__baseline_extension_schema.sql` 未给 `wx_user_auth_ext.legacy_user_id` 建索引。
- 联调边界：已确认 `suda_union` / `suda-gs-ams` / `wxapp-checkin/backend` 可同时拉起；但仓库内尚无 `wxapp-checkin/web -> backend -> outbox -> suda_union -> suda-gs-ams` 全闭环落盘证据。
