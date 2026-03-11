# wxapp-checkin 后端（`backend/`）部署与配置

> 说明：当前仓库已完成 Web-only 收口。`backend/` 是唯一正式业务后端，正式产品基线请以 `../docs/REQUIREMENTS.md`、`../docs/FUNCTIONAL_SPEC.md`、`../docs/API_SPEC.md` 为准。本文档只描述部署、配置和本地联调方式。

这份文档面向第一次接手项目的人，重点回答：
1. **生产环境如何一键启动**
2. **数据库/Redis/WebAuth 配置写到哪里**（例如数据库账号密码写哪个文件）
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

内容示例（把 `DB_PASSWORD/LEGACY_DB_PASSWORD/QR_SIGNING_KEY` 换成真实值）：

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

# Web 身份（账号密码）
# - 默认密码固定为 123
# - 首次登录必须修改密码
# - 不再需要配置 WEBAUTHN_*（Passkey/WebAuthn 已从主链路移除）
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

补充说明：

- 当前 compose 已通过 MySQL init 脚本自动初始化 `wxcheckin_ext` 表结构，并写入一份 `suda_union` 演示数据（仅用于本地演示）。
- 当前认证基线为账号密码（默认 `123` + 首次强制改密），适配 HTTP 内网访问形态。

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

默认读取：`backend/.env.test.local.sh`（可用 `WXAPP_TEST_ENV_FILE` 覆盖路径；仍兼容旧 `~/.wxapp-checkin-test-env.sh` 但不再推荐）

推荐先复制仓库内模板：

```bash
cd /path/to/wxapp-checkin
cp backend/scripts/test-env.example.sh backend/.env.test.local.sh
```

最小检查项：

- `DB_*` 能连接 `wxcheckin_ext`
- `LEGACY_DB_*` 能连接 `suda_union`
- `REDIS_*` 能连接本地 Redis
- `QR_SIGNING_KEY` 不为空

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

前端联调建议：

```bash
cd ../web
npm install
npm run dev
```

说明：

- `web/` 当前默认把 `VITE_API_BASE_PATH` 代理到 `VITE_API_PROXY_TARGET=http://127.0.0.1:9989`，刚好对齐本节测试环境脚本。
- 若你把后端改跑到其他端口，请同步调整 `web/.env.local` 中的 `VITE_API_PROXY_TARGET`。
- 若要与 `suda-gs-ams` 共域部署，建议额外设置：
  - `VITE_APP_BASE_PATH=/checkin/`
  - `VITE_API_BASE_PATH=/checkin-api/web`

健康检查（按实际端口）：

```bash
curl http://127.0.0.1:9989/actuator/health
```

详细说明与测试账号见：`TEST_ENV_TESTING.md`

### 3.3 登录说明（默认密码与强制改密）

- 账号统一使用 `student_id`（学号）。
- 默认密码固定为 `123`。
- 首次登录成功后必须修改密码；未改密前，后端会对业务接口统一返回 `password_change_required`。

## 4) 环境变量清单（速查）

| 类别 | 变量 | 说明 |
|------|------|------|
| 基础 | `SPRING_PROFILES_ACTIVE` | `dev` / `prod` |
| 基础 | `SERVER_PORT` | 服务端口 |
| 扩展库 | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` | MySQL（`wxcheckin_ext`） |
| 遗留库 | `LEGACY_DB_URL` `LEGACY_DB_USER` `LEGACY_DB_PASSWORD` | MySQL（`suda_union`） |
| Redis | `REDIS_HOST` `REDIS_PORT` `REDIS_PASSWORD` | Redis 连接 |
| 动态码 | `QR_SIGNING_KEY` | 动态码签名密钥（生产必须替换；**prod profile 会强制校验不可为空/不可用默认占位符**） |
| 动态码 | `QR_DEFAULT_ROTATE_SECONDS` `QR_DEFAULT_GRACE_SECONDS` | 默认换码/宽限秒数（当前 Web 管理页仍复用这组配置键） |
| 动态码 | `QR_REPLAY_TTL_SECONDS` | 防重放键额外 TTL（秒） |
| 动态码 | `QR_ISSUE_LOG_ENABLED` | 是否写 `wx_qr_issue_log`（当前仅保留内部兼容清理，不作为正式接口输出） |
| 动态码 | `QR_ALLOW_LEGACY_UNSIGNED` | 是否允许旧版未签名 nonce |
| 动态码 | `QR_ISSUE_LOG_RETENTION_SECONDS` | issue log 数据保留秒数（定期清理用） |
| 动态码 | `QR_REPLAY_GUARD_RETENTION_SECONDS` | replay guard 额外保留秒数 |
| 动态码 | `QR_CLEANUP_ENABLED` `QR_CLEANUP_INTERVAL_MS` | 是否开启动态码相关表的定期清理任务/清理间隔（毫秒） |
| 会话 | `SESSION_TTL_SECONDS` | session 过期秒数 |
| 同步 | `LEGACY_SYNC_ENABLED` `LEGACY_SYNC_INTERVAL_MS` | legacy pull 同步开关与间隔 |
| 同步 | `OUTBOX_RELAY_ENABLED` `OUTBOX_RELAY_INTERVAL_MS` | outbox relay 开关与间隔 |
| 注册 | `REGISTER_PAYLOAD_VERIFY_ENABLED` | 历史占位配置，当前 Web-only 主链路不再使用 |

## 4.1 与 `suda-gs-ams` / `suda_union` 共域时的路由建议

- `suda_union` 当前真实 controller 仍是 `/activity`、`/user`、`/session`、`/department`、`/suda_login`、`/token` 等旧前缀，不直接占用 `/api/web/**`。
- 真正的冲突点不在 controller 名字，而在“同域网关怎么分流”：
  - `suda-gs-ams` 当前大量依赖通用 `/api/*`
  - `wxapp-checkin` 正式接口走 `/api/web/**`
- 若同域共存，请至少满足以下一条：
  - 网关先匹配 `/api/web/` 再匹配通用 `/api/`
  - 或者前端改用独立外部前缀（例如 `VITE_API_BASE_PATH=/checkin-api/web`），再把它转发/重写到本服务的 `/api/web/**`
- 前端静态资源建议同时挂在独立子路径（例如 `/checkin/`），避免与另一个 SPA 共享 `/` 和 `/login`。

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

手机 Web 前端默认通过同源 `/api/web/**` 访问后端；若本地分开启动，请在 `web/` 的开发配置中指向当前后端地址，并保持 `X-Browser-Binding-Key` 与 `Authorization` 头由前端请求层自动注入。
