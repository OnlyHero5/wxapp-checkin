# wxapp-checkin/backend 数据库深度说明（双库联调版）

## 1. 文档目标与范围

本文档聚焦 `wxapp-checkin/backend` 的数据库实现细节，覆盖：

- 双库架构（`wxcheckin_ext` + `suda_union`）和配置优先级
- 表结构、字段语义、索引/外键、迁移演进
- 每个核心 API/定时任务对数据库的读写路径
- 与 `suda_union` 的 ID 映射、状态映射、最终一致性机制
- 本地三项目联调（非 Docker）下的数据库排障与核验 SQL

不覆盖：前端 UI 逻辑、微信小程序端页面交互细节。

## 2. 一句话结论（务必先看）

- `wxapp-checkin/backend` 不是单库应用，而是“双库 + 异步回写”模型。
- 业务主写库是 `wxcheckin_ext`（扩展域）；遗留业务事实来源是 `suda_union`（legacy）。
- 三项目联调时，`LEGACY_DB_URL` 必须显式指向 `suda_union`，不能留空，否则会回落到主库导致“伪联调”。
- 签退语义以代码与联调结果为准：`suda_activity_apply.check_out = 1` 表示“已签退”。

## 3. 总体架构

## 3.1 存储组件与职责

| 组件 | 库/实例 | 作用 |
|---|---|---|
| MySQL 主库 | `wxcheckin_ext` | 小程序扩展域：用户绑定、会话、活动投影、签到事件、防重、outbox |
| MySQL 遗留库 | `suda_union` | 管理系统遗留域：活动、报名、用户；供 pull 同步与 outbox 回写 |
| Redis | `REDIS_HOST:REDIS_PORT` | 运行期缓存/基础依赖（非本文重点） |

## 3.2 数据流方向

1. `legacy pull`（定时任务）：`suda_union` -> `wxcheckin_ext`
2. 小程序业务写入：`wxcheckin_ext`（事务内写状态、事件、outbox）
3. `outbox relay`（定时任务）：`wxcheckin_ext.wx_sync_outbox` -> `suda_union.suda_activity_apply`

这是典型“读模型拉取 + 事务 outbox 回写”的最终一致性方案。

## 3.3 ID 与实体映射

- 用户映射
  - legacy：`suda_user.id`（int）
  - ext：`wx_user_auth_ext.id`（bigint）
  - 桥接字段：`wx_user_auth_ext.legacy_user_id`
- 活动映射
  - legacy：`suda_activity.id`（int）
  - ext：`wx_activity_projection.activity_id`（varchar），格式：`legacy_act_<legacy_id>`
  - 桥接字段：`wx_activity_projection.legacy_activity_id`

## 4. 配置与连接规则

## 4.1 主数据源（扩展库）

来源：`src/main/resources/application.yml`

- `spring.datasource.url=jdbc:mysql://${DB_HOST}:${DB_PORT}/${DB_NAME:wxcheckin_ext}...`
- `spring.datasource.username=${DB_USER}`
- `spring.datasource.password=${DB_PASSWORD}`

默认主库是 `wxcheckin_ext`。

## 4.2 legacy JDBC 数据源（遗留库）

来源：`app.legacy.datasource.*` + `LegacyJdbcTemplateConfiguration`

- `app.legacy.datasource.url` <- `LEGACY_DB_URL`
- `app.legacy.datasource.username` <- `LEGACY_DB_USER`
- `app.legacy.datasource.password` <- `LEGACY_DB_PASSWORD`

`legacyJdbcTemplate` 规则：

1. 若 `LEGACY_DB_URL` 非空：使用独立 `DriverManagerDataSource` 访问遗留库
2. 若 `LEGACY_DB_URL` 为空：退化为复用主数据源（高风险，仅限某些本地场景）

因此在三项目联调里必须设置 `LEGACY_DB_URL=.../suda_union`。

## 4.3 Profile 行为差异

- `dev`
  - `spring.jpa.show-sql=true`
  - Flyway 默认开启
- `prod`
  - `spring.jpa.hibernate.ddl-auto=none`
  - `spring.flyway.enabled=false`（生产通常用 `scripts/bootstrap-prod-schema.sql` 预建表）
  - 默认启用双向同步（legacy pull + outbox relay）

## 4.4 生产安全保护（硬校验）

`ProductionDatabaseSafetyGuard` 在 `prod` 启动时强制校验：

1. 主数据源禁止指向 `suda_union`
2. `LEGACY_DB_URL` 必须配置且必须指向 `suda_union`
3. 必须开启双向同步：
   - `LEGACY_SYNC_ENABLED=true`
   - `OUTBOX_RELAY_ENABLED=true`

任一不满足会直接抛异常阻止启动。

## 4.5 关键环境变量速查

| 变量 | 作用 | 推荐值（本地三项目联调） |
|---|---|---|
| `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD` | 主库连接 | `127.0.0.1/3307/wxcheckin_ext/...` |
| `LEGACY_DB_URL/LEGACY_DB_USER/LEGACY_DB_PASSWORD` | 遗留库连接 | 指向 `127.0.0.1:3307/suda_union` |
| `LEGACY_SYNC_ENABLED` | 启用 pull 同步 | `true` |
| `OUTBOX_RELAY_ENABLED` | 启用 outbox 回写 | `true` |
| `LEGACY_SYNC_INTERVAL_MS` | pull 间隔 | `2000`（联调建议） |
| `OUTBOX_RELAY_INTERVAL_MS` | relay 间隔 | `2000`（联调建议） |
| `APP_SYNC_SCHEDULER_ENABLED` | 总调度开关（条件注解） | `true` |
| `APP_SESSION_CLEANUP_ENABLED` | 会话清理任务开关 | `true` |

## 5. Schema 迁移演进（Flyway）

迁移目录：`src/main/resources/db/migration`

| 版本 | 文件 | 变更 |
|---|---|---|
| V1 | `V1__baseline_extension_schema.sql` | 创建 8 张核心扩展表 + 初始示例数据 |
| V2 | `V2__add_sync_outbox.sql` | 新增 `wx_sync_outbox` |
| V3 | `V3__add_support_checkin.sql` | `wx_activity_projection` 增加 `support_checkin` |
| V4 | `V4__add_end_time_to_activity_projection.sql` | `wx_activity_projection` 增加 `end_time` 并回填 |

生产若禁用 Flyway，则需执行 `scripts/bootstrap-prod-schema.sql`（其结构包含 V4 后字段）。

## 6. 扩展库 `wxcheckin_ext`：完整表说明

以下字段定义以当前运行库 `SHOW CREATE TABLE` 为准。

## 6.1 `wx_user_auth_ext`

作用：微信身份与学号绑定主表，承载角色、权限、legacy 用户映射。

主键/唯一：

- PK：`id`
- UK：`wx_identity`
- UK：`student_id`（允许多个 NULL，但非空必须唯一）

关键字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint | 扩展域用户主键 |
| `legacy_user_id` | bigint | 指向 `suda_user.id` 的桥接值 |
| `wx_identity` | varchar(128) | 微信身份（openid 或等价唯一标识） |
| `student_id` | varchar(32) | 学号 |
| `name` | varchar(64) | 姓名 |
| `department` | varchar(128) | 部门 |
| `club` | varchar(128) | 社团 |
| `role_code` | varchar(16) | `normal`/`staff` |
| `permissions_json` | text | 权限快照（JSON 数组字符串） |
| `registered` | tinyint(1) | 是否完成绑定 |
| `created_at/updated_at` | datetime(3) | 审计时间 |

读写来源：

- 写：`AuthService`（首次登录建用户），`RegistrationService`（绑定信息、角色）
- 读：几乎所有鉴权与业务服务

## 6.2 `wx_admin_roster`

作用：staff 白名单（学号+姓名）。

- UK：`(student_id, name)`
- `active=1` 表示有效白名单

读写来源：

- 读：`RegistrationService.existsByStudentIdAndNameAndActiveTrue`
- 写：通常手工运维 SQL/初始化脚本

## 6.3 `wx_session`

作用：后端会话表，`session_token` 为业务鉴权票据。

索引：

- UK：`session_token`
- IDX：`user_id`
- IDX：`expires_at`

读写来源：

- 写：`AuthService` 创建会话；`SessionService.touch` 更新时间；`RegistrationService` 更新角色快照
- 读：`SessionService.requirePrincipal`
- 清理：`SessionMaintenanceJob` 每 5 分钟删除过期会话

## 6.4 `wx_activity_projection`

作用：活动读模型表，给小程序直读，不直接耦合 legacy 表。

主键：`activity_id`（如 `legacy_act_101`）

关键字段：

| 字段 | 说明 |
|---|---|
| `legacy_activity_id` | 对应 `suda_activity.id` |
| `activity_title/activity_type/location/description` | 展示字段 |
| `start_time/end_time` | 活动时段（用于发码时间窗校验） |
| `progress_status` | `ongoing` / `completed` |
| `support_checkin/support_checkout` | 功能开关 |
| `checkin_count/checkout_count` | 投影统计 |
| `rotate_seconds/grace_seconds` | 二维码滚动参数 |
| `active` | 逻辑可见性 |

索引：`start_time`、`progress_status`、`legacy_activity_id`

读写来源：

- 写：`LegacySyncService`（主同步来源），`CheckinConsumeService`（统计更新），`QrSessionService`（时间回填）
- 读：`ActivityQueryService`、`CompatibilityController.currentActivity`、`RecordQueryService`

## 6.5 `wx_user_activity_status`

作用：用户-活动维度状态（报名/签到/签退）。

约束：

- UK：`(user_id, activity_id)`
- FK：`user_id -> wx_user_auth_ext.id`
- FK：`activity_id -> wx_activity_projection.activity_id`

关键字段：

- `registered`：是否报名
- `status`：`none` / `checked_in` / `checked_out`

读写来源：

- 写：`LegacySyncService`（从 legacy 报名状态映射）、`CheckinConsumeService`（扫码状态机更新）
- 读：`ActivityQueryService`、`CheckinConsumeService`（加锁读取）

并发控制：

- `lockByUserIdAndActivityId` 使用悲观写锁，避免并发重复扫码导致状态错乱。

## 6.6 `wx_checkin_event`

作用：签到/签退不可变事件流水。

主键：`record_id`

关键字段：

- `action_type`: `checkin` / `checkout`
- `slot`, `nonce`: 与二维码时段和随机数绑定
- `in_grace_window`: 是否在宽限期内提交
- `submitted_at`, `server_time`, `qr_payload`: 审计追溯

读写来源：

- 写：`CheckinConsumeService`
- 读：`RecordQueryService`

## 6.7 `wx_qr_issue_log`

作用：工作人员发码审计与扫码合法性校验依据。

索引：

- `idx_wx_qr_issue_log_payload`（按二维码字符串快速回查）
- `idx_wx_qr_issue_log_slot`（按活动+动作+时段核验）

读写来源：

- 写：`QrSessionService.issue`
- 读：`CheckinConsumeService`（校验二维码确实由 staff 发出）

## 6.8 `wx_replay_guard`

作用：抗重放表，确保同用户同活动同动作同 slot 只处理一次。

约束：

- UK：`(user_id, activity_id, action_type, slot)`

读写来源：

- 写：`CheckinConsumeService.acquireReplayGuard`
- 重复提交时触发唯一约束异常并转业务错误 `duplicate`

## 6.9 `wx_sync_outbox`

作用：本域事务 outbox，承载待回写 legacy 的事件。

关键字段：

| 字段 | 说明 |
|---|---|
| `aggregate_type` | 当前固定 `checkin_event` |
| `aggregate_id` | 对应 `record_id` |
| `event_type` | 当前固定 `CHECKIN_CONSUMED` |
| `payload_json` | 包含 user_id/activity_id/action_type/slot/nonce 等 |
| `status` | `pending/processed/failed/skipped` |
| `available_at` | 可投递时间 |
| `processed_at` | 实际处理时间 |

索引：

- `(status, available_at)`：调度扫描
- `(aggregate_type, aggregate_id)`：按聚合回查

读写来源：

- 写：`CheckinConsumeService`（入队）、`OutboxRelayService`（更新状态）
- 读：`OutboxRelayService.findTop100ByStatusAndAvailableAtLessThanEqualOrderByIdAsc`

## 7. 遗留库 `suda_union` 依赖面（wxapp-checkin 视角）

`wxapp-checkin/backend` 只直接依赖 3 张 legacy 表：

- `suda_user`
- `suda_activity`
- `suda_activity_apply`

## 7.1 读取依赖字段

### `suda_user`

- `id`（桥接到 `legacy_user_id`）
- `username`（学号）
- `name`（姓名）
- `role`（0-3 视作 staff）

### `suda_activity`

- `id`
- `name`
- `description`
- `location`
- `activity_stime`
- `activity_etime`
- `type`
- `state`

### `suda_activity_apply`

- `activity_id`
- `username`
- `state`
- `check_in`
- `check_out`

## 7.2 写入依赖字段

仅 `OutboxRelayService` 会写 `suda_activity_apply`：

- checkin：`check_in=1, check_out=0`
- checkout：`check_in=1, check_out=1`

## 7.3 关于 `check_out` 语义的重要说明

虽然 SQL 注释里存在“`0:已签退/1:未签退`”描述，但当前联调代码与行为统一按下述语义：

- `check_out=1` -> 已签退
- `check_out=0` -> 未签退

`LegacySyncService` 和 `OutboxRelayService` 已按此语义实现。

## 8. 核心业务流程与读写路径

## 8.1 A-01 微信登录 `/api/auth/wx-login`

1. 解析微信身份（`wx_identity`）
2. `wx_user_auth_ext`：按 `wx_identity` 查找，不存在则插入
3. 若权限为空，回写默认权限
4. 新建 `wx_session`

写表：`wx_user_auth_ext`, `wx_session`

## 8.2 A-02 绑定注册 `/api/register`

1. 校验 session
2. 校验 payload 完整性（非 DB 逻辑）
3. `wx_user_auth_ext` 按 `student_id` 做唯一绑定冲突检查
4. staff 判定：
   - `wx_admin_roster` 命中，或
   - legacy `suda_user.role` 在 0..3 且姓名匹配
5. 更新 `wx_user_auth_ext` 绑定字段、角色、权限
6. 更新当前 `wx_session` 角色快照

读表：`wx_user_auth_ext`, `wx_admin_roster`, `suda_user`, `wx_session`
写表：`wx_user_auth_ext`, `wx_session`

## 8.3 legacy pull（定时）

任务：`LegacySyncService.syncFromLegacy()`

- 同步活动：`suda_activity + suda_activity_apply 聚合` -> `wx_activity_projection`
- 同步用户活动状态：`suda_activity_apply + suda_user` -> `wx_user_activity_status`

说明：

- 失败容错：捕获 `DataAccessException` 后 debug 记录并跳过本轮
- 仅在 `LEGACY_SYNC_ENABLED=true` 时执行业务逻辑

## 8.4 A-05 staff 发码 `/api/staff/activities/{activityId}/qr-session`

1. 校验 staff 权限
2. 读取 `wx_activity_projection` 活动信息
3. 校验活动时间窗（必要时回查 `suda_activity` 并回填 start/end）
4. 写 `wx_qr_issue_log`

读表：`wx_activity_projection`, `suda_activity`（必要时）
写表：`wx_qr_issue_log`, `wx_activity_projection`（可能更新时段）

## 8.5 A-06 普通用户扫码 `/api/checkin/consume`

单事务内关键步骤：

1. 校验二维码合法性（`wx_qr_issue_log`）
2. 防重放（尝试插入 `wx_replay_guard`）
3. 锁定并更新 `wx_user_activity_status`
4. 更新 `wx_activity_projection` 统计
5. 写事件 `wx_checkin_event`
6. 写 outbox `wx_sync_outbox(status=pending)`

此阶段不直接写 legacy。

## 8.6 outbox relay（定时）

任务：`OutboxRelayService.relayToLegacy()`

1. 取 `wx_sync_outbox` 中 `pending` 事件
2. 通过 `wx_user_auth_ext.legacy_user_id` + `wx_activity_projection.legacy_activity_id` 找到 legacy 目标
3. 更新 `suda_activity_apply.check_in/check_out`
4. 回写 outbox 状态：`processed/failed/skipped`

## 8.7 查询 API

- 活动列表/详情：`wx_activity_projection + wx_user_activity_status`
- 签到记录：`wx_checkin_event`（关联活动标题用 `wx_activity_projection`）

## 9. 状态机与映射规则

## 9.1 用户活动状态（ext）

- `none`
- `checked_in`
- `checked_out`

`CheckinConsumeService` 约束：

- `none -> checked_in` 合法
- `checked_in -> checked_out` 合法
- 其他跳转抛业务异常（重复/越权）

## 9.2 legacy 报名状态到 ext 注册态

`LegacySyncService` 当前规则：

- `apply_state != 3` -> `registered=true`
- `apply_state == 3` -> `registered=false`

## 9.3 legacy `type/state` 到投影

- `type=1` -> `activity_type=讲座`，否则 `活动`
- `state>=4` -> `progress_status=completed`，否则 `ongoing`

## 10. 一致性模型与时序

这是“本地事务 + 异步回写”的最终一致性模型：

1. 用户扫码成功后，`wxcheckin_ext` 内部立即一致
2. legacy 写回依赖 outbox 调度周期
3. 因此短时间内可能出现：
   - 小程序侧状态已更新
   - 管理后台（读 legacy）稍后才看到变更

可通过降低 `OUTBOX_RELAY_INTERVAL_MS` 缩短窗口。

## 11. 联调与排障 SQL（本地三项目）

## 11.1 确认正在使用真实 legacy 库

```sql
-- 在 wxapp-checkin 日志里应能看到以下 SQL 关键词：
-- FROM suda_activity
-- JOIN suda_user
-- UPDATE suda_activity_apply
```

同时检查环境变量：

```bash
LEGACY_DB_URL=jdbc:mysql://127.0.0.1:3307/suda_union?... 
```

## 11.2 查看 outbox 堆积

```sql
SELECT status, COUNT(*)
FROM wxcheckin_ext.wx_sync_outbox
GROUP BY status;

SELECT id, aggregate_id, status, available_at, processed_at
FROM wxcheckin_ext.wx_sync_outbox
ORDER BY id DESC
LIMIT 20;
```

## 11.3 校验某次签到是否已回写 legacy

```sql
-- ext 事件流水
SELECT record_id, user_id, activity_id, action_type, submitted_at
FROM wxcheckin_ext.wx_checkin_event
ORDER BY submitted_at DESC
LIMIT 20;

-- legacy 报名状态
SELECT activity_id, username, check_in, check_out, state
FROM suda_union.suda_activity_apply
WHERE username = '2025000007'
ORDER BY id DESC;
```

## 11.4 检查用户绑定冲突

```sql
SELECT id, wx_identity, student_id, name, role_code, registered, legacy_user_id
FROM wxcheckin_ext.wx_user_auth_ext
WHERE student_id = '2025000007' OR wx_identity = 'your_wx_identity';
```

## 11.5 清理某学号的微信绑定（用于重复测试）

```sql
-- 1) 找到 user_id
SELECT id FROM wxcheckin_ext.wx_user_auth_ext WHERE student_id='2025000007';

-- 2) 按 user_id 清理关联数据（示例 user_id=12）
DELETE FROM wxcheckin_ext.wx_session WHERE user_id=12;
DELETE FROM wxcheckin_ext.wx_user_activity_status WHERE user_id=12;
DELETE FROM wxcheckin_ext.wx_checkin_event WHERE user_id=12;
DELETE FROM wxcheckin_ext.wx_replay_guard WHERE user_id=12;
DELETE FROM wxcheckin_ext.wx_qr_issue_log WHERE issued_by_user_id=12;

-- 3) 清空绑定字段（保留微信身份行）
UPDATE wxcheckin_ext.wx_user_auth_ext
SET student_id=NULL,
    name=NULL,
    department=NULL,
    club=NULL,
    role_code='normal',
    permissions_json='[]',
    registered=0,
    legacy_user_id=NULL
WHERE id=12;
```

## 11.6 完全删除用户绑定行（谨慎）

```sql
DELETE FROM wxcheckin_ext.wx_user_auth_ext WHERE id=12;
```

删除前必须先清理外键引用表。

## 12. 常见问题与根因

## 12.1 `localhost:5173/500` 或 `/api/suda_login` 500

常见根因：`suda_union` 库结构漂移，缺少 `suda_user`/`suda_activity` 关键字段。

处理：用上传的 `suda_union (1).sql` 重建 `suda_union`，再执行本地 seed。

## 12.2 注册报 `student_already_bound`

根因：`wx_user_auth_ext.student_id` 唯一约束命中。

处理：按上文“清理绑定”SQL 重置目标学号绑定。

## 12.3 outbox 长期 `failed`

常见根因：

- `legacy_user_id` 或 `legacy_activity_id` 缺失（会 `skipped`）
- `LEGACY_DB_URL` 配置错误
- legacy 表权限不足或字段不匹配

## 12.4 看不到 legacy 同步效果

检查项：

- `LEGACY_SYNC_ENABLED=true`
- `OUTBOX_RELAY_ENABLED=true`
- `APP_SYNC_SCHEDULER_ENABLED` 未被关闭
- 日志级别是否允许看到 debug SQL（dev 下默认更明显）

## 13. 三项目本地联调（非 Docker）数据库基线

当前联调约定：

- MySQL: `127.0.0.1:3307`
- Redis: `127.0.0.1:16379`
- `suda_union`: `8088`
- `suda-gs-ams`: `5173`
- `wxapp-checkin/backend`: `9989`

启动/停止建议使用：

- `local_dev/scripts/stop_3_projects_integration.sh`
- `local_dev/scripts/start_3_projects_integration.sh`

若在某些终端托管环境里后台进程会被自动回收，使用 3 个独立 TTY 会话分别常驻启动三项目。

## 14. 最小核验清单

每次改配置后至少核验：

1. 三端口监听：`5173/8088/9989`
2. `POST /api/suda_login` 返回 `code=200`
3. `POST /api/menuList` 返回 `code=200`
4. `wxapp-checkin` 日志出现 legacy SQL（`FROM suda_activity`、`JOIN suda_user`）
5. 扫码后 `wx_sync_outbox` 从 `pending` 进入 `processed`，且 `suda_activity_apply.check_in/check_out` 变化符合预期

---

如需进一步扩展（分库分表、binlog CDC 替代 pull/outbox、只读副本、脱敏审计），建议在本文件基础上新增“架构演进”章节，保留当前字段与流程定义作为兼容基线。
