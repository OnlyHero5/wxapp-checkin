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
