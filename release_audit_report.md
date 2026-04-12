# wxapp-checkin 上线前审查报告

日期：2026-04-12

## 1. 项目理解
- 形态：手机端 Web/H5，不是微信小程序。
- 前端：`web/`，React + TypeScript + Vite。
- 后端：`backend-rust/`，Axum + sqlx + MySQL。
- 数据库：单库 `suda_union`，运行期写表只应命中 `suda_activity_apply` 与 `suda_log`。
- 核心链路：账号密码登录 -> 活动列表/详情 -> 普通用户输入 6 位动态码签到/签退 -> staff 发码/名单修正/批量签退 -> 审计日志落库。

## 2. 阻塞结论
当前版本仍存在会导致真实上线事故、错误签到、安全暴露和运维误判的缺陷，不建议直接上线。

## 3. 关键阻塞项
1. 动态码/会话共用同一密钥，且配置层不拒绝占位值，存在完整鉴权绕过面。
2. 文档承诺“活动结束后 30 分钟”窗口，但后端在 `legacy_state=completed` 时直接禁止发码，详情也会关闭 `can_checkin/can_checkout`。
3. 普通用户签到状态机可以把异常态 `check_in=0 && check_out=1` 改写掉，绕过文档要求的 staff 自愈入口。
4. 健康检查不探测数据库，容器可能在数据库已断开时仍显示 `healthy`。
5. staff 前端自愈链路不会复核第二次 roster 回读是否仍异常，却会解除风险阻断。

## 4. 其他高风险项
- 登录接口可枚举账号，限流只按 `student_id`，且审计日志不记真实客户端 IP。
- staff 高风险操作的“先自愈再继续”只存在于前端，不是后端不变量。
- 名单页单人修正没有 in-flight 防重，移动端连点会并发发请求。
- 活动统计和批量签退 SQL 没有统一按报名状态过滤，取消记录若残留签到态会进入统计和批量签退。
- 路由守卫只信本地 token/role，`session_expires_at` 未落地，冷启动会先进入业务壳层。
- nginx 未显式设置 CSP、点击劫持、防嗅探等基础安全头。

## 5. 文档不一致
- `docs/DEPLOYMENT.md` 混写 Docker 单容器与手工 Nginx 子路径验收，命令会互相打架。
- README 与部署手册没有明确写出“仓库不会初始化数据库，必须已有 `suda_union` 与关键表”。
- `docs/API_SPEC.md` 全局写“时间字段统一毫秒戳”，但实际大量响应字段是格式化字符串。
- `docs/REQUIREMENTS.md` 把登录和动态码限流都写成统一 `12/60s`，实现实际是登录 `5/60s`、动态码 `12/60s`。
- `docs/AUDIT_LOG_SPEC.md` 的“不写入日志场景”段落里又写了“登录失败会写日志”。

## 6. 验证结果
- 通过：`cd web && npm test && npm run lint && npm run build && npm run test:e2e`
- 通过：`cd backend-rust && cargo test && cargo clippy --all-targets --all-features -- -D warnings && cargo build --release`

## 7. 最小上线修复顺序
1. 先修密钥配置与密钥拆分，阻止占位值和单密钥复用上线。
2. 修正“结束后 30 分钟窗口”实现，统一文档、详情、发码、验码口径。
3. 把异常签到态收口成后端不变量：普通用户流拒绝脏状态，只允许 staff 修正接口处理。
4. 把健康检查改成 readiness 式 DB 探活。
5. 修正前端自愈成功判定和名单单人修正防重。
6. 补部署文档、数据库前置条件、时间字段说明和限流说明。
