# 任务计划

## 当前目标
在 `wxapp-checkin/` 当前正式基线（`web/ + backend-rust/ + docs/`）上完成活动列表搜索需求的设计落地与验证收口：

- 前端活动列表页增加搜索框，普通用户和工作人员都可用。
- 搜索必须走服务端分页过滤，不允许通过前端一次性拉全量活动做本地搜索。
- 搜索范围覆盖标题、地点、描述、数据库活动 ID 和前端活动 ID。
- 继续保持“能用组件库就用组件库”，禁止手写搜索输入壳、手写空态壳、伪组件化包裹层。
- 顺手消除活动列表服务中的 N+1 用户状态读取问题。
- 完成验证并在 `wxapp-checkin/` 子仓库提交，保持工作区干净。

## 当前阶段
- [completed] 完成需求澄清、方案对比和设计确认。
- [completed] 写入并提交搜索设计文档 `docs/superpowers/specs/2026-03-27-activities-search-design.md`。
- [completed] 生成实现计划并按 TDD 完成前后端实现。
- [completed] 完成前端搜索组件接入、后端分页搜索和批量状态读取。
- [in_progress] 完成记录回写并准备子仓库提交。

## 约束
- 只允许改动 `wxapp-checkin/`，不得改 `suda_union/` 与 `suda-gs-ams/` 业务代码。
- 任何产物只能落在 `/home/psx/app/**`。
- 涉及 `wxapp-checkin/` 源码改动时，优先补充中文维护注释，解释业务意图、状态流转、复用边界与维护注意事项。
- 前端必须优先使用 `tdesign-mobile-react` 现有能力，不能用手写 DOM/CSS 复刻组件库已有功能，也不能做“表面是组件库、实则核心功能仍靠手写”的伪组件化实现。
- 最终需要在 `wxapp-checkin/` 子仓库提交，并保证 `git status --porcelain` 为空。

## 当前实现计划
- 计划文档：`docs/superpowers/plans/2026-03-27-activities-search-implementation.md`
- 执行模式：inline，当前会话直接实现，不额外分派子代理。
