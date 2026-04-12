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

## 本轮已修复
- 动态码窗口与 `completed` 状态冲突已修复：结束后 30 分钟内不再被 `legacy_state=completed` 提前截断。
- 一键全部签退已改为覆盖所有有效报名且未完成签退的成员，不再只处理“已签到未签退”。
- 普通用户签到流已拒绝异常 `check_in=0 && check_out=1` 状态，详情页也不再给这种脏状态暴露可执行入口。
- `/actuator/health` 已改为带数据库探测的 readiness；数据库不可用时返回 `503` + `{"status":"DOWN"}`。
- staff 自愈回读现在会复核第二次 roster；若仍异常会显式失败并继续保持风险阻断。
- 名单页单人修正已补 in-flight 防重，避免移动端连点并发发出多次修正请求。

## 仍保留未修
- 密钥问题未处理：按用户要求保留现状。
- 登录枚举/IP 归因/基础安全响应头等问题未处理。

## 验证结果
- `web`: `npm test`、`npm run lint`、`npm run build`、`npm run test:e2e` 全部通过。
- `backend-rust`: `cargo test`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo build --release` 全部通过。
- 静态与动态验证通过只说明“当前版本能跑”，不能抵消上述业务/安全/运维阻塞项。
