# 数据库表结构说明

文档版本：v1.1
状态：正式基线
更新日期：2026-04-12
项目：`wxapp-checkin`

## 1. 概述

本文档描述 `wxapp-checkin` 项目依赖的数据库表结构。所有表均位于 `suda_union` 数据库中。

### 1.1 读写边界

| 表名 | 读写模式 | 说明 |
|------|----------|------|
| `suda_user` | 只读 | 用户基础信息 |
| `suda_department` | 只读 | 院系列表 |
| `suda_department_u` | 只读 | 用户-院系关联 |
| `suda_activity` | 只读 | 活动基础信息 |
| `suda_activity_apply` | **读写** | 报名记录与签到状态 |
| `suda_log` | **读写** | 审计日志 |

**重要约束**：运行期写入只允许命中 `suda_activity_apply` 和 `suda_log`。

---

## 2. 只读表

### 2.1 `suda_user` - 用户表

存储所有用户的基础信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `BIGINT` | 用户主键 |
| `username` | `VARCHAR(20)` | 学号（登录账号） |
| `password` | `VARCHAR(60)` | bcrypt 密码哈希 |
| `name` | `VARCHAR(255)` | 真实姓名 |
| `role` | `INT` | 角色编号（0-3 为 staff，其他为 normal） |
| `invalid` | `TINYINT` | 账号状态（0=正常，1=禁用） |

**角色映射规则**：
- `role` 值为 0、1、2、3 时映射为 `staff`
- 其他值映射为 `normal`

**账号状态真实口径**：
- `invalid` 字段由外部系统维护；
- `wxapp-checkin` 登录和 bearer token 鉴权都会校验该字段；
- `invalid=1` 的账号不能重新登录，也不能继续使用旧 token 访问业务接口。

### 2.2 `suda_department` - 院系表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `BIGINT` | 院系主键 |
| `department` | `VARCHAR(255)` | 院系名称 |

### 2.3 `suda_department_u` - 用户院系关联表

| 字段 | 类型 | 说明 |
|------|------|------|
| `username` | `VARCHAR(20)` | 学号（外键关联 suda_user.username） |
| `department_id` | `BIGINT` | 院系 ID（外键关联 suda_department.id） |

### 2.4 `suda_activity` - 活动表

存储活动基础信息，由外部系统维护。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `BIGINT` | 活动主键（legacy_activity_id） |
| `name` | `VARCHAR(255)` | 活动标题 |
| `description` | `TEXT` | 活动描述 |
| `location` | `VARCHAR(255)` | 活动地点 |
| `activity_stime` | `DATETIME / 兼容 legacy TIMESTAMP 语义` | 活动开始时间 |
| `activity_etime` | `DATETIME / 兼容 legacy TIMESTAMP 语义` | 活动结束时间 |
| `type` | `INT` | 活动类型（1=讲座，其他=活动） |
| `state` | `INT` | 活动状态（>=4 为已结束） |

**类型映射**：
- `type = 1` → "讲座"
- `type ≠ 1` → "活动"

**状态映射**：
- `state >= 4` → "completed"
- `state < 4` → "ongoing"

**时间字段真实口径**：
- 应用层当前通过 `DATE_FORMAT(..., '%Y-%m-%d %H:%i:%s')` 读取活动时间；
- 读取后会把 legacy 时间按“北京时间墙上时间”做 8 小时折返补偿；
- 因此排查活动时间问题时，不能只盯数据库列类型，还要看应用层的兼容解码逻辑。

---

## 3. 读写表

### 3.1 `suda_activity_apply` - 报名记录表

存储用户的报名记录和签到/签退状态。这是核心业务表。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `BIGINT` | 记录主键 |
| `activity_id` | `BIGINT` | 活动ID（关联 suda_activity.id） |
| `username` | `VARCHAR(20)` | 学号（关联 suda_user.username） |
| `state` | `INT` | 报名状态（0=已报名，2=已确认，1=已取消） |
| `check_in` | `TINYINT` | 签到标记（0=未签到，1=已签到） |
| `check_out` | `TINYINT` | 签退标记（0=未签退，1=已签退） |

**报名状态说明**：
- `state = 0`：已报名
- `state = 2`：已确认
- `state = 1`：已取消（不参与签到）

**签到状态组合**：

| check_in | check_out | 含义 |
|----------|-----------|------|
| 0 | 0 | 未签到 |
| 1 | 0 | 已签到未签退 |
| 1 | 1 | 已签退 |

**异常状态**：`check_in=0 && check_out=1` 为异常状态，需要通过统一修正接口修复。

### 3.2 `suda_log` - 审计日志表

记录所有签到、签退和管理操作的审计日志。详见 `docs/AUDIT_LOG_SPEC.md`。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `BIGINT` | 日志主键（自增） |
| `username` | `VARCHAR(20)` | 操作人学号 |
| `name` | `VARCHAR(255)` | 操作人姓名 |
| `path` | `VARCHAR(255)` | API 路径 |
| `content` | `TEXT` | JSON 格式的操作详情 |
| `ip` | `VARCHAR(45)` | 客户端 IP（当前通过代理头提取） |
| `address` | `VARCHAR(255)` | 地址（当前仍为空） |
| `time` | `TIMESTAMP` | MySQL 写入时间；应用侧读取前会固定会话时区为 `+08:00` 并按北京时间解释 |

时间字段补充说明：
- `content.server_time_ms`：Rust 服务在写日志时记录的服务端 Unix 毫秒时间戳；
- `time`：MySQL `CURRENT_TIMESTAMP` 写入时间；
- 应用读取 `suda_log.time` 前会执行 `SET time_zone = '+08:00'`，因此 API / roster 中展示的最新动作时间以北京时间为准；
- 如果你在独立 SQL 会话里手工查询 `suda_log.time`，需要自行确认该会话时区，否则显示值可能与应用侧不一致。

---

## 4. 启动时验证的表

后端启动时会验证以下 6 张表是否存在且可读：

```rust
const REQUIRED_TABLES: [&str; 6] = [
  "suda_user",
  "suda_department_u",
  "suda_department",
  "suda_activity",
  "suda_activity_apply",
  "suda_log",
];
```

如果任一表缺失或不可读，后端将拒绝启动并输出蓝色错误日志。

---

## 5. 数据库连接配置

连接池参数（`backend-rust/src/db/mod.rs`）：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_connections` | 4 | 最大连接数 |
| `min_connections` | 0 | 最小连接数 |
| `acquire_timeout` | 3s | 获取连接超时 |
| `idle_timeout` | 60s | 空闲连接超时 |
| `max_lifetime` | 300s | 连接最大生命周期 |

这些参数设计为"小内存、低常驻"目标，适配约 400M RAM 的服务器环境。

---

## 6. 相关文档

- 审计日志详细规格：`docs/AUDIT_LOG_SPEC.md`
- 需求基线：`docs/REQUIREMENTS.md`
- 接口基线：`docs/API_SPEC.md`
