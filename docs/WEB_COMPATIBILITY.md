# 手机 Web 端兼容性与移动适配说明

文档版本: v0.2  
状态: 联调基线  
更新日期: 2026-03-10  
项目: `wxapp-checkin`

## 1. 文档目的

本文档定义 `wxapp-checkin` 新手机浏览器 Web 版本的兼容性边界、移动端适配要求与真机验证矩阵。

本文件不描述业务规则本身，业务规则以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/WEB_OVERVIEW_DESIGN.md`、`docs/WEB_DETAIL_DESIGN.md` 为准；本文件只回答两个问题：

- 哪些手机浏览器属于正式支持范围
- 页面必须如何适配主流手机屏幕、键盘、前后台切换与能力差异

当前状态说明：

- 自动化已验证：
  - Web 单测通过
  - Web 构建通过
  - Backend API 集成测试通过
- 尚未形成“已实测真机矩阵”，因此下文浏览器矩阵表示联调与验收目标，不表示所有设备已实机签字通过。

## 2. 兼容策略

### 2.1 产品定位

- 仅面向手机浏览器 Web 使用场景设计。
- 以竖屏单手操作为主，不做桌面优先设计。
- 不再依赖微信小程序运行时。
- 不以 App 内嵌 WebView 作为正式能力基线。

### 2.2 支持分层

- `重点支持`：必须纳入开发联调、回归测试和发布验收。
- `尽力支持`：功能上尽量可用，但允许个别交互细节存在差异。
- `专项验证`：不做先验承诺，必须真机验证后才能对外宣称支持。
- `不承诺`：不作为正式验收对象。

### 2.3 总体原则

- 兼容性以“浏览器家族 + 关键能力”判断，不按品牌名称做模糊承诺。
- 登录、动态码倒计时、签到/签退状态统一以后端时间为准。
- 当前部署基线为 **HTTP + 内网 IP + 端口号**，不再依赖 Passkey/WebAuthn。
- 登录基线为账号密码（默认 `123`，首次登录强制改密），不再需要“Passkey 不支持”的兼容兜底页。
- `Screen Wake Lock API`、`VisualViewport` 等能力可用于增强体验，但不能作为主链路硬依赖。

## 3. 关键能力基线

### 3.1 登录能力

项目登录改为账号密码，不再依赖 WebAuthn/Passkey，因此登录能力基线降为：

- 支持基本表单输入（`<input>`）与安全键盘弹起；
- 支持 `fetch`；
- 支持 `localStorage`（用于持久化 `session_token` 与会话上下文）。

### 3.2 交互能力

- `inputmode="numeric"`：
  - Chrome `66+`
  - Firefox Android `79+`
  - iOS Safari `12.2+`
  - Samsung Internet 跟随 Chromium 家族
- `Page Visibility API`：
  - Chrome `33+`
  - Safari `7+`
  - 各主流移动浏览器家族均已具备
- `Screen Wake Lock API`：
  - 适合作为增强能力
  - 不能作为正式依赖，尤其不能要求 iPhone Safari 必须支持

## 4. 浏览器支持矩阵

| 浏览器家族 | 支持级别 | 准入前提 | 说明 |
| --- | --- | --- | --- |
| iPhone Safari | 重点支持 | iOS 主流版本 | iPhone 主基线，必须完整验证登录、改密、活动、签到、签退、管理员页 |
| iPhone Chrome / Edge | 重点支持 | iOS 主流版本 | iOS 第三方浏览器通常仍受 WebKit 约束，能力边界按 Safari 同类看待 |
| Android Chrome | 重点支持 | Android 主流版本 | Android 主基线 |
| Android Edge | 重点支持 | Android 主流版本 | 核心流程纳入回归 |
| Samsung Internet | 重点支持 | Android 主流版本 | 三星机型覆盖必须单独验收 |
| Firefox Android | 尽力支持 | Android 主流版本 | 应可完成主流程，但不作为第一验收优先级 |
| 微信内普通 H5 | 重点支持 | 宿主内核满足基础 Web 能力 | 不依赖 JS-SDK；按 iOS WebKit / Android Chromium 家族分别验收 |
| HarmonyOS 浏览器 / ArkWeb 浏览器 | 专项验证 | 真机确认键盘、会话恢复行为 | 可参考 Chromium-like 行为，但文档口径必须保守 |
| App 内嵌 WebView / 来源不明浏览器 | 不承诺 | 无 | 宿主权限桥接不透明，不作为正式兼容承诺 |

## 5. 屏幕与布局基线

### 5.1 宽度范围

- `320px - 430px`：正式设计主范围，必须完整可用。
- `431px - 600px`：大屏手机、折叠屏外屏、部分小平板，保持单列布局并适度放大内容容器。
- `> 600px`：不做桌面化改造，仅采用“居中的手机宽容器”展示。

### 5.2 高度与安全区

- 页面必须考虑刘海屏与底部手势条，使用 `env(safe-area-inset-*)` 预留安全区。
- 在键盘弹起后，核心输入区域不得被完全遮挡。
- 管理员动态码页面必须保证：
  - 验证码数字完整可见
  - 倒计时完整可见
  - 切换签到/签退与一键全部签退按钮在单手区域内可点

### 5.3 推荐视觉尺寸基线

- 小屏基线：`320 x 568`
- 主流 Android：`360 x 780`
- 主流 iPhone：`390 x 844`
- 大屏手机：`412 x 915`
- Plus / Pro Max 档：`430 x 932`

上述尺寸用于设计与回归，不代表只支持这些分辨率。

## 6. 移动交互约束

### 6.1 6 位码输入页

- 使用单独的 6 位数字输入组件或单输入框大字号方案。
- 输入控件必须带：
  - `inputmode="numeric"`
  - `pattern="[0-9]*"`
  - `enterkeyhint="done"`
- 不依赖系统短信 OTP 自动填充。
- 输入错误、过期、未报名、重复提交都必须在 1 屏内给出明确提示。

### 6.2 前后台切换

- 浏览器切到后台时，不信任前端定时器精度。
- 页面重新回到前台时，必须立即执行：
  - 会话状态检查
  - 动态码或剩余有效时长重拉
  - 活动统计刷新
- 管理员页和普通用户输入页都必须监听 `visibilitychange`。

### 6.3 倒计时与服务端对时

- 倒计时只用于视觉提示，真正判定以后端为准。
- 首次进入页面时拉取一次 `server_time_ms` 和当前 slot。
- 前端可维护一个短期时间偏移值，但从后台返回前台后必须重算。
- 不允许以前端本地时钟直接决定“码是否有效”。

### 6.4 键盘与视口变化

- 页面滚动容器必须允许键盘弹起时自动滚动到输入区域。
- 如浏览器支持 `VisualViewport`，可用于优化键盘弹起后的布局纠偏。
- 如浏览器不支持 `VisualViewport`，仍要保证通过 `scrollIntoView` 或自然滚动完成输入。

### 6.5 屏幕常亮

- 管理员展示动态码场景可以尝试启用 `Screen Wake Lock API`。
- 若浏览器不支持或授权失败，页面必须给出显式提示：
  - “请关闭自动锁屏或保持屏幕常亮”
- 不得因为 Wake Lock 不可用而阻断管理员核心流程。

## 7. 浏览器家族专项说明

### 7.1 iPhone 浏览器家族

- iPhone Safari 是正式主基线。
- iPhone Chrome / Edge 需按 Safari 同等级验证，因为它们通常共享同一底层引擎约束。
- iPhone 上不要依赖后台定时器稳定性，不要假设屏幕常亮能力一定存在。

### 7.2 Android Chromium 家族

- Android Chrome、Edge、Samsung Internet 是主力覆盖对象。
- Android 侧可把 Wake Lock、较稳定的键盘行为和更丰富的浏览器能力作为增强项，但仍不能写成硬依赖。

### 7.3 微信内 H5

- 本项目目标是“普通 Web 可用”，因此不把微信 JS-SDK 当主链路。
- 微信内 H5 仍需真机验证以下问题：
  - 页面从会话页切回后的 `visibilitychange`
  - 键盘遮挡与滚动行为

### 7.4 HarmonyOS / ArkWeb

- 已有公开资料表明 ArkWeb / OpenHarmony Web 容器具备标准 WebRTC / 媒体能力，但浏览器产品层面的稳定性仍需真机验证。
- 本项目对 HarmonyOS 的正式态度应为：
  - 实现上尽量采用标准 Web API，避免平台私有能力
  - 发布前必须补一轮专项真机回归

## 8. 真机验证矩阵

发布前至少覆盖以下组合：

- iPhone Safari 最新主版本
- iPhone Chrome 最新主版本
- Android Chrome 最新主版本
- Samsung Internet 最新主版本
- Android Edge 最新主版本
- Firefox Android 最新主版本
- iOS 微信内 H5
- Android 微信内 H5
- 1 台 HarmonyOS 设备浏览器或微信内 H5

每个组合至少验证：

- 账号密码登录（默认 `123`）
- 首次登录强制改密
- 活动列表与活动详情
- 输入签到码成功
- 输入签退码成功
- 码过期失败
- 管理员展示签到码
- 管理员展示签退码
- 管理员一键全部签退
- 前后台切换恢复

## 9. 明确不承诺的范围

- 微信小程序旧运行时
- 桌面浏览器最佳体验
- 老旧 Android 浏览器
- 来源不明的 App 内嵌浏览器
- 禁止 `localStorage` 或不允许持久化存储的环境（无法稳定保持会话）

## 10. 参考资料

以下资料于 2026-03-09 核验：

- MDN `inputmode`  
  https://developer.mozilla.org/docs/Web/HTML/Reference/Global_attributes/inputmode
- MDN `Document.visibilityState`  
  https://developer.mozilla.org/docs/Web/API/Document/visibilityState
- MDN `Screen Wake Lock API`  
  https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- Apple alternative browser engines policy  
  https://developer.apple.com/support/alternative-browser-engines/
- OpenHarmony WebRTC / Web 组件资料  
  https://gitee.com/openharmony/docs/raw/298422d35d69c30d0ea6ce3b280da4a880e66974/zh-cn/application-dev/web/web-rtc.md
