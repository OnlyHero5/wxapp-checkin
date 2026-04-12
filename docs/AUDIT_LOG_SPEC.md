# 审计日志规格说明

文档版本：v1.2
状态：正式基线
更新日期：2026-04-12
项目：`wxapp-checkin`

## 1. 概述

本文档定义 `wxapp-checkin` 项目的审计日志（`suda_log` 表）的写入场景、数据格式和查询方式。

审计日志承担两类职责：
1. **普通用户签到流水**：记录所有签到/签退操作
2. **staff 审计**：记录所有管理操作

---

## 2. 表结构

```sql
CREATE TABLE suda_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(20) NOT NULL COMMENT '操作人学号',
  name VARCHAR(255) NOT NULL COMMENT '操作人姓名',
  path VARCHAR(255) NOT NULL COMMENT 'API 路径',
  content TEXT NOT NULL COMMENT 'JSON 格式操作详情',
  ip VARCHAR(45) DEFAULT '' COMMENT '客户端 IP',
  address VARCHAR(255) DEFAULT '' COMMENT '地址',
  time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'MySQL 写入时间'
);
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `BIGINT` | 自动 | 自增主键 |
| `username` | `VARCHAR(20)` | 是 | 操作人学号 |
| `name` | `VARCHAR(255)` | 是 | 操作人姓名 |
| `path` | `VARCHAR(255)` | 是 | API 路径（见下文） |
| `content` | `TEXT` | 是 | JSON 格式的操作详情 |
| `ip` | `VARCHAR(45)` | 否 | 客户端 IP（当前通过反向代理头提取） |
| `address` | `VARCHAR(255)` | 否 | 地址（当前实现仍传空） |
| `time` | `TIMESTAMP` | 自动 | MySQL 写入时间；应用读取时会固定会话时区为 `+08:00` |

---

## 3. 写入场景

### 3.1 写入触发点总览

| 场景 | 触发接口 | path 值 | 操作人 |
|------|----------|---------|--------|
| 登录失败 | `POST /api/web/auth/login` | `/api/web/auth/login` | 本次尝试的 `student_id`（姓名未知时为空） |
| 普通用户签到 | `POST /api/web/activities/{id}/code-consume` | `/api/web/attendance/checkin` | 签到用户本人 |
| 普通用户签退 | `POST /api/web/activities/{id}/code-consume` | `/api/web/attendance/checkout` | 签退用户本人 |
| staff 名单修正（每人） | `POST /api/web/staff/activities/{id}/attendance-adjustments` | `/api/web/staff/attendance-adjustment` | 被修正用户 |
| staff 名单修正（汇总） | `POST /api/web/staff/activities/{id}/attendance-adjustments` | `/api/web/staff/attendance-adjustment` | 操作的 staff |
| staff 批量签退（每人） | `POST /api/web/staff/activities/{id}/bulk-checkout` | `/api/web/staff/bulk-checkout` | 被签退用户 |
| staff 批量签退（汇总） | `POST /api/web/staff/activities/{id}/bulk-checkout` | `/api/web/staff/bulk-checkout` | 操作的 staff |

### 3.2 不写入日志的场景

| 场景 | 原因 |
|------|------|
| 登录成功 | 当前实现不写日志 |
| 活动列表查询 | 只读操作 |
| 活动详情查询 | 只读操作 |
| 动态码获取 | 只读操作 |
| 名单查询 | 只读操作 |

---

## 4. content JSON 格式

### 4.1 普通用户签到/签退

**触发条件**：普通用户通过动态码完成签到或签退

**代码位置**：`backend-rust/src/service/attendance_service/audit.rs`

```json
{
  "activity_id": "legacy_act_101",
  "legacy_activity_numeric_id": 101,
  "student_id": "2025000007",
  "user_id": 7,
  "action_type": "checkin",
  "server_time_ms": 1760000004300,
  "record_id": "rec_xxx",
  "source": "wxapp-checkin-rust"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `activity_id` | `string` | 对外活动ID（格式：`legacy_act_{id}`） |
| `legacy_activity_numeric_id` | `number` | 原始数字活动ID |
| `student_id` | `string` | 操作人学号 |
| `user_id` | `number` | 操作人用户ID |
| `action_type` | `string` | 动作类型：`checkin` 或 `checkout` |
| `server_time_ms` | `number` | 服务端时间戳（毫秒） |
| `record_id` | `string` | 记录唯一标识（来自 API 响应） |
| `source` | `string` | 来源标识，固定为 `wxapp-checkin-rust` |

### 4.2 staff 名单修正（单人记录）

**触发条件**：staff 修正一个或多个成员的签到/签退状态

**代码位置**：`backend-rust/src/service/staff_service/audit.rs`

每个被修正的用户会产生一条日志，`username` 和 `name` 为被修正用户的信息。

```json
{
  "activity_id": "legacy_act_101",
  "legacy_activity_numeric_id": 101,
  "student_id": "2025000007",
  "user_id": 7,
  "action_type": "checkin",
  "server_time_ms": 1760000005000,
  "record_id": "adj_1760000005000_7_1760000005000",
  "operator_student_id": "2025000001",
  "reason": "批量设为已签到",
  "check_in": 1,
  "check_out": 0,
  "source": "wxapp-checkin-rust"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `activity_id` | `string` | 对外活动ID |
| `legacy_activity_numeric_id` | `number` | 原始数字活动ID |
| `student_id` | `string` | **被修正用户**的学号 |
| `user_id` | `number` | **被修正用户**的用户ID |
| `action_type` | `string` | 动作类型：`checkin`、`checkout` 或 `reset` |
| `server_time_ms` | `number` | 服务端时间戳（毫秒） |
| `record_id` | `string` | 记录标识（格式：`{batch_id}_{user_id}_{time_ms}`） |
| `operator_student_id` | `string` | **操作人**（staff）的学号 |
| `reason` | `string` | 修正原因 |
| `check_in` | `number` | 修正后的 check_in 值（0 或 1） |
| `check_out` | `number` | 修正后的 check_out 值（0 或 1） |
| `source` | `string` | 来源标识 |

**action_type 判定规则**：
- `check_in=1 && check_out=1` → `checkout`
- `check_in=1 && check_out=0` → `checkin`
- 其他 → `reset`

### 4.3 staff 名单修正（汇总记录）

**触发条件**：名单修正完成后，额外写入一条汇总日志

`username` 和 `name` 为操作的 staff 信息。

```json
{
  "activity_id": "legacy_act_101",
  "legacy_activity_numeric_id": 101,
  "action_type": "attendance-adjustment",
  "server_time_ms": 1760000005000,
  "record_id": "adj_1760000005000",
  "operator_student_id": "2025000001",
  "reason": "批量设为已签到",
  "affected_count": 2,
  "source": "wxapp-checkin-rust"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `affected_count` | `number` | 影响的用户数量 |
| 其他字段 | - | 同上 |

补充说明：

- 名单修正汇总日志固定使用 `action_type = "attendance-adjustment"`。
- 仅当本次修正确实改动了至少 1 名成员状态时，才写这条汇总日志。

### 4.4 staff 批量签退（每人记录）

**触发条件**：staff 执行"一键全部签退"

对每个被签退的用户产生一条日志，格式同「4.2 staff 名单修正（单人记录）」。

### 4.5 staff 批量签退（汇总记录）

**触发条件**：批量签退完成且至少签退了 1 名成员后，写入汇总日志

```json
{
  "activity_id": "legacy_act_101",
  "legacy_activity_numeric_id": 101,
  "action_type": "bulk-checkout",
  "server_time_ms": 1760000005000,
  "record_id": "batch_xxx",
  "operator_student_id": "2025000001",
  "reason": "活动结束统一签退",
  "affected_count": 26,
  "source": "wxapp-checkin-rust"
}
```

### 4.6 时间字段真实口径

`suda_log` 当前同时存在两套时间信息：

| 字段 | 来源 | 精度 | 当前用途 |
|------|------|------|----------|
| `content.server_time_ms` | Rust 服务进程本地时钟 | 毫秒 | API 响应体、审计 JSON、批次追踪 |
| `time` | MySQL `CURRENT_TIMESTAMP` | 秒级 / TIMESTAMP | SQL 查询、roster 最近动作时间 |

补充说明：
- 应用连接池会在每个 MySQL 会话执行 `SET time_zone = '+08:00'`；
- `backend-rust/src/db/log_repo.rs` 查询最新动作时间时会 `CAST(time AS DATETIME)`，按北京时间解释；
- 如果你在独立 SQL 客户端排查，请先执行 `SET time_zone = '+08:00';`，否则 `time` 的显示值可能与应用侧不一致。

---

### 4.7 登录失败审计

**触发条件**：登录失败或账号已停用时写审计；进入 `rate_limited` 后，后续被限流的重复请求不再继续落库

**代码位置**：`backend-rust/src/service/auth_service.rs`

```json
{
  "student_id": "2025000007",
  "result": "failed",
  "error_code": "invalid_password",
  "server_time_ms": 1760000004300,
  "source": "wxapp-checkin-rust"
}
```

补充说明：
- `path` 固定为 `/api/web/auth/login`
- `username` 固定写当前尝试的 `student_id`
- 如果数据库中还没有命中该用户，`name` 会写空字符串
- `error_code` 记录内部真实失败原因，例如 `identity_not_found` / `invalid_password` / `account_disabled`
- `ip` 当前会优先记录反向代理透传的客户端 IP
- 当前实现记录失败登录，不记录成功登录；已进入 `rate_limited` 的重复拦截请求不再额外写 `suda_log`

---

## 5. path 字段值对照表

| path | 含义 |
|------|------|
| `/api/web/auth/login` | 登录失败 |
| `/api/web/attendance/checkin` | 普通用户签到 |
| `/api/web/attendance/checkout` | 普通用户签退 |
| `/api/web/staff/attendance-adjustment` | staff 名单修正 |
| `/api/web/staff/bulk-checkout` | staff 批量签退 |

---

## 6. 查询方式与示例

当前正式实现（`backend-rust/src/db/log_repo.rs`）仍采用以下口径：
- `content` 是紧凑 JSON 字符串，由 `serde_json::to_string` 序列化写入；
- 运行期查询使用 `JSON_VALID` + `JSON_EXTRACT` 精确过滤 `legacy_activity_numeric_id` / `action_type`；
- roster 场景使用批量查询 `find_latest_action_times(...)`，通过 `MAX(id)` 一次回收每个成员最近一条日志，避免一人一查。

人工 SQL 排查前建议先固定会话时区：

```sql
SET time_zone = '+08:00';
```

### 6.1 查询某用户在某活动的所有签到记录

```sql
SELECT *
FROM suda_log
WHERE username = '2025000007'
  AND JSON_VALID(content)
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(content, '$.legacy_activity_numeric_id')) AS SIGNED) = 101
ORDER BY id DESC;
```

### 6.2 查询某活动的所有 staff 操作

```sql
SELECT *
FROM suda_log
WHERE path LIKE '/api/web/staff/%'
  AND JSON_VALID(content)
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(content, '$.legacy_activity_numeric_id')) AS SIGNED) = 101
ORDER BY id DESC;
```

### 6.3 查询某用户最近一次签到时间

```sql
SELECT CAST(time AS DATETIME) AS action_time
FROM suda_log
WHERE username = '2025000007'
  AND JSON_VALID(content)
  AND JSON_UNQUOTE(JSON_EXTRACT(content, '$.action_type')) = 'checkin'
  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(content, '$.legacy_activity_numeric_id')) AS SIGNED) = 101
ORDER BY id DESC
LIMIT 1;
```

### 6.4 批量查询 roster 最近签到时间（当前应用侧实现口径）

```sql
SELECT
  CAST(logs.username AS CHAR(20) CHARACTER SET utf8mb4) AS username,
  CAST(logs.time AS DATETIME) AS action_time
FROM suda_log logs
INNER JOIN (
  SELECT username, MAX(id) AS latest_id
  FROM suda_log
  WHERE JSON_VALID(content)
    AND CAST(JSON_UNQUOTE(JSON_EXTRACT(content, '$.legacy_activity_numeric_id')) AS SIGNED) = 101
    AND JSON_UNQUOTE(JSON_EXTRACT(content, '$.action_type')) = 'checkin'
    AND username IN ('2025000007', '2025000008')
  GROUP BY username
) latest ON latest.latest_id = logs.id;
```

---

## 7. 日志保留策略

当前实现未设置日志保留策略，日志会持续累积。

**建议**：
- 生产环境应考虑定期归档或清理历史日志
- 可根据业务需求设置保留周期（如 90 天或 1 年）

---

## 8. 相关文档

- 数据库表结构：`docs/DATABASE_SCHEMA.md`
- API 接口规格：`docs/API_SPEC.md`
- 需求基线：`docs/REQUIREMENTS.md`
