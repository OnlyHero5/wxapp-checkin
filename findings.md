# Findings & Decisions

## Requirements
- 评估将 `wxapp-checkin/frontend` 从微信小程序改为手机浏览器 Web 端的整体可行性。
- 重点调研手机端调用摄像头扫码在不同浏览器上的兼容性。
- 需要主动搜索外部资料，同时结合仓库现状给出判断。
- 用户进一步要求尽可能覆盖更多手机浏览器，包括 Android、iPhone/iOS、HarmonyOS/鸿蒙，以及常见手机内置浏览器。

## Research Findings
- 当前仓库的“项目自有”实现由四层组成：`frontend/` 小程序运行时、`backend/` Spring Boot 后端、`docs/` 文档体系、`backend/scripts`/`frontend/tests` 的联调与测试基线；`miniprogram_npm` 属第三方构建产物，不应作为新方案设计输入。
- 新业务已确认的关键约束如下：
  - 认证：`学号 + 姓名` 首绑，后端只读 `suda_union` 做实名校验。
  - 登录：绑定后注册 Passkey，后续登录时验证一次，签入后发临时会话。
  - 浏览器绑定：一个浏览器只允许绑定一个账号；换浏览器/换手机必须管理员审核解绑。
  - 普通用户：必须先进入具体活动，再输入签到码或签退码。
  - 动态码：按“活动 + 动作(checkin/checkout) + 7.5 秒时间片”服务端生成；同活动同动作同一时间片所有管理员看到同一个 6 位码。
  - 权限：报名资格仍以 `suda_union` 报名名单为准，未报名不可签到/签退。
  - 管理员特权：支持“当前活动一键全部签退”，仅处理“已签到未签退”用户，统一使用管理员点击时的服务端时间。
- 当前前端对微信小程序运行时存在系统性耦合：
  - 登录依赖 `wx.login`，见 `frontend/utils/auth.js`
  - 请求、重登、Toast、导航、网络监听、存储全部依赖 `wx.*`
  - 扫码依赖 `wx.scanCode`，见 `frontend/pages/scan-action/scan-action.js`
  - 动态码展示页围绕二维码渲染与页面定时器组织，见 `frontend/pages/staff-qr/staff-qr.js`
- 当前后端主链路以“微信身份 + 二维码 payload + 扫码消费”为中心：
  - `AuthService` 通过 `WeChatIdentityResolver` 将 `wx_login_code` 换成内部 `wx_identity`
  - `QrSessionService` 生成 `qr_payload`
  - `CheckinConsumeService` 解析 payload、验签、防重放、更新状态并回写 outbox
- `suda_union` 的复用价值很高，但边界必须保持“只读业务事实源”：
  - `LegacyUserLookupService` 已能按学号查询 `suda_user`
  - `LegacySyncService` 已从 `suda_activity` 和 `suda_activity_apply` 拉取活动与报名/签到状态
  - `OutboxRelayService` 已将扩展库签到事件回写到 `suda_activity_apply`
- 现有扩展库的核心复用点：
  - `wx_session` 可继续承担 Web 临时会话
  - `wx_user_activity_status` 可继续承担报名/签到/签退状态
  - `wx_checkin_event` 可继续承担审计流水，但字段语义要从 `qr_payload` 调整为“动态码消费事件”
  - `wx_replay_guard` 可继续承担时间片级防重放
  - `wx_sync_outbox` 可继续承担对 `suda_union` 的最终一致性回写
- 当前存在一个对新业务更敏感的并发风险：
  - `CheckinConsumeService` 对 `wx_user_activity_status` 做了悲观锁；
  - 但 `wx_activity_projection.checkin_count/checkout_count` 的更新仍是“读实体 -> 加减 -> save”，仓储层没有原子更新语句；
  - 改成 6 位共享码后，同一时间片内的并发提交更集中，这里更容易出现丢计数，需要在新设计中修复。
- 现有注册载荷签名 `RegisterPayloadIntegrityService` 是“session_token + payload_encrypted”的轻量完整性保护，可选择复用到 Web 首绑提交，但它不能替代 Passkey 或浏览器绑定。
- 当前文档、测试、脚本全都围绕“小程序 + 微信登录 + 二维码扫码”构建，新文档需要整体改写而不是增量修补。
- 当前小程序扫码主流程位于 `frontend/pages/scan-action/scan-action.js`，通过 `wx.scanCode({ onlyFromCamera: true, scanType: ["qrCode"] })` 直接调用原生扫码能力。
- 小程序前端不仅扫码依赖 `wx.*`，登录、存储、请求、导航、Toast、网络状态监听也都有直接耦合，因此不是“仅替换扫码组件”即可完成迁移。
- `frontend/utils/auth.js` 依赖 `wx.login()` 换取登录 code，再请求后端 `/api/auth/wx-login`。这意味着 Web 端若不再处于小程序环境，登录链路必须重设，不能沿用现有鉴权入口。
- `frontend/utils/request-core.js` 依赖 `wx.request()`、`wx.showToast()`、`wx.reLaunch()`；迁移到 Web 后分别需要替换为 `fetch/axios`、Web UI 提示组件、Web 路由跳转。
- `frontend/utils/storage.js` 完全建立在 `wx.getStorageSync()` / `wx.setStorageSync()` 上，Web 可迁移到 `localStorage` 或 `IndexedDB`，但需要统一封装层。
- `frontend/utils/ui.js` 直接依赖 `wx.showToast()`、`wx.showModal()`；UI 反馈层需重写。
- `frontend/pages/staff-qr/staff-qr.js` 的二维码展示与轮询业务逻辑本身可复用，但页面生命周期、导航栏、窗口尺寸读取依赖 `Page()`、`wx.getWindowInfo()`、`wx.setNavigationBarTitle()` 等小程序能力，需要改写为 Web 框架组件。
- 微信官方服务号网页文档确认：微信内置浏览器打开普通 URL 网页时，可以通过 JS-SDK 使用“扫一扫”等微信特有能力；这是一条只在微信内浏览器成立的专用扫码方案，不适用于 Safari/Chrome 等普通浏览器。
- 微信 JS-SDK 的 `scanQRCode` 官方文档明确存在，支持 `needResult` 与 `scanType`，同时要求先做 `wx.config` 注入权限；前置条件包括“JS 接口安全域名”、服务号权限、后端生成签名、`jsApiList` 包含 `scanQRCode`。
- 微信官方文档还明确：JS-SDK 依赖绑定合法域名，不支持 IP、端口号和短链域名，并要求域名完成 ICP 备案；因此微信内 H5 扫码不能像小程序一样在任意临时地址直接工作。
- MDN `getUserMedia()` 文档明确该能力只在安全上下文可用，意味着通用浏览器扫码页面必须部署到 HTTPS（或 localhost 开发环境）才能请求摄像头。
- Can I Use 的 `getUserMedia/Stream API` 数据显示：iOS Safari 从 11.0 开始支持，Android Chrome 当前版本支持；因此在主流手机浏览器中“打开摄像头取流”本身是可行的。
- 但 `BarcodeDetector` 兼容性不适合作为统一方案。MDN Browser Compat Data 显示：Android Chrome 自 83 支持，但 Safari 自 17 起仍带实验性开关标记，Firefox 不支持；因此若要覆盖 iPhone Safari，需要引入 `zxing-js`、`jsQR` 之类的纯前端解码库作为主路径或兜底。
- 后端与文档均显示当前鉴权模型是“小程序专用”：`POST /api/auth/wx-login` 接收 `wx_login_code`，服务端调用微信 `jscode2session` 解析 `openid/unionid` 后签发业务 `session_token`。这套流程不能直接给普通浏览器 Web 复用。
- MDN 将 `MediaDevices.getUserMedia()` 标记为 Baseline Widely available，但同时明确它只在安全上下文可用；因此“尽量覆盖更多手机浏览器”的前提仍然是 HTTPS。
- Android 官方 `WebView` 文档说明：网页请求摄像头等受保护资源时，需要宿主 App 在 `WebChromeClient.onPermissionRequest` 中显式处理并授权。这意味着 Android 各类内置浏览器/WebView 容器存在天然不确定性，即便系统内核支持，宿主也可能没放开权限。
- WebKit 官方视频策略文档说明：iPhone 上若未设置 `playsinline`，`<video>` 播放会进入全屏；扫码类 H5 页面应显式使用 `playsinline`，否则 iPhone 上取流预览体验会变差甚至不可用。
- `html5-qrcode` 官方支持说明显示，它面向移动浏览器主推的支持面包括 Android 上的 Chrome / Firefox / Edge / Opera，以及 iOS 15.1+ 的 Safari / Chrome / Edge；这说明“视频流 + JS 解码库”是目前覆盖面最广的通用路线之一。
- `@zxing/library` 说明其浏览器层依赖 `MediaDevices`，并建议在老旧浏览器用 `adapter.js` 等 polyfill；同时指出很老的 Android 默认浏览器会受 TypedArray 等基础能力限制，说明极老旧浏览器无法作为重点承诺对象。
- HarmonyOS / 华为浏览器方面，公开且权威的浏览器兼容性资料明显少于 Android/iOS。当前能明确确认的是：华为生态支持 H5 作为服务触达形式，但未找到等同于 MDN/CanIUse 粒度的 Huawei Browser `getUserMedia` 官方兼容矩阵。因此对于 HarmonyOS 手机浏览器，更稳妥的判断是“高概率接近 Chromium/WebView 行为，但必须真机验证”，这部分目前属于带不确定性的推断。
- Can I Use 的 `getUserMedia/Stream API` 数据进一步显示，Android 生态里除 Chrome 外，Firefox Android、Samsung Internet、UC Browser for Android、QQ Browser for Android 也已有支持记录；因此通用 Web 扫码主路径不应只针对 Chrome。
- Chrome 开发者文档明确提到“iOS 上所有浏览器都基于 WebKit”，这意味着 iPhone 上 Chrome/Edge 等第三方浏览器在媒体能力边界上大体受 Safari / WebKit 共性限制约束。
- 对 Android/iOS/HarmonyOS 同时追求高覆盖时，工程上最稳的原则是：
  - 只把 `getUserMedia` 当摄像头取流基线；
  - 不把 `BarcodeDetector` 当产品基线；
  - 通过运行时能力探测决定是否启用扫码；
  - 通过微信 JS-SDK 为微信内 H5 提供专用增强路径；
  - 为受限容器/WebView/异常浏览器提供降级入口（图片上传识别、手输二维码内容）。
- 鸿蒙/华为生态补充确认：
  - 华为官方文档确认 HarmonyOS 存在 WebView/Web 组件，但未找到 `getUserMedia` 兼容矩阵；
  - 华为官方也提供云测试/开放测试服务，说明官方默认真机覆盖验证是必要步骤；
  - 因此 HarmonyOS 浏览器与 WebView 的支持结论必须区分“已证实”与“待实测”。
- 页面层普遍通过 `Page()`、`App()`、`Component()`、`getApp()` 组织生命周期，且界面文件是 `.wxml` / `.wxss`；从运行时到渲染层都不是 Web 可直接复用的形态。
- `frontend/package.json` 只包含小程序依赖 `tdesign-miniprogram`，没有 Web 构建工具链和浏览器 UI 组件体系，因此 Web 端不能在当前目录里“轻量切换运行目标”，而是需要重建前端宿主层。
- 可复用的业务逻辑主要集中在纯 JavaScript 工具层：`frontend/utils/qr-payload.js` 的二维码票据规则、`frontend/utils/validators.js` 的表单校验、`frontend/utils/payload-seal.js` / `frontend/utils/crypto.js` 的请求载荷封装、`frontend/utils/api.js` 的接口契约。
- `frontend/tests/qr-checkin-flow.test.js` 证明签到/签退、轮换窗口、宽限期、重复提交等核心规则主要由 API 协议与后端驱动，不依赖小程序容器本身。
- `MediaDevices.getUserMedia()` 只能在安全上下文使用，Web 端扫码必须跑在 HTTPS 或 localhost 场景，否则移动浏览器无法正常拉起摄像头。
- WebKit 在 iOS 11 开始宣布 Safari 支持 WebRTC 与 `getUserMedia()`，说明 iPhone Safari 具备 Web 摄像头采集基础，但仍要遵守权限和安全域约束。
- WebKit 对 iPhone 视频播放策略要求更严格；若扫描预览视频未加 `playsinline`，容易触发全屏播放，影响扫码体验。
- 微信官方网页 JS-SDK 明确提供 `scanQRCode` 接口，并要求先 `wx.config()` 注入签名；这说明“微信内 H5”可以走微信提供的扫码能力，但需要额外后端签名支持。
- 微信官方文档同时说明所有 JS 接口只有在微信浏览器中注入并配置后才会生效，因此 `scanQRCode` 不能作为普通浏览器 H5 的统一方案。
- `html5-qrcode` 官方文档给出的实践支持范围覆盖 Android 上的 Chrome/Firefox/Edge，以及 iOS 15.1+ 的 Safari/Chrome/Edge；它更适合作为普通浏览器 H5 的主方案。
- Chrome 官方 shape detection 文档展示了 `BarcodeDetector` 能力，但这是额外平台能力，不适合作为跨浏览器唯一基线；仍应准备基于视频流 + JS 解码库的兼容实现。
- 新一轮扩展调研的重点应从“单浏览器”改为“同内核家族”。iOS 上 Chrome/Edge 等第三方浏览器仍受 WebKit 能力边界约束，因此它们与 Safari 的差异通常更多体现在壳层交互，而不是底层摄像头 API。
- HarmonyOS 侧不能简单套用 Android 浏览器结论，需要继续确认华为浏览器 / ArkWeb / WebView 的官方能力与权限模型，再决定是否可视为 Chromium 兼容分支。
- OpenHarmony/ArkWeb 官方文档公开的默认 UA 结构包含 `AppleWebKit/537.36 ... Chrome/{version} ... Safari/537.36 ArkWeb/{version}`。这说明 HarmonyOS/OpenHarmony 的 Web 运行时并非 iOS/WebKit 家族，兼容性判断应更接近 Chromium 系，但仍需按 ArkWeb 单独验真。
- HarmonyOS/OpenHarmony 官方资料检索的索引可用性一般，当前最稳的官方锚点仍是 UA/容器层资料；如果后续拿不到明确的 `getUserMedia`/摄像头权限文档，需要在结论中把鸿蒙兼容性表述为“Chromium-like 推断 + 真机验证必须项”。
- 微信官方 `iOS WKWebview网页适配` 文档明确指出：微信 iOS 客户端已逐步升级为 WKWebView 内核，且“微信 WebView 行为与 Safari 高度一致，唯一不同是微信 WebView 注入了 JSBridge 脚本”。这意味着 iPhone 上微信内 H5 的很多基础 Web 行为，应按 Safari/WebKit 共性来评估。
- 同一份微信官方文档还明确：iOS 微信 WKWebView 下如果页面使用 History API + `wx.config`，曾出现 JSSDK 权限调用失败问题；官方建议历史上优先使用 Anchor hash 替代。这说明微信内 H5 即使能走 `scanQRCode`，SPA 路由与签名逻辑也需要谨慎处理。
- 微信官方 iOS 适配文档再次强调视频标签要带 `webkit-playsinline playsinline`，否则 iPhone 侧视频交互体验会退化；这对标准 Web 摄像头扫码预览同样关键。
- 微信官方 `鸿蒙网页开发适配指南` 明确指出：鸿蒙系统内浏览器 UA 特征与 iOS、Android 不同，开发者应主动适配；在鸿蒙微信里，官方建议通过 `navigator.userAgent` 同时包含 `OpenHarmony` 和 `MicroMessenger` 识别运行环境，并通过 `wx.checkJsApi` 逐项探测当前 JS 接口是否可用。
- Apple 官方文档说明：iOS/iPadOS 的“alternative browser engines”是面向欧盟、且从 iOS 17.4 / iPadOS 18 起通过 entitlement 申请的特殊能力。这意味着在面向主流市场的 iPhone 浏览器兼容性判断中，仍应把 Chrome iOS、Edge iOS 等视为与 Safari 接近的 WebKit 约束环境；这是基于 Apple 官方政策的推断。
- MDN Browser Compat Data 显示：`MediaDevices` 主体能力在 Android Chrome 52、Firefox Android 50、Safari 11 / iOS Safari mirror、Samsung Internet 6.0 等移动浏览器家族中均已进入可用区间；同时 `secure_context_required` 仍成立，因此 HTTPS 依旧是跨平台共同前提。
- 同一份 MDN Browser Compat Data 显示：`BarcodeDetector` 在 `chrome_android` 为 83 起可用，`firefox_android` 不支持，`safari/safari_ios` 标注为 17 起但带实验性状态，`samsunginternet_android` 为 mirror。结论不变：它适合作为 Android/Chromium 增强路径，不适合做“尽可能多覆盖浏览器”的唯一方案。
- MDN Browser Compat Data 的 `getUserMedia` 细项进一步给出了 Android 家族支持：`chrome_android` 跟随 Chrome 53+，`firefox_android` 跟随 Firefox 36+，`samsunginternet_android` 6.0+，`webview_android` 53+；同时 `secure_context_required` 仍成立。主流 Android 浏览器家族总体可用，但 HTTPS 是共同前提。
- Android 官方 `WebChromeClient.onPermissionRequest()` 文档明确写出：当网页请求受保护资源时，宿主应用必须调用 `PermissionRequest.grant()` 或 `deny()`。这意味着 Android WebView / App 内置浏览器的核心风险不在浏览器内核，而在宿主是否实现了媒体权限桥接。
- Can I Use 的原始特性说明明确标注：`getUserMedia()` 默认不在 Android WebView 中启用，例如 Facebook 或 Snapchat 这类 in-app browser。该说明与 Android 官方权限回调模型相互印证，进一步说明“内置浏览器支持度”不能直接等同于 Chrome Android。
- OpenHarmony 官方 `web-rtc.md` 直接给出 Web 组件调用 `navigator.mediaDevices.getUserMedia()` 的示例，并要求声明 `ohos.permission.CAMERA`、`ohos.permission.MICROPHONE`，同时在 Web 组件的 `onPermissionRequest` 中授权。说明 ArkWeb/OpenHarmony 的 Web 容器具备标准摄像头取流能力，但同样依赖宿主权限实现。
- OpenHarmony FAQ 同时明确：“WebView 支持 WebRTC 的 P-P 功能以及音视频流功能。” 这为鸿蒙 Web 容器支持摄像头/麦克风提供了官方锚点，但它描述的是 WebView 能力，不是“所有鸿蒙浏览器产品已完全等价支持”的发布承诺。
- Apple 官方 `Using alternative browser engines in the European Union` 说明写明：只有在欧盟、且最低 iOS 17.4 / iPadOS 18、并通过 entitlement 审核的场景下，应用才可使用 WebKit 以外的浏览器引擎。由此可以推断，在主流市场与普通分发条件下，Chrome iOS、Edge iOS 等仍应按 Safari/WebKit 能力边界来规划兼容性。
- Can I Use 的 Passkeys 数据（2026-03-09 核验）显示：
  - Chrome / Chrome Android `108+` 支持；
  - Edge `108+` 支持；
  - iOS Safari `16.0+` 支持；
  - Safari `16.1+` 支持；
  - Firefox / Firefox Android `122+` 支持；
  - Samsung Internet `21+` 支持。
- MDN Browser Compat Data 显示：
  - `inputmode` 在 Chrome `66+`、Firefox Android `79+`、iOS Safari `12.2+` 可用；
  - `Document.visibilityState` 在 Safari `7+`、Chrome `33+` 等主流浏览器家族早已可用。
- 这意味着新 Web 方案可以把“Passkey + 数字键盘 + 前后台恢复刷新”作为主流手机浏览器基线，但不能把 `Screen Wake Lock API` 作为硬依赖。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 新前端建议独立目录（例如 `web/`）而非强行改造 `frontend/` | 当前 `frontend/` 是小程序工程，运行时、构建链、目录约定与移动 Web 差异过大 |
| `suda_union` 只做实名和报名事实读取，不做业务逻辑改造 | 符合用户约束，也能降低联动风险 |
| Passkey 只在登录时校验一次 | 这是用户明确接受的安全/体验平衡点 |
| 浏览器绑定要作为单独域模型设计，而不是只靠本地存储 | 本地存储可被清理，必须由服务端持久化绑定状态并控制解绑流程 |
| 调研中同时看“业务逻辑可复用”和“终端能力要重写”的边界 | 这样才能判断真实改造成本 |
| 把“扫码兼容性”与“登录体系改造”视为最高风险项 | 这两项决定项目是否能真正脱离小程序运行 |
| 将扫码方案拆分为“微信内 H5”与“普通浏览器 H5”两条能力路径评估 | 两者底层能力、前置条件和兼容性完全不同 |
| 不把 `BarcodeDetector` 作为唯一实现前提 | iOS Safari 与 Firefox 兼容性不足，存在实验特性开关 |
| 对“尽可能多覆盖浏览器”的目标采用分层承诺 | 可明确承诺主流浏览器；内置浏览器/WebView/鸿蒙浏览器需列为重点验证对象而非先验保证 |
| 将浏览器覆盖目标分为“重点支持”“尽力支持”“仅降级支持”三层 | 能避免对资料不透明或宿主容器受限的平台做过度承诺 |
| 普通浏览器 H5 优先采用 `getUserMedia` + JS 解码库 | 这是跨浏览器更稳妥的方案，不绑定微信容器 |
| 微信内 H5 单独评估接入 JS-SDK `scanQRCode` | 微信官方已经提供该能力，兼容性预期比裸用 HTML5 相机更稳 |
| 将 Android / 鸿蒙 WebView 与独立浏览器 App 分开承诺 | WebView 是否可用强依赖宿主权限桥接与容器实现，不能直接沿用浏览器兼容矩阵 |
| Web-only 目标文档采用“需求 / 设计 / 兼容性 / 实施计划”四件套 | 便于后续直接按文档进入编码与删旧链路 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 暂无 | 持续记录 |

## Resources
- `/home/psx/app/wxapp-checkin/frontend/pages/scan-action/scan-action.js`
- `/home/psx/app/wxapp-checkin/frontend/utils/auth.js`
- `/home/psx/app/wxapp-checkin/frontend/utils/request-core.js`
- `/home/psx/app/wxapp-checkin/frontend/utils/storage.js`
- `/home/psx/app/wxapp-checkin/frontend/utils/ui.js`
- `/home/psx/app/wxapp-checkin/frontend/pages/staff-qr/staff-qr.js`
- `/home/psx/app/wxapp-checkin/frontend/utils/api.js`
- `/home/psx/app/wxapp-checkin/frontend/app.js`
- `/home/psx/app/wxapp-checkin/docs/API_SPEC.md`
- `https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia`
- `https://caniuse.com/stream`
- `https://developer.mozilla.org/docs/Web/API/BarcodeDetector`
- `https://developers.weixin.qq.com/doc/service/guide/h5/`
- `https://developers.weixin.qq.com/doc/service/guide/h5/jssdk.html`
- `https://developers.weixin.qq.com/doc/service/guide/h5/start.html`
- `https://developer.android.com/reference/android/webkit/PermissionRequest`
- `https://webkit.org/blog/6784/new-video-policies-for-ios/`
- `https://www.npmjs.com/package/html5-qrcode`
- `https://www.npmjs.com/package/@zxing/library`
- `https://developer.chrome.com/blog/chromium-chronicle-28/`
- `https://developer.huawei.com/consumer/en/codelab/HarmonyOS-WebView/`
- `https://developer.huawei.com/consumer/cn/agconnect/cloud-test/`
- `https://developer.huawei.com/consumer/cn/agconnect/open-test/`
- `https://consumer.huawei.com/cn/support/content/zh-cn16070780/`
- `/home/psx/app/wxapp-checkin/frontend/utils/qr-payload.js`
- `/home/psx/app/wxapp-checkin/frontend/utils/validators.js`
- `/home/psx/app/wxapp-checkin/frontend/tests/qr-checkin-flow.test.js`
- `/home/psx/app/wxapp-checkin/backend/src/main/java/com/wxcheckin/backend/application/service/LegacySyncService.java`
- `/home/psx/app/wxapp-checkin/backend/src/main/java/com/wxcheckin/backend/application/service/OutboxRelayService.java`
- `/home/psx/app/wxapp-checkin/backend/src/main/java/com/wxcheckin/backend/application/service/LegacyUserLookupService.java`
- `/home/psx/app/wxapp-checkin/backend/src/main/java/com/wxcheckin/backend/application/service/RegisterPayloadIntegrityService.java`
- `/home/psx/app/wxapp-checkin/backend/src/main/java/com/wxcheckin/backend/application/service/RecordQueryService.java`
- `/home/psx/app/wxapp-checkin/backend/DB_DATABASE_DEEP_DIVE.md`
- `/home/psx/app/wxapp-checkin/backend/README.md`
- `/home/psx/app/wxapp-checkin/docs/plans/2026-02-28-qr-production-hardening.md`
- `https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia`
- `https://webkit.org/blog/7763/a-closer-look-into-webrtc/`
- `https://webkit.org/blog/6784/new-video-policies-for-ios/`
- `https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/JS-SDK.html`
- `https://meomaymap.github.io/html5-qrcode/`
- `https://developer.chrome.com/docs/capabilities/shape-detection`
- `https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility`
- `https://developers.weixin.qq.com/doc/service/guide/h5/adapt_ios.html`
- `https://developers.weixin.qq.com/doc/service/guide/h5/adapt_harmonyos.html`
- `https://developer.apple.com/support/alternative-browser-engines/`
- `https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions`
- `https://developer.mozilla.org/docs/Web/HTML/Reference/Global_attributes/inputmode`
- `https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API`
- `https://developer.mozilla.org/docs/Web/API/Document/visibilityState`
- `https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API`
- `https://web.dev/articles/webauthn-discoverable-credentials`
- `https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/MediaDevices.json`
- `https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/BarcodeDetector.json`
- `https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/PublicKeyCredential.json`
- `https://raw.githubusercontent.com/mdn/browser-compat-data/main/html/global_attributes.json`
- `https://developer.android.com/reference/android/webkit/WebChromeClient`
- `https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/stream.json`
- `https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/passkeys.json`
- `https://gitee.com/openharmony/docs/raw/298422d35d69c30d0ea6ce3b280da4a880e66974/zh-cn/application-dev/web/web-rtc.md`
- `https://gitee.com/openharmony/docs/raw/OpenHarmony-5.0.0-Release/zh-cn/application-dev/faqs/faqs-arkui-web.md`
- `/home/psx/app/wxapp-checkin/docs/REQUIREMENTS.md`
- `/home/psx/app/wxapp-checkin/docs/FUNCTIONAL_SPEC.md`
- `/home/psx/app/wxapp-checkin/docs/API_SPEC.md`
- `/home/psx/app/wxapp-checkin/docs/WEB_DESIGN.md`
- `/home/psx/app/wxapp-checkin/docs/WEB_COMPATIBILITY.md`
- `/home/psx/app/wxapp-checkin/docs/plans/2026-03-09-web-only-migration-implementation-plan.md`

## Visual/Browser Findings
- 代码初查显示现有扫码交互默认依赖小程序原生能力，不包含任何 WebRTC / `getUserMedia` / JS 解码库实现。
- 工作人员展示动态二维码的业务规则主要由后端返回 `rotate_seconds`、`grace_seconds`、`qr_payload` 等字段驱动，业务协议可复用，但前端渲染载体要从小程序页面切到 Web 组件。
- 微信 H5 官方文档显示“扫一扫”能力属于微信 JS-SDK 的一部分，本质上依赖微信容器而不是标准 Web API。
- 标准 Web 路线的摄像头能力依赖 HTTPS 与用户授权；如果页面跑在非安全上下文，浏览器会直接拒绝 `getUserMedia()`。
- 对浏览器覆盖范围应分层看待：
  - 第一层：Safari / Chrome Android / Edge Android / Samsung Internet / 微信内 H5，可作为重点支持对象。
  - 第二层：Firefox Android、Opera Android 等，可争取支持但需验证具体摄像头与解码性能。
  - 第三层：各类内置浏览器 / WebView / HarmonyOS 浏览器，不能只看标准兼容性，必须看宿主是否放开媒体权限。
- 对“尽可能多覆盖”更细的建议分层：
  - 重点支持：iPhone Safari、Chrome Android、Samsung Internet、微信内 H5。
  - 尽力支持：Edge Android、Firefox Android、Chrome iOS / Edge iOS（受 WebKit 限制，行为接近 Safari）。
  - 仅降级支持或需专项验证：App 内 WebView、HarmonyOS 浏览器、HarmonyOS WebView、来源不明的内置浏览器。
- Web 端扫码路线应至少分成两类：普通浏览器使用 HTML5 摄像头流，微信内 H5 优先接微信 JS-SDK。
- iPhone Safari 侧除了权限与 HTTPS，还要处理视频内联播放约束；否则扫码预览层可能退化为全屏视频，交互会明显变差。
- 从官方资料看，不应把 `BarcodeDetector` 当成通用底座；更稳的实现是摄像头流 + 解码库，并把平台原生扫码能力作为可选增强。
- 扩展调研阶段需要补一张“浏览器家族矩阵”：WebKit 家族、Chromium 家族、Firefox 家族、微信内置容器、HarmonyOS/华为浏览器，避免只按品牌名称做兼容性判断。
- iPhone 兼容性分析不应只看 Safari，还要看“是否处于微信 WKWebView 容器中”；对扫码业务而言，这会决定是走标准 Web 相机流还是优先走微信 JS-SDK。
- 鸿蒙微信环境不能仅用 Android 规则判断；应先识别 `OpenHarmony + MicroMessenger`，再用 `wx.checkJsApi` 做运行时能力探测。
- Android “独立浏览器”与“App 内 WebView”要分开看：前者大多可按浏览器兼容矩阵处理，后者需要把宿主是否实现 `onPermissionRequest` 视为一等风险。
- 鸿蒙 / ArkWeb 的官方资料已经证明 WebRTC 和 `getUserMedia` 能力存在，但它们仍走权限声明、动态授权、Web 侧权限请求三段式流程；浏览器产品层面的覆盖承诺仍必须通过真机验证收口。

## 2026-03-09 新需求发现：扫码改为动态 6 位输入码
- 新需求下，“扫码兼容性”从主链路风险降为无关项；真正的主风险改为“Web 身份体系重建 + 6 位码协议设计 + 7.5 秒时窗交互”。
- 现有后端最可复用的是：
  - `ActivityQueryService` 的活动可见性与详情权限；
  - `SessionService` 的业务会话与过期处理；
  - `CheckinConsumeService` 的签到状态流转、重复提交、防重放、计数回流与 outbox；
  - `LegacySyncService` / `OutboxRelayService` 的与 `suda_union` 的读写同步边界。
- 现有后端最需要改造的是：
  - `AuthService` / `WeChatIdentityResolver`：当前完全绑定 `wx.login -> jscode2session`；
  - `QrSessionService` / `QrPayloadCodec`：当前输出的是二维码字符串，不是 6 位数字码；
  - `CheckinConsumeService`：当前消费入参是 `qr_payload`，而非“活动上下文 + 6 位验证码”。
- 若只提交 6 位数字而不带活动上下文，存在多活动并发时的撞码与歧义风险；要么要求先选活动再输码，要么后端维护“当前活动动态码唯一映射”并处理冲突。
- 7.5 秒窗口比现有 `10 秒展示 + 20 秒宽限` 更紧，前端必须显示服务端对齐倒计时，后端必须以服务端时间判定，不能信任浏览器本地时钟。
- 管理员展示页需要考虑前台保活与屏幕常亮，但不能把 `Screen Wake Lock API` 作为强依赖；Safari / 部分容器支持不稳定，需提供显式提示与手动兜底。
- 对手机浏览器 Web 端而言，现有小程序前端几乎不能直接迁移运行：
  - 页面宿主从 `App()/Page()/Component()` 切换为 Web 框架；
  - `wx.request`、`wx.showToast`、`wx.getStorageSync`、`wx.navigateTo`、`wx.onNetworkStatusChange` 全部要换成浏览器实现；
  - `wxml/wxss` 与 `tdesign-miniprogram` 无法直接复用到 H5。
- 可直接迁移或抽取为共享模块的主要是纯规则代码和接口契约：
  - 表单校验；
  - 会话过期识别；
  - 活动分组与状态展示规则；
  - 加密封装思路；
  - 错误码与返回结构约定。

## 2026-03-09 文档审查补充发现：Web 方案文档与旧基线并存
- 经过本轮收口后，当前正式基线已经明确为：
  - `docs/REQUIREMENTS.md`
  - `docs/FUNCTIONAL_SPEC.md`
  - `docs/API_SPEC.md`
- 当前补充文档为：
  - `docs/WEB_DESIGN.md`
  - `docs/WEB_COMPATIBILITY.md`
  - `docs/WEB_MIGRATION_REVIEW.md`
  - `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`
- 当前仍需保留但只作历史/迁移参考的文档为：
  - `frontend/README.md`
  - `backend/README.md`
  - `backend/DB_DATABASE_DEEP_DIVE.md`
  - `backend/TEST_ENV_TESTING.md`
- 这意味着仓库已不再保留“两套并行正式基线”；风险点从“缺少文档”转为“历史说明是否写清、团队是否按新基线实施”。
- 代码侧已能支持“保留后端主干、重建前端”的总体判断：
  - `frontend/` 对 `wx.*` 和 `Page()/App()/Component()` 存在系统性耦合，不能做低成本平移；
  - `backend` 当前鉴权与动作链路仍是微信/二维码中心，需要新接口与新表，但活动、会话、状态流转、同步回写主干可复用；
  - `CheckinConsumeService` 中活动统计仍是读后写更新，共享 6 位码会放大并发冲突风险，设计文档提出的原子化改造是合理且必要的。
- 本轮已补齐的文档资产：
  - `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md`：重写为手机 Web 正式基线；
  - `docs/WEB_DESIGN.md`、`docs/WEB_COMPATIBILITY.md`：保留为设计与兼容性补充文档；
  - `docs/WEB_MIGRATION_REVIEW.md`：明确“计划合理性”“正式基线 / 历史参考边界”“推荐阅读顺序”；
  - `README.md`、`frontend/README.md`、`backend/README.md`、`backend/DB_DATABASE_DEEP_DIVE.md`、`backend/TEST_ENV_TESTING.md`：补充迁移状态说明，避免误读。
- 文档交付层面仍有一个收尾动作：
  - 当前改动必须纳入版本控制，否则新基线仍只是工作区状态，不是仓库正式历史。
- 仍属于“实现前需锁定”的开放项，而不是本轮文档缺失：
  - Passkey `RP ID` / `Origin` / 本地开发域名；
  - Web 会话 TTL 与解绑后的旧会话失效规则；
  - 浏览器绑定唯一性口径（服务端稳定标识 vs 指纹哈希）；
  - 动态码错误尝试的限流维度与阈值。
