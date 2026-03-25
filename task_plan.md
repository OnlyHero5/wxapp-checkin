# 任务计划

## 目标
根据 `/home/psx/app/docs/plans/2026-03-25-wxapp-checkin-rust-suda-union-design.md` 与 `/home/psx/app/docs/plans/2026-03-25-wxapp-checkin-rust-suda-union-implementation.md`，在 `wxapp-checkin` 内落地新的 `backend-rust/`：

- 用 Rust 重写正式后端
- 正式链路只依赖 `suda_union`
- 保持 `/api/web/**` 9 个端点契约兼容
- 数据库写入只允许 `suda_activity_apply`、`suda_log`、`suda_user.password`
- 尽量压缩常驻内存与连接池占用

## 阶段
- [completed] 建立隔离 worktree、校验现有基线、补齐 Rust 工具链
- [completed] 冻结 API 兼容清单与数据库写入白名单
- [completed] 建立 `backend-rust/` 骨架、配置层、错误层与统一 JSON envelope
- [completed] 实现认证、活动查询、动态码、签到签退与 staff 管理
- [pending] 补齐脚本、文档与前端必要收口
- [in_progress] 完成联调验证、提交子仓库并清空工作区

## 约束
- 只允许改动 `wxapp-checkin/`，不得改 `suda_union/` 与 `suda-gs-ams/` 业务代码。
- 新增 Rust 代码必须补中文维护注释，解释业务意图、状态流转与维护边界。
- 任何产物只能落在 `/home/psx/app/**`。
- 最终需要在 `wxapp-checkin/` 子仓库提交，并保证 `git status --porcelain` 为空。
