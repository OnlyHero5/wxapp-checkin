# 任务计划

## 当前目标
对 `wxapp-checkin/` 当前正式基线（`web/ + backend-rust/ + docs/`）执行一次面向规范的代码与文档审计：

- 用 `software-architecture` 视角审查前后端代码边界、命名、职责拆分、重复与测试覆盖。
- 用 `senior-pm` 视角审查 README、需求、接口、部署文档之间的口径一致性、验收可执行性与治理信息完整度。
- 找出“不符合仓库规范 / 当前正式基线”的问题，并在 `wxapp-checkin/` 内完成小步收口。
- 验证修改结果，并保证子仓库工作区最终可提交且状态干净。

## 当前阶段
- [completed] 读取适用 skills，确认本次任务采用“先审计、再设计整改、最后验证收口”的流程。
- [completed] 检查 `wxapp-checkin/` 当前分支与工作区状态，确认位于 `web` 分支且工作区干净。
- [completed] 采样前端、后端、文档主入口，整理当前基线问题、风险与整改方案。
- [completed] 与用户确认整改策略后，按优先级实施代码与文档优化。
- [in_progress] 运行验证命令、提交 `wxapp-checkin/` 子仓库并清空工作区。

## 约束
- 只允许改动 `wxapp-checkin/`，不得改 `suda_union/` 与 `suda-gs-ams/` 业务代码。
- 任何产物只能落在 `/home/psx/app/**`。
- 涉及 `wxapp-checkin/` 源码改动时，优先补充中文维护注释，解释业务意图、状态流转、复用边界与维护注意事项。
- 最终需要在 `wxapp-checkin/` 子仓库提交，并保证 `git status --porcelain` 为空。

## 历史背景
- `2026-03-25` 已完成 Rust 后端替换 Java 基线的仓库级切换，本次任务是在该基线之上做规范审计与收口，不回退到旧形态。
