# wxapp-checkin 审查进度

## 2026-04-12
- 已读取工作区约束文件：`../AGENTS.md`、`../CLAUDE.md`。
- 已加载技能：`planning-with-files`、`security-best-practices`、`dispatching-parallel-agents`、`software-architecture`。
- 已完成仓库全量文件枚举。
- 下一步：全量阅读文档并并行拆分前端、后端/部署、文档一致性审查。
- 已完成根目录文档、`docs/**`、部署脚本、Docker/Nginx、前端核心源码、后端核心源码与关键测试阅读。
- 已完成并行子审查：前端移动端 H5、后端/数据库/部署、文档一致性。
- 已执行验证：
  - `web`: `npm test`、`npm run lint`、`npm run build`、`npm run test:e2e`
  - `backend-rust`: `cargo test`、`cargo clippy --all-targets --all-features -- -D warnings`、`cargo build --release`
- 当前进入最终汇总阶段：整理阻塞项、分级表、文档不一致清单与最小上线修复方案。
- 根据用户确认的方案 A，本轮已完成两类行为修复：
  - 动态码窗口不再被 `legacy_state=completed` 提前截断，收口为“开始前 30 分钟到结束后 30 分钟”。
  - 一键全部签退改为覆盖所有有效报名且尚未完成签退的成员，并统一收敛到 `check_in=1 && check_out=1`。
  - 普通用户签到流已拒绝异常 `check_in=0 && check_out=1` 状态，避免用普通签到请求修正脏数据。
- 本轮继续完成三项高风险修复：
  - `/actuator/health` 增加数据库探测，数据库不可用时返回 `503` + `{"status":"DOWN"}`。
  - `ensureRosterConsistency()` 在第二次 roster 回读仍异常时会失败返回，不再把脏状态洗白。
  - 名单页单人修正增加 in-flight 防重，阻止移动端连点并发提交。
- 本轮新增验证：
  - `cargo test`
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `npm run test:e2e`
  - `cargo clippy --all-targets --all-features -- -D warnings`
  - `cargo build --release`
