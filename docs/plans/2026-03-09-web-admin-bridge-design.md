# 手机 Web 管理员链路与最小后端支撑设计

文档版本: v1.0
状态: 已确认，进入实现
更新日期: 2026-03-09
项目: `wxapp-checkin`

## 1. 设计目标

- 在不提前进入完整 Passkey 数据模型迁移的前提下，把手机 Web 从“普通用户前半程”推进到“管理员主链路可跑通”的三分之三阶段。
- 前端完成 `T-058 ~ T-070` 为主线：
  - 管理员动态码管理页
  - 一键全部签退
  - 解绑审核页
  - 角色态与路由守卫
- 后端同步补齐当前 Web 前端已经依赖、但尚未真实落地的最小 `/api/web/**` 支撑：
  - `/api/web/activities`
  - `/api/web/activities/{activity_id}`
  - `/api/web/activities/{activity_id}/code-session`
  - `/api/web/activities/{activity_id}/code-consume`
  - `/api/web/staff/activities/{activity_id}/bulk-checkout`
  - `/api/web/unbind-reviews`
  - `/api/web/staff/unbind-reviews`
  - `/api/web/staff/unbind-reviews/{review_id}/approve`
  - `/api/web/staff/unbind-reviews/{review_id}/reject`

## 2. 方案比较

### 方案 A：只补前端管理员页

- 优点：改动面最小，能快速完成 `T-058 ~ T-070`。
- 缺点：前端页面继续悬空，当前已经写出的 `/api/web/activities/**` 依赖仍然没有后端实现。

### 方案 B：前端管理员页 + 最小 Web 后端支撑

- 优点：
  - 与本轮“再推进四分之一”的范围一致；
  - 能把当前普通用户活动链路和新增管理员链路一起接到真实 `/api/web/**`；
  - 不需要现在就进入完整 Passkey/浏览器绑定迁移。
- 缺点：
  - `todo_list` 上会提前完成少量 `M4` 条目；
  - 解绑审核先落最小可用版本，后续仍需接真正浏览器绑定表。

### 方案 C：直接冲到 `T-128`

- 优点：最接近“核心 Web 主链路闭环”。
- 缺点：
  - 会把本轮工作量直接抬到完整后端重构；
  - 明显超出“从一半推进到四分之三”的合理边界；
  - 会撞上 `M0` 中尚未锁口的 Passkey / 解绑策略风险。

## 3. 最终设计

采用方案 B。

### 3.1 前端范围

- 新增 `staff` 与 `review` 模块。
- 会话存储从“只有 `session_token`”升级为“`session_token + role + permissions + user_profile`”。
- 路由层新增：
  - `StaffRoute`
  - `ReviewRoute`
- 现有页面同步修正：
  - `ActivitiesPage` 对 `staff` 不再做普通用户可见性过滤；
  - `ActivityDetailPage` 对 `staff` 展示“进入管理”入口；
  - staff 角色在列表与详情之间形成自然管理入口。

### 3.2 后端范围

- 不实现完整 WebAuthn 和浏览器绑定表。
- 新增最小 Web 控制器和 DTO，把现有主干服务包装成 `/api/web/**` 契约。
- 对动态码采用“服务端按活动 + 动作 + slot 生成 6 位数字码”的新逻辑。
- 旧二维码链路继续保留，避免影响现有小程序兼容接口。

### 3.3 动态码策略

- 管理员页通过 `/api/web/activities/{id}/code-session?action_type=...` 获取：
  - `code`
  - `slot`
  - `expires_at`
  - `expires_in_ms`
  - `server_time_ms`
  - `checkin_count`
  - `checkout_count`
- 普通用户页继续只输入 6 位码，不接触旧 `qr_payload`。
- 验码时优先走新 `code` 契约；若请求里没有 `code`，则继续兼容旧二维码 payload。
- 本轮仍复用活动现有 `rotate_seconds` 配置作为 slot 长度；正式 7.5 秒窗口留待后续口径锁定后统一收口。

### 3.4 批量签退策略

- 仅 `staff` 可调用。
- 目标人群是当前活动下“已签到未签退”的用户。
- 每个受影响用户写：
  - `wx_user_activity_status`
  - `wx_checkin_event`
  - `wx_sync_outbox`
- 活动统计改为走数据库原子调整，避免继续沿用读后写累加。

### 3.5 解绑审核策略

- 本轮新增 `web_unbind_review` 最小表，承载审核列表和审批动作。
- 由于浏览器绑定表尚未落地：
  - 提交申请、查询列表、批准、拒绝先完整可用；
  - “批准后使旧会话失效”本轮落地；
  - “批准后失效具体浏览器绑定”保留到后续 `web_browser_binding` 引入时补全。

## 4. 已知边界

- 不在本轮实现：
  - `T-071 ~ T-099` 的完整 Passkey 数据模型与认证链路
  - `review_admin` 独立角色建模
  - Playwright 与真机兼容验证
  - 删旧与切流
- 当前实现允许 `staff` 同时访问解绑审核页，后续若独立出 `review_admin`，前端路由守卫与后端权限判断再一起收口。

## 5. 组件库依据

- 本轮 Web 交互继续沿用 `tdesign-mobile-react@0.21.2`。
- 已联网核对官方包信息与官方仓库导出，确认可直接使用：
  - `Tabs`
  - `Dialog`
  - `NoticeBar`
  - `Cell`
  - `CellGroup`
  - `List`
  - `Toast`
- 结论：管理员页和审核页优先使用现成组件能力，不再扩散手写交互容器。
