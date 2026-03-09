# 发现记录

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
  - `src/pages/bind/BindPage.tsx` 未在发起实名绑定前检查 Passkey 能力，当前不支持 Passkey 的浏览器可以进入实名校验流程，直到调用 `navigator.credentials.create()` 才以运行时错误失败。
- `src/shared/http/client.ts` 还有一个明显的 API 韧性风险：
  - 默认假设所有响应都是 JSON，且只看响应体里的 `status` 字段决定成功或失败；
  - 一旦后端/网关返回空响应、HTML 错页或缺少 `status` 字段的 4xx/5xx JSON，前端会抛出原生解析异常或把异常响应误当成功。
- 当前测试偏向 happy path，尚未覆盖：
  - 已有会话访问 `/login` 时的跳转行为；
  - 未绑定访问 `/activities` 时的跳转行为；
  - 绑定页在不支持 Passkey 时的拦截行为；
  - `requestJson()` 对非 JSON / 非 2xx / 缺少 `status` 的异常响应处理。
