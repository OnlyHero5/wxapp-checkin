# wxapp-checkin 后端（`backend/`）部署与配置

这份文档面向第一次接手项目的人，重点回答：
1. **生产环境如何一键启动**
2. **数据库/Redis/微信配置写到哪里**（例如数据库账号密码写哪个文件）
3. 本地联调脚本怎么跑

## 0) 目录速览

- `scripts/start-test-env.sh`：本地联调一键启动（会重置测试数据）
- `scripts/reset-suda-union-test-data.sh`：只重置 `suda_union` 测试数据
- `scripts/bootstrap-prod-schema.sql`：生产扩展库建表脚本（不含演示数据）
- `src/main/resources/application.yml`：基础配置（全部由环境变量覆盖）
- `src/main/resources/application-prod.yml`：生产 profile 覆盖（默认关闭 Flyway）
- `DB_DATABASE_DEEP_DIVE.md`：后端数据库深度说明（双库架构、表结构、同步链路、排障 SQL）

## 1) 生产环境一键启动（推荐：systemd）

> 目标：把**所有敏感配置**写入一个文件，然后 `systemctl enable --now` 一条命令启动。

### 1.1 依赖软件（生产必须）

- Java 17
- MySQL 8（至少包含两个库：扩展库 `wxcheckin_ext` + 遗留库 `suda_union`）
- Redis 7

快速检查：

```bash
java -version
mysql --version
redis-cli --version
```

### 1.2 初始化扩展库表结构（只需一次）

生产 profile 默认关闭 Flyway（见 `application-prod.yml`），因此需要手动初始化扩展库：

```bash
cd /path/to/wxapp-checkin/backend
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_ADMIN_USER> -p wxcheckin_ext < scripts/bootstrap-prod-schema.sql
```

### 1.3 写生产环境变量文件（数据库账号密码写这里）

创建：`/etc/wxcheckin/backend.prod.env`

建议权限：

```bash
sudo install -m 600 /dev/null /etc/wxcheckin/backend.prod.env
```

内容示例（把 `DB_PASSWORD/LEGACY_DB_PASSWORD/QR_SIGNING_KEY/WECHAT_SECRET` 换成真实值）：

```bash
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8080

# 扩展库（wxcheckin_ext）
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=wxcheckin_ext
DB_USER=wxcheckin_app
DB_PASSWORD=请填真实数据库密码

# 遗留库（suda_union）
LEGACY_DB_URL=jdbc:mysql://127.0.0.1:3306/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false
LEGACY_DB_USER=wxcheckin_app
LEGACY_DB_PASSWORD=请填真实数据库密码

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# 安全参数（生产必须替换）
QR_SIGNING_KEY=请填32位以上随机强密钥
QR_ISSUE_LOG_ENABLED=false
QR_ALLOW_LEGACY_UNSIGNED=false
QR_ISSUE_LOG_RETENTION_SECONDS=86400
QR_REPLAY_GUARD_RETENTION_SECONDS=0
QR_CLEANUP_ENABLED=true
QR_CLEANUP_INTERVAL_MS=300000
SESSION_TTL_SECONDS=7200

# 微信（真实小程序必须开启并填写）
WECHAT_API_ENABLED=true
WECHAT_APPID=请填微信小程序AppID
WECHAT_SECRET=请填微信小程序Secret
```

生成强密钥示例：

```bash
openssl rand -hex 32
```

### 1.4 构建与安装 Jar

构建：

```bash
cd /path/to/wxapp-checkin/backend
./mvnw -DskipTests clean package
```

将 Jar 放到服务器目录（示例）：

- `/opt/wxapp-checkin/backend/backend-0.0.1-SNAPSHOT.jar`

### 1.5 配置 systemd 服务文件

创建：`/etc/systemd/system/wxcheckin-backend.service`

```ini
[Unit]
Description=wxcheckin backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wxapp-checkin/backend
EnvironmentFile=/etc/wxcheckin/backend.prod.env
ExecStart=/usr/bin/java -jar /opt/wxapp-checkin/backend/backend-0.0.1-SNAPSHOT.jar
Restart=always
RestartSec=5
SuccessExitStatus=143

[Install]
WantedBy=multi-user.target
```

### 1.6 一键启动（生产）

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wxcheckin-backend
sudo systemctl status wxcheckin-backend
```

日志：

```bash
journalctl -u wxcheckin-backend -f
```

健康检查：

```bash
curl http://127.0.0.1:8080/actuator/health
```

返回 `{"status":"UP"...}` 表示启动成功。

## 2) 生产环境一键启动（可选：Docker Compose）

适合：单机快速落地/演示；会启动 **MySQL + Redis + Backend** 三个容器。

1) 在 `backend/` 目录复制并填写环境文件：

```bash
cd /path/to/wxapp-checkin/backend
cp .env.example .env
```

> 你的真实账号密码/密钥写在 `.env`（不要提交到 git）。

2) 一键启动：

```bash
docker compose up -d
```

3) 健康检查：

```bash
curl http://127.0.0.1:8080/actuator/health
```

> 注意：该 compose 方案默认使用容器内 MySQL。若你要对接现网 `suda_union`，更推荐使用上面的 systemd 方案（直接连现网 MySQL/Redis）。

## 3) 本地联调/验收（一键脚本）

### 3.1 配置测试环境变量文件

默认读取：`~/.wxapp-checkin-test-env.sh`（可用 `WXAPP_TEST_ENV_FILE` 覆盖路径）

### 3.2 一键启动（会覆盖测试数据）

```bash
cd /path/to/wxapp-checkin/backend
chmod +x scripts/*.sh
./scripts/start-test-env.sh
```

该脚本默认：
- `SPRING_PROFILES_ACTIVE=dev`
- `SERVER_PORT=9989`（可通过环境变量覆盖）
- 开启 legacy sync / outbox relay

健康检查（按实际端口）：

```bash
curl http://127.0.0.1:9989/actuator/health
```

详细说明与测试账号见：`TEST_ENV_TESTING.md`

## 4) 环境变量清单（速查）

| 类别 | 变量 | 说明 |
|------|------|------|
| 基础 | `SPRING_PROFILES_ACTIVE` | `dev` / `prod` |
| 基础 | `SERVER_PORT` | 服务端口 |
| 扩展库 | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | MySQL（`wxcheckin_ext`） |
| 遗留库 | `LEGACY_DB_URL` `LEGACY_DB_USER` `LEGACY_DB_PASSWORD` | MySQL（`suda_union`） |
| Redis | `REDIS_HOST` `REDIS_PORT` `REDIS_PASSWORD` | Redis 连接 |
| 二维码 | `QR_SIGNING_KEY` | 二维码签名密钥（生产必须替换；**prod profile 会强制校验不可为空/不可用默认占位符**） |
| 二维码 | `QR_DEFAULT_ROTATE_SECONDS` `QR_DEFAULT_GRACE_SECONDS` | 默认换码/宽限秒数（可被活动配置覆盖） |
| 二维码 | `QR_REPLAY_TTL_SECONDS` | 防重放键额外 TTL（秒），会叠加在 `accept_expire_at` 之后 |
| 二维码 | `QR_ISSUE_LOG_ENABLED` | 是否写 `wx_qr_issue_log`（审计用；生产建议关闭以避免持续增长） |
| 二维码 | `QR_ALLOW_LEGACY_UNSIGNED` | 是否允许旧版未签名 nonce（建议联调/灰度期为 true，稳定后设为 false） |
| 二维码 | `QR_ISSUE_LOG_RETENTION_SECONDS` | issue log 数据保留秒数（定期清理用） |
| 二维码 | `QR_REPLAY_GUARD_RETENTION_SECONDS` | replay guard 额外保留秒数（默认 0 表示到期即可删除） |
| 二维码 | `QR_CLEANUP_ENABLED` `QR_CLEANUP_INTERVAL_MS` | 是否开启二维码相关表的定期清理任务/清理间隔（毫秒） |
| 会话 | `SESSION_TTL_SECONDS` | session 过期秒数 |
| 微信 | `WECHAT_API_ENABLED` `WECHAT_APPID` `WECHAT_SECRET` | 微信登录换取 openid/session_key |
| 同步 | `LEGACY_SYNC_ENABLED` `LEGACY_SYNC_INTERVAL_MS` | legacy pull 同步开关与间隔 |
| 同步 | `OUTBOX_RELAY_ENABLED` `OUTBOX_RELAY_INTERVAL_MS` | outbox relay 开关与间隔 |
| 注册 | `REGISTER_PAYLOAD_VERIFY_ENABLED` | 是否校验注册载荷签名 |

## 5) 二维码签名与日志增长控制（Point 2/3/4，2026-02-28）

本项目二维码票据协议保持不变：

```text
wxcheckin:v1:<activity_id>:<action_type>:<slot>:<nonce>
```

### 5.1 Signed nonce（`QR_SIGNING_KEY` 真正生效）

为避免“伪造二维码”与“篡改二维码内容”（例如改 `activity_id`/`action_type`），后端将签名嵌入到 `nonce` 中：

- `nonce = randomPart + sigPart`
- `randomPart`：16 字节随机数的 base64url（无 padding），长度 22
- `sigPart`：`HMAC-SHA256` 结果的 base64url（无 padding），长度 43
- 合计 `nonce` 长度固定为 65

签名密钥来源：`app.qr.signing-key`（环境变量 `QR_SIGNING_KEY`）。

consume 侧规则：
- 若 nonce 是 signed nonce（长度 65），则必须验签通过才允许继续（不再依赖 `wx_qr_issue_log` 存在性校验）。
- 若 nonce 不是 signed nonce：仅当 `QR_ALLOW_LEGACY_UNSIGNED=true` 时，才会走旧逻辑（校验 `wx_qr_issue_log` 存在性）。

### 5.2 `wx_qr_issue_log` 为什么会无限增长，以及怎么止血

历史实现将每次发码都落库到 `wx_qr_issue_log`，且 consume 依赖它校验“二维码确实由 staff 发出”。在真实生产下：
- staff 页面每 `rotate_seconds` 自动刷新二维码
- 每次刷新都会写一行 issue log
- 导致 `wx_qr_issue_log` 持续增长

现在有两道保险：
1. `QR_ISSUE_LOG_ENABLED=false`：彻底停止写 `wx_qr_issue_log`（推荐生产默认）。
2. `QrMaintenanceJob` 定期按 retention 清理 `wx_qr_issue_log` 与 `wx_replay_guard`（避免表无限增长）。

### 5.3 生产推荐配置（强烈建议）

```bash
# 必须：设置强随机密钥
QR_SIGNING_KEY=<32字节以上强随机密钥>

# 推荐：停写 issue log，避免持续增长
QR_ISSUE_LOG_ENABLED=false

# 推荐：灰度期可先 true；确认全部客户端都已使用 signed nonce 后设为 false
QR_ALLOW_LEGACY_UNSIGNED=false

# 保留与清理（按实际审计需求调整）
QR_ISSUE_LOG_RETENTION_SECONDS=86400
QR_REPLAY_GUARD_RETENTION_SECONDS=0
QR_CLEANUP_ENABLED=true
QR_CLEANUP_INTERVAL_MS=300000
```

### 5.4 数据库升级（索引与清理性能）

已新增 Flyway 迁移：`src/main/resources/db/migration/V5__add_qr_retention_indexes.sql`，用于：
- `wx_qr_issue_log(activity_id, action_type, slot, nonce)`：提升校验/回查性能
- `wx_qr_issue_log(accept_expire_at)`：提升清理性能

注意：生产 profile 默认关闭 Flyway（`application-prod.yml`），因此生产升级请执行一次：

```bash
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_ADMIN_USER> -p wxcheckin_ext < src/main/resources/db/migration/V5__add_qr_retention_indexes.sql
```

### 5.5 运维注意事项

- **多实例部署**：所有实例必须使用同一个 `QR_SIGNING_KEY`，否则会出现 A-05 发码能用、A-06 验签失败（`invalid_qr`）。
- **密钥轮换**：轮换 `QR_SIGNING_KEY` 会导致旧二维码立即失效。建议在低峰期轮换，并确保 staff 页面刷新出新二维码后再恢复扫码通道。

## 6) 前端如何连接

前端 `baseUrl` 填后端地址，不要加 `/api`（见 `../frontend/README.md`）。
