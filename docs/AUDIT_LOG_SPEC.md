# 审计日志规格说明

文档版本：v1.0
状态：正式基线
更新日期：2026-04-05
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
  time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '写入时间'
);
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `BIGINT` | 自动 | 自增主键 |
| `username` | `VARCHAR(20)` | 是 | 操作人学号 |
| `name` | `VARCHAR(255)` | 是 | 操作人姓名 |
| `path` | `VARCHAR(255)` | 是 | API 路径（见下文） |
| `content` | `TEXT` | 是 | JSON 格式的操作详情 |
| `ip` | `VARCHAR(45)` | 否 | 客户端 IP（当前实现传空） |
| `address` | `VARCHAR(255)` | 否 | 地址（当前实现传空） |
| `time` | `TIMESTAMP` | 自动 | 写入时间 |

---

## 3. 写入场景

### 3.1 写入触发点总览

| 场景 | 触发接口 | path 值 | 操作人 |
|------|----------|---------|--------|
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
| 登录失败 | 当前实现不写日志 |
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
  "action_type": "bulk-checkout",
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

### 4.4 staff 批量签退（每人记录）

**触发条件**：staff 执行"一键全部签退"

对每个被签退的用户产生一条日志，格式同「4.2 staff 名单修正（单人记录）」。

### 4.5 staff 批量签退（汇总记录）

**触发条件**：批量签退完成后，写入汇总日志

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

---

## 5. path 字段值对照表

| path | 含义 |
|------|------|
| `/api/web/attendance/checkin` | 普通用户签到 |
| `/api/web/attendance/checkout` | 普通用户签退 |
| `/api/web/staff/attendance-adjustment` | staff 名单修正 |
| `/api/web/staff/bulk-checkout` | staff 批量签退 |

---

## 6. 查询示例

### 6.1 查询某用户在某活动的所有签到记录

```sql
SELECT *
FROM suda_log
WHERE username = '2025000007'
  AND content LIKE '%"legacy_activity_numeric_id":101%'
ORDER BY id DESC;
```

### 6.2 查询某活动的所有 staff 操作

```sql
SELECT *
FROM suda_log
WHERE path LIKE '/api/web/staff/%'
  AND content LIKE '%"legacy_activity_numeric_id":101%'
ORDER BY id DESC;
```

### 6.3 查询某用户最近一次签到时间

```sql
SELECT CAST(time AS DATETIME) AS action_time
FROM suda_log
WHERE username = '2025000007'
  AND content LIKE '%"action_type":"checkin"%'
  AND content LIKE '%"legacy_activity_numeric_id":101%'
ORDER BY id DESC
LIMIT 1;
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
