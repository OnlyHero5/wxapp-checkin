# 安全机制规格说明

文档版本：v1.2
状态：正式基线
更新日期：2026-04-12
项目：`wxapp-checkin`

## 1. 概述

本文档描述 `wxapp-checkin` 项目的安全机制实现，包括：
- 动态码生成与验证
- 会话认证（JWT）
- 防重放机制
- 限流机制
- 密码处理

---

## 2. 动态码机制

### 2.1 设计目标

动态码是签到/签退的核心验证手段：
- 6 位数字码
- 每 10 秒轮换一次
- 同一活动、同一动作、同一时间片内，所有 staff 看到相同码
- 活动时间窗口外无法生成有效码

### 2.2 生成算法

**代码位置**：`backend-rust/src/service/activity_service/code.rs`

```
签名内容 = "web-code:v1|{activity_id}|{action_type}|{slot}"
签名密钥 = QR_SIGNING_KEY（环境变量）
签名算法 = HMAC-SHA256
```

**生成步骤**：
1. 构造签名内容：`web-code:v1|legacy_act_101|checkin|123`
2. 使用 HMAC-SHA256 计算签名
3. 取签名前 4 字节，转成 32 位有符号整数
4. 取绝对值后对 1,000,000 取模
5. 格式化为 6 位数字（不足补零）

**代码示例**：
```rust
fn generate_code(signing_key: &str, activity_id: &str, action_type: &str, slot: u64) -> String {
    let mut mac = HmacSha256::new_from_slice(signing_key.as_bytes())?;
    mac.update(format!("web-code:v1|{activity_id}|{action_type}|{slot}").as_bytes());
    let digest = mac.finalize().into_bytes();
    let value = i32::from_be_bytes([digest[0], digest[1], digest[2], digest[3]])
        .wrapping_abs() as u32 % 1_000_000;
    format!("{value:06}")
}
```

### 2.3 时间片计算

```
时间片窗口 = 10 秒
时间片号 = 当前时间戳(毫秒) / (10 * 1000)
码过期时间 = (时间片号 + 1) * (10 * 1000)
```

**示例**：
- 当前时间：`17600000123000` 毫秒
- 时间片号：`1230`
- 码过期时间：`17600000130000` 毫秒
- 剩余有效期：`7000` 毫秒

### 2.4 验证规则

验证时检查两个时间片：
1. **当前时间片**：如果匹配，返回成功
2. **上一个时间片**：如果匹配，返回"已过期"错误
3. **都不匹配**：返回"无效码"错误

这样可以明确区分"输错"和"刚过期"两种情况。

### 2.5 发码时间窗口

动态码仅在以下时间窗口内有效：

```
窗口开始 = 活动开始时间 - 30 分钟
窗口结束 = 活动结束时间 + 30 分钟
```

**错误码**：
- `outside_activity_time_window`：不在发码/验码时间窗口内
- `activity_time_invalid`：活动时间信息异常

---

## 3. 会话认证

### 3.1 JWT 配置

**代码位置**：`backend-rust/src/token.rs`

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 算法 | HS256 | HMAC-SHA256 |
| 密钥 | QR_SIGNING_KEY | 复用动态码签名密钥 |
| 默认有效期 | 7200 秒（2小时） | 可通过环境变量配置 |
| 过期验证 | 手动 | 禁用库内验证，业务层显式判断 |

### 3.2 JWT Claims 结构

```json
{
  "uid": 7,
  "student_id": "2025000007",
  "role": "staff",
  "exp": 1760007200,
  "iat": 1760000000
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `uid` | `number` | 用户ID |
| `student_id` | `string` | 学号 |
| `role` | `string` | 角色：`normal` 或 `staff` |
| `exp` | `number` | 过期时间（Unix 秒） |
| `iat` | `number` | 签发时间（Unix 秒） |

### 3.3 认证流程

```
1. 客户端调用 POST /api/web/auth/login
2. 服务端验证学号和密码
3. 服务端签发 JWT，返回 session_token
4. 客户端存储 session_token
5. 后续请求携带 Authorization: Bearer <session_token>
6. 服务端验证 JWT 签名和过期时间
7. 解析 claims，注入 CurrentUser
```

### 3.4 会话失效处理

当会话失效时，返回：
```json
{
  "status": "forbidden",
  "message": "会话失效，请重新登录",
  "error_code": "session_expired"
}
```

前端收到 `session_expired` 后必须清理本地会话并跳转到登录页。

### 3.5 账号禁用字段真实口径

数据库 `suda_user.invalid` 字段当前已接入登录与鉴权拦截链路：
- `backend-rust/src/service/auth_service.rs` 登录时会拒绝 `invalid != 0` 的账号；
- `backend-rust/src/api/auth_extractor.rs` 会在 bearer token 反查数据库后再次校验 `invalid`；
- 被停用账号继续使用旧 token 访问受保护接口时，也会收到 `account_disabled`。

因此当前正式口径是：
- `invalid=1` 已被后端视为生效的停用状态；
- 停用账号不能重新登录，也不能继续使用已有会话访问业务接口；
- 前端收到 `account_disabled` 后，应按会话失效处理并清理本地会话。

---

## 4. 防重放机制

### 4.1 设计目标

阻止同一时间片内的重复提交，防止：
- 用户重复点击签到按钮
- 脚本自动化重复提交

### 4.2 实现方式

**代码位置**：`backend-rust/src/replay_guard.rs`

使用内存级 TTL 缓存（`moka` 库）：
- 缓存容量：20,000 条
- TTL：90 秒
- 唯一键格式：`{student_id}:{legacy_activity_id}:{action_type}:{slot}`

### 4.3 防重放键结构

```
key = "{student_id}:{legacy_activity_id}:{action_type}:{slot}"
```

**示例**：`2025000007:101:checkin:123`

### 4.4 工作流程

```
1. 用户提交签到请求
2. 构造防重放键
3. 尝试写入缓存
   - 写入成功（fresh）：继续处理
   - 写入失败（已存在）：返回 duplicate 错误
4. 处理完成后，键在 TTL 后自动过期
```

### 4.5 限制

**重要**：当前防重放机制是**进程内**的，有以下限制：
- 服务重启后防重放状态丢失
- 多实例部署时各实例独立计数
- 不支持分布式防重放

如需分布式防重放，需要引入 Redis。

---

## 5. 限流机制

### 5.1 设计目标

限制动态码错误尝试次数，防止暴力破解。

### 5.2 实现方式

**代码位置**：`backend-rust/src/rate_limit.rs`

使用 `governor` 库的令牌桶算法：
- 动态码错误限流：基于 `user_id + activity_id`
- 登录失败限流：同时基于 `student_id` 与客户端 IP
- 内存级限流
- 不支持分布式

### 5.3 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 最大尝试次数 | 12 次 | 窗口内允许的最大错误次数 |
| 窗口时长 | 60 秒 | 限流窗口 |

### 5.4 限流键结构

```
key = "u:{user_id}:{activity_id}"
```

### 5.5 限流响应

当触发限流时：
```json
{
  "status": "forbidden",
  "message": "验证码尝试次数过多，请稍后再试（60 秒后重试）",
  "error_code": "rate_limited"
}
```

HTTP 状态码：`429`

### 5.6 限流真实覆盖范围

当前正式实现覆盖两类限流：

1. 登录失败限流
- 接口：`POST /api/web/auth/login`
- 键：
  - `student_id`
  - 客户端 IP
- 窗口：60 秒
- 默认阈值：
  - 单学号 5 次失败后返回 `rate_limited`
  - 单 IP 20 次失败后返回 `rate_limited`

2. 动态码错误限流
- 接口：`POST /api/web/activities/{activity_id}/code-consume`
- 键：`u:{user_id}:{activity_id}`
- 只对 `invalid_code` / `expired` 计数
- 窗口：60 秒
- 默认阈值：12 次失败后返回 `rate_limited`

当前仍**不覆盖**：
- staff 名单修正
- staff 批量签退
- 活动列表 / 详情 / roster 只读查询

---

## 6. 密码处理

### 6.1 存储格式

密码使用 bcrypt 算法哈希存储：
- 哈希长度：60 字符
- 内置盐值
- 成本因子由原系统决定

### 6.2 验证流程

**代码位置**：`backend-rust/src/service/auth_service.rs`

```
1. 从数据库读取 password 字段
2. 如果为空或无效，直接返回"密码错误"
3. 使用 bcrypt::verify() 验证
4. 验证失败返回"密码错误"
```

### 6.3 安全注意事项

- 登录接口对外统一返回 `invalid_credentials`
- 学号不存在、密码为空、哈希为空、bcrypt 校验失败、账号已停用都会映射到同一登录失败响应
- 详细失败原因继续写入登录失败审计日志，但已进入 `rate_limited` 的重复拦截请求不再继续落库
- 登录失败次数过多时返回 `rate_limited`
- 不支持通过 API 修改密码
- 密码修改需要通过外部系统完成

### 6.4 错误响应与脱敏真实口径

**代码位置**：
- `backend-rust/src/error.rs`
- `backend-rust/src/api/error_response.rs`

当前实现区分两类错误：

1. **业务错误**
   - 继续返回稳定 envelope：`status` / `message` / `error_code`
   - 同时映射真实 HTTP 状态码，例如 `rate_limited -> 429`

2. **内部错误**
   - 统一返回 `status=error`、`error_code=internal_error`
   - 客户端消息固定为：`系统内部错误，请稍后重试`
   - 详细错误文本只打印到容器终端日志，不再直接暴露给前端

---

## 7. 环境变量配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `QR_SIGNING_KEY` | 是 | - | 动态码签名密钥（建议 48+ 字节） |
| `SESSION_TTL_SECONDS` | 否 | 7200 | 会话有效期（秒） |

### 7.1 生成密钥示例

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

**重要**：
- 生产环境必须使用强随机密钥
- 禁止使用示例中的 `replace-with-generated-secret`

---

## 8. 角色与权限

### 8.1 角色映射

**代码位置**：`backend-rust/src/domain.rs`

数据库 `suda_user.role` 值：
- `0, 1, 2, 3` → `staff`
- 其他值 → `normal`

### 8.2 权限列表

**staff 权限**：
- `activity:checkin`
- `activity:checkout`
- `activity:detail`
- `activity:manage`
- `activity:bulk-checkout`
- `activity:roster`
- `activity:attendance-adjust`

**normal 权限**：无（空数组）

---

## 9. 相关文档

- 审计日志规格：`docs/AUDIT_LOG_SPEC.md`
- 数据库表结构：`docs/DATABASE_SCHEMA.md`
- API 接口规格：`docs/API_SPEC.md`
- 部署手册：`docs/DEPLOYMENT.md`
