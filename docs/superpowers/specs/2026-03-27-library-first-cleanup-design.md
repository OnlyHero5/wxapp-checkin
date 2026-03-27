# wxapp-checkin 组件库优先与共享辅助收口设计

## 背景

本次修复只处理上一轮审查里已经确认的两个问题：

1. 前端 `ActivityMetaPanel` 虽然底层用了 TDesign `Cell/CellGroup`，但中间又抽了一层项目自有元信息协议，已经开始抹平组件库原生表达能力。
2. 后端多个 service 模块重复维护 `now_millis` 与角色映射辅助函数，形成无业务收益的手写复制。

## 目标

1. 前端继续保留 `ActivityMetaPanel` 作为业务入口，但内部直接使用 TDesign 原生能力，不再维持额外的中转组件协议。
2. 后端把重复的时间与角色辅助逻辑收口到共享服务辅助模块，减少重复实现，同时不改变对外行为。

## 方案

### 前端

- 删除 `ActivityMetaContentGroups` 这层“组装中转层”。
- `ActivityMetaPanel` 内部直接渲染：
  - 标题摘要组
  - 活动信息组
  - 统计组
- “说明”字段改用 TDesign `Cell.description`，而不是继续塞进 `note`。
- 继续保留最小必要的布局胶水，例如 `activity-meta-actions`。

### 后端

- 新增共享服务辅助模块，统一提供：
  - 当前用户角色映射到 `WebRole`
  - 当前毫秒时间戳
- `activity_service`、`attendance_service`、`staff_service` 改为复用该模块。
- 不调整 HTTP 合同、错误码、数据库访问与业务规则。

## 验证

- 前端新增断言：`ActivityMetaPanel` 的说明文案必须通过 TDesign `Cell.description` 渲染。
- 后端新增源代码约束测试：时间与角色辅助逻辑不再分散定义在多个 service 文件中。

## 取舍

- 不删除 `ActivityMetaPanel` 对外 API，避免把页面层重复代码重新散开。
- 不顺手重构更多页面或 service，只收口已确认的问题，控制改动面。
