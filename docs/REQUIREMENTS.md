# 手机 Web 动态验证码签到系统需求文档

文档版本：v2.4
状态：正式基线
更新日期：2026-04-05
项目：`wxapp-checkin`

## 1. 文档目的

定义 `wxapp-checkin` 当前正式产品基线。

当前基线已经收口为：

- 手机浏览器 Web 前端
- Rust 后端
- 唯一数据库 `suda_union`

## 2. 核心边界

- 正式前端：`web/`
- 正式后端：`backend-rust/`
- 正式数据库：`suda_union`

本文档只描述当前正式链路；历史方案、历史目录和一次性迁移路径不再作为当前事实来源。

## 3. 建设目标

- 管理员在手机浏览器展示动态 6 位签到码 / 签退码。
- 普通用户在具体活动页输入 6 位码完成签到 / 签退。
- 登录继续使用 `student_id + password + session_token`。
- 保持 `/api/web/**` 契约稳定，尽量不改前端主链路。

## 4. 数据库约束

- 只允许依赖 `suda_union`。
- 运行期写入只允许命中：
  - `suda_activity_apply`
  - `suda_log`
- 不允许为了新流程修改 `suda_union` 既有业务逻辑。

## 5. 角色定义

- `normal`
- `staff`

## 6. 核心业务规则

- 登录账号固定为 `student_id`。
- 会话鉴权统一使用 `Authorization: Bearer <session_token>`。
- 普通用户只能看到本人相关活动。
- staff 可以看到全部活动并执行管理动作。
- 活动列表支持按标题、地点、描述和 `activity_id` 关键字搜索。
- 动态码规则固定为：
  - 6 位数字码
  - `活动 + 动作 + 10 秒时间片`
  - 同一活动同一动作同一时间片内，所有 staff 看到相同码
- 状态事实来源固定为：
  - 未签到：`check_in=0, check_out=0`
  - 已签到未签退：`check_in=1, check_out=0`
  - 已签退：`check_in=1, check_out=1`
- 一键全部签退只作用于“已签到未签退”。
- staff 修正、一键签退和普通用户签到 / 签退都必须写审计日志。
- staff 管理页与名单页发现异常签退态（`checked_out=true && checked_in=false`）时，必须先通过统一修正接口自动修复，再继续高风险操作。

## 7. 功能需求

### 7.1 认证

- `FR-001` 无有效会话时必须进入登录流程。
- `FR-002` 登录输入字段固定为 `student_id`、`password`。
- `FR-003` 学号不存在时不得登录，并返回 `identity_not_found`。
- `FR-004` 登录成功后必须返回 `session_token`、`session_expires_at`、`role`、`permissions`、`user_profile`。
- `FR-005` 会话失效后必须返回 `session_expired`。

### 7.2 活动

- `FR-006` 普通用户只能看到本人已报名、已签到或已签退的活动。
- `FR-007` staff 可以看到全部活动。
- `FR-008` 活动详情必须返回 `can_checkin`、`can_checkout`。
- `FR-009` 活动详情必须返回个人签到 / 签退时间，以及页面展示所需计数字段。
- `FR-009A` 活动列表必须支持 `keyword` 搜索；搜索范围至少覆盖标题、地点、描述与 `activity_id`。

### 7.3 发码与验码

- `FR-010` staff 可查看签到码和签退码。
- `FR-011` 动态码接口必须返回 `expires_at`、`expires_in_ms`、`server_time_ms`。
- `FR-012` 普通用户通过 `code-consume` 提交签到 / 签退。
- `FR-013` 验码失败必须区分：
  - `invalid_code`
  - `expired`
  - `duplicate`
  - `rate_limited`
  - `forbidden`
- `FR-014` 需要有限流与防重放能力，但正式基线不依赖 Redis。

### 7.4 staff 管理

- `FR-015` roster 必须返回成员名单与当前状态。
- `FR-016` 名单修正继续走统一接口。
- `FR-017` 一键全部签退继续走独立接口。
- `FR-018` staff 动作必须写审计日志。
- `FR-018A` staff 管理页与名单页发现异常签退态时，必须自动调用统一修正接口完成自愈；自愈失败前不得继续发码、批量签退或名单修正。

## 8. 非功能需求

- `NFR-001` 优先压缩常驻内存，适配约 `400M RAM + 1.1G swap` 的服务器。
- `NFR-002` 不允许为了省内存明显牺牲打开页面后的响应速度。
- `NFR-003` 接口字段继续保持 `snake_case`。
- `NFR-004` 业务失败必须返回真实 HTTP 状态码，并继续保持统一 JSON envelope。
- `NFR-005` 系统时间以服务端为准。

## 8.5 安全机制

详细规格见 `docs/SECURITY_SPEC.md`，本节仅概述核心规则。

### 8.5.1 动态码算法

- 签名算法：HMAC-SHA256
- 时间片长度：10 秒
- 码格式：6 位数字（前导补零）
- 签名内容：`web-code:v1|{activity_id}|{action_type}|{slot}`
- 发码窗口：活动开始前 30 分钟到活动结束后 30 分钟

### 8.5.2 会话认证

- 算法：JWT (HS256)
- 默认有效期：7200 秒（2 小时）
- 传递方式：`Authorization: Bearer <session_token>`

### 8.5.3 防重放机制

- 实现：内存级 TTL 缓存（moka）
- TTL：90 秒
- 唯一键：`u:{user_id}:{activity_id}:{action_type}:{slot}`
- 限制：单实例内存级，服务重启或部署多实例时状态不共享

### 8.5.4 限流机制

- 实现：令牌桶算法（governor 库）
- 窗口：60 秒
- 最大错误尝试次数：12 次
- 限流键：`u:{user_id}:{activity_id}`
- 限制：单实例内存级

### 8.5.5 审计日志

详细规格见 `docs/AUDIT_LOG_SPEC.md`。

写入场景：
- 普通用户签到/签退
- staff 名单修正（每人一条 + 汇总一条）
- staff 批量签退（每人一条 + 汇总一条）

## 9. 验收标准

- `AC-001` 登录、活动列表、活动详情、发码、验码、roster、名单修正、批量签退可完整走通。
- `AC-002` 运行期数据库写入只命中：
  - `suda_activity_apply`
  - `suda_log`
- `AC-003` 不再依赖 `wxcheckin_ext` 与 `wx_*` 表。
- `AC-004` 前端可通过 `npm test`、`npm run lint`、`npm run build`。
- `AC-005` Rust 后端可通过 `cargo test` 与 `cargo build --release`。

## 10. 相关文档

| 文档 | 说明 |
|------|------|
| `docs/FUNCTIONAL_SPEC.md` | 功能基线，页面行为与交互规则 |
| `docs/API_SPEC.md` | 接口基线，API 契约与错误码 |
| `docs/SECURITY_SPEC.md` | 安全机制规格，动态码、会话、防重放 |
| `docs/AUDIT_LOG_SPEC.md` | 审计日志规格，写入场景与格式 |
| `docs/DATABASE_SCHEMA.md` | 数据库表结构说明 |
| `docs/DEPLOYMENT.md` | 部署手册 |
| `docs/plans/2026-03-25-rust-api-compat-checklist.md` | Rust 兼容清单 |
