# wxapp-checkin 审查发现记录

## 结构发现
- 仓库正式结构为 `web/` + `backend-rust/` + `docs/` + `scripts/` + Docker/Nginx 配置。
- 文档集中在 `docs/`，另有根目录 `README.md`、`DESIGN.md`、`changes.md`。
- 后端为 Rust，前端为 React + TypeScript + Vite，存在前后端测试。

## 审查原则
- 不按微信小程序架构判断。
- 不抽样；尽量遍历全仓库代码、文档、脚本与测试。
- 所有结论需落到文件、函数、代码与真实上线风险。

## 已确认高风险问题
- `P0/P1` 文档承诺动态码窗口覆盖“活动结束后 30 分钟”，但后端在 `legacy_state=completed` 时直接禁止发码，详情也会把 `can_checkin/can_checkout` 关死，存在收尾阶段无法正常签退的高风险。
- `P1` `QR_SIGNING_KEY` 同时复用于动态码和 JWT，会把“码伪造”和“会话伪造”绑成同一爆炸半径；配置层又只校验非空，不拒绝占位值。
- `P1` 普通用户签到状态机允许把异常态 `check_in=0 && check_out=1` 直接改写成 `(1,0)`，绕过文档定义的“必须走 staff 统一修正接口”的约束。
- `P1` `/actuator/health` 只返回静态 `UP`，Compose 健康检查又完全依赖它，数据库在启动后断连时会出现容器仍为 `healthy` 的假阳性。
- `P1` staff 前端自愈链路不会复核第二次 roster 回读是否仍为异常态，却会解除风险阻断；脏名单会被前端“洗白”后继续放行发码/批量签退。
- `P1/P2` 名单页单人修正没有 in-flight 防重，移动端连点/弱网重试会并发发出多个修正请求。
- `P1/P2` 登录接口公开区分 `identity_not_found` / `invalid_password` / `account_disabled`，限流只按 `student_id` 维度，没有 IP 维度归因和限流，存在账户枚举与撞库面。
- `P2` staff 高风险接口（发码、批量签退）只靠前端约定“先自愈”，后端本身不检查异常态，API 直调可绕过该约束。
- `P2` 活动统计和批量签退 SQL 没有统一按 `aa.state IN (0,2)` 过滤，取消记录若残留签到态，会进入统计和批量签退，但 roster 页面看不到。
- `P2` 路由守卫只看本地 token/role，`session_expires_at` 正式字段未落地，过期会话和篡改的本地 role 都会先进入业务壳层。
- `P2` Docker/部署文档把容器模式和手工 Nginx 模式混写，且没有明确说明“仓库不会初始化数据库”；新环境部署易被误导。
- `P2/P3` nginx 未显式设置 CSP、X-Frame-Options、Referrer-Policy、X-Content-Type-Options 等基础头，结合 localStorage bearer token，前端防护纵深偏弱。
- `P1/P2` 活动列表与详情统计 SQL 的 `checkin_count` / `checkout_count` 未按 `aa.state IN (0,2)` 过滤，取消报名但残留签到态的记录会污染人数统计，并与 roster / 批量签退口径不一致。
- `P2` 前端登录成功虽然拿到了 `session_expires_at`，但本地会话层完全不持久化也不使用该字段；路由守卫只认 token 存在和本地 role，过期会话与被篡改的本地身份都会先进入业务壳层。
- `P2` nginx 已转发 `X-Real-IP` / `X-Forwarded-For`，但所有审计写入仍固定把 `ip` / `address` 置空，登录失败、签到签退和 staff 操作都无法追溯真实客户端来源。
- `P2/P3` 当前移动端自动化只跑单浏览器 Chromium；缺少 WebKit/iOS Safari / 微信内置浏览器矩阵，移动端 H5 兼容性仍有真实盲区。
- `P2/P3` README / 部署文档把 MySQL 前置条件写成“只需要 suda_union”，但没有明确写出必须预先具备关键表且仓库不会初始化数据库，首次部署很容易误判准备完成。

## 本轮已修复
- 动态码窗口与 `completed` 状态冲突已修复：结束后 30 分钟内不再被 `legacy_state=completed` 提前截断。
- 一键全部签退已改为覆盖所有有效报名且未完成签退的成员，不再只处理“已签到未签退”。
- 普通用户签到流已拒绝异常 `check_in=0 && check_out=1` 状态，详情页也不再给这种脏状态暴露可执行入口。
- `/actuator/health` 已改为带数据库探测的 readiness；数据库不可用时返回 `503` + `{"status":"DOWN"}`。
- staff 自愈回读现在会复核第二次 roster；若仍异常会显式失败并继续保持风险阻断。
- 名单页单人修正已补 in-flight 防重，避免移动端连点并发发出多次修正请求。

## 仍保留未修
- 密钥问题未处理：按用户要求保留现状。
- WebKit / iOS Safari 的自动化验证仍受当前主机缺少系统依赖限制；仓库已补可选 `webkit` Playwright 项目与脚本，但当前环境无法直接执行。

## 本轮已修复
- 登录接口对外已统一收口为 `invalid_credentials`，避免通过 `identity_not_found` / `invalid_password` / `account_disabled` 枚举账号。
- 登录失败限流已扩展为 `student_id + 客户端 IP` 双维度；日志仍保留内部真实失败原因。
- 登录失败、普通用户签到/签退、staff 名单修正、staff 批量签退的审计日志已开始记录代理透传的客户端 IP。
- staff 动态码签发与一键全部签退已在后端补异常态闸门，发现 `check_in=0 && check_out=1` 时会拒绝继续执行高风险动作。
- 活动列表与详情统计 SQL 已统一过滤 `aa.state IN (0,2)`，取消报名残留签到态不再污染统计。
- 前端已落地 `session_expires_at` 本地过期清理；路由守卫和请求层都会在本地先清理过期会话。
- nginx 已补基础安全头：CSP、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`。
- README / 部署 / API / 安全 / 审计 / 数据库 / 兼容清单文档已同步到当前实现口径。

## 验证结果
- `web`: `npm test`、`npm run lint`、`npm run build`、`npm run test:e2e` 全部通过。
- `backend-rust`: `cargo test`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo build --release` 全部通过。
- 静态与动态验证通过只说明“当前版本能跑”，不能抵消上述业务/安全/运维阻塞项。
