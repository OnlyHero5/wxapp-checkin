# wxapp-checkin 后端（`backend/`）部署与配置

> 说明：当前仓库已完成 Web-only 收口。`backend/` 是唯一正式业务后端，正式产品基线请以 `../docs/REQUIREMENTS.md`、`../docs/FUNCTIONAL_SPEC.md`、`../docs/API_SPEC.md` 为准。本文档只描述部署、配置和本地联调方式。

这份文档面向第一次接手项目的人，重点回答：
1. **生产环境如何一键启动**
2. **数据库/Redis/认证与动态码配置写到哪里**（例如数据库账号密码写哪个文件）
3. 本地联调脚本怎么跑

如果你还需要把 `web/dist` 一并发布到 Nginx / 网关，请同时阅读：`../docs/DEPLOYMENT.md`。

## 0) 目录速览

- `scripts/start-test-env.sh`：本地联调一键启动（会重置测试数据）
- `scripts/reset-suda-union-test-data.sh`：只重置 `suda_union` 测试数据
- `scripts/bootstrap-prod-schema.sql`：生产扩展库建表脚本（不含演示数据）
- `src/main/resources/application.yml`：基础配置（全部由环境变量覆盖）
- `src/main/resources/application-prod.yml`：生产 profile 覆盖（启用 Flyway，使用 `db/migration_prod`）
- `DB_DATABASE_DEEP_DIVE.md`：后端数据库深度说明（双库架构、表结构、同步链路、排障 SQL）

## 0.1) 按场景跳转

- 只想把后端在服务器上以 systemd 方式跑起来：看 `1) 生产环境一键启动（推荐：systemd）`
- 只想单机快速演示：看 `2) 生产环境一键启动（可选：Docker Compose）`
- 只想本地联调：看 `3) 本地联调/验收（一键脚本）`
- 还需要把 Web 静态资源一起发布：看 `../docs/DEPLOYMENT.md`

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

生产 profile 已启用 Flyway 自动迁移（见 `application-prod.yml`），默认使用 **无演示数据** 的迁移目录：

- `classpath:db/migration_prod`

因此大多数情况下 **不需要** 手工初始化扩展库表结构：只要后端能连上 `wxcheckin_ext`，启动时会自动建表/升级。

特殊情况说明：

- 如果 `wxcheckin_ext` 库不存在：
  - 推荐：给 DB 账号授予 `CREATE DATABASE` 权限，并保持 `DB_CREATE_DATABASE_IF_NOT_EXIST=true`（默认 true），后端会尝试自动建库；
  - 或由 DBA 先创建空库（后端启动时会自动建表）。
- 如果库已存在但没有 `flyway_schema_history`（历史手工建表/拷贝库）：
  - 后端会基于表/列/索引推断 baseline 版本后再迁移；
  - 极端情况下可设置 `WXAPP_FLYWAY_BASELINE_OVERRIDE` 强制 baseline（例如 `11`）。

仍保留手工 bootstrap 脚本作为兜底（不推荐，除非你的变更流程禁止线上自动迁移）：

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

# 自动建库开关（DB_NAME 不存在时尝试创建；需要 DB_USER 具备 CREATE DATABASE 权限）
DB_CREATE_DATABASE_IF_NOT_EXIST=true

# 遗留库（suda_union）
LEGACY_DB_URL=jdbc:mysql://127.0.0.1:3306/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false
LEGACY_DB_USER=wxcheckin_app
LEGACY_DB_PASSWORD=请填真实数据库密码

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# 安全参数（生产必须替换）
# - 仍沿用历史环境变量名 `QR_SIGNING_KEY`，但用途已切换为“动态 6 位码生成与验码”。
QR_SIGNING_KEY=请填32字节以上强随机密钥
QR_REPLAY_TTL_SECONDS=90
QR_REPLAY_GUARD_RETENTION_SECONDS=0
QR_CLEANUP_ENABLED=true
QR_CLEANUP_INTERVAL_MS=300000
SESSION_TTL_SECONDS=7200

# Web 身份（账号密码）
# - 默认密码固定为 123
# - 首次登录必须修改密码
# - 不再需要配置 WEBAUTHN_*（Passkey/WebAuthn 已从主链路移除）

# 同步（生产必须开启，否则会被启动安全护栏直接拒绝）
LEGACY_SYNC_ENABLED=true
LEGACY_SYNC_INTERVAL_MS=2000
OUTBOX_RELAY_ENABLED=true
OUTBOX_RELAY_INTERVAL_MS=1000

# Flyway baseline 兜底（极端情况下使用）
# WXAPP_FLYWAY_BASELINE_OVERRIDE=11
```

仓库内也提供了同等语义的模板文件：`backend/.env.prod.example`（不含真实值，可复制为 `backend/.env.prod`），并提供了一个“后端一键启动（prod）”脚本用于单机演示/排障：

```bash
cd /path/to/wxapp-checkin
cp backend/.env.prod.example backend/.env.prod
./scripts/prod-backend.sh
```

> 生产正式部署仍推荐 systemd（环境变量放 `/etc/wxcheckin/backend.prod.env`），避免把敏感配置留在代码目录。

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
>
> 当前仓库中的 compose 默认值已对齐 prod 安全护栏：双向同步默认开启，避免出现“文档照做却起不来”的情况。

## 3) 本地联调/验收（一键脚本）

> 提示：仓库根目录已提供“一键启动前后端”的统一入口：
>
> - `cd .. && ./scripts/bootstrap.sh`
> - `./scripts/dev.sh local` 或 `./scripts/dev.sh docker`
>
> 本节仍保留 `backend/scripts/*.sh` 的说明，便于排障与理解测试环境行为。

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
export WXAPP_CHECKIN_TEST_MODE=1
./scripts/start-test-env.sh
```

> 注意：该脚本会重置 legacy（`suda_union`）测试数据（drop + recreate），因此默认增加安全护栏，必须显式设置 `WXAPP_CHECKIN_TEST_MODE=1` 才允许运行（生产环境禁止）。

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
| 动态码 | `QR_SIGNING_KEY` | 动态码密钥（生产必须替换；**prod profile 会强制校验不可为空/不可用默认占位符**） |
| 动态码 | `QR_REPLAY_TTL_SECONDS` | 防重放键 TTL（秒），用于限制同一时段重复提交 |
| 动态码 | `QR_REPLAY_GUARD_RETENTION_SECONDS` | replay guard 额外保留秒数 |
| 动态码 | `QR_CLEANUP_ENABLED` `QR_CLEANUP_INTERVAL_MS` | 是否开启动态码相关表的定期清理任务/清理间隔（毫秒） |
| 会话 | `SESSION_TTL_SECONDS` | session 过期秒数 |
| 同步 | `LEGACY_SYNC_ENABLED` `LEGACY_SYNC_INTERVAL_MS` | legacy pull 同步开关与间隔 |
| 同步 | `OUTBOX_RELAY_ENABLED` `OUTBOX_RELAY_INTERVAL_MS` | outbox relay 开关与间隔 |
| 注册 | `REGISTER_PAYLOAD_VERIFY_ENABLED` | 历史占位配置，当前 Web-only 主链路不再使用 |

补充说明：

- 动态码的 time slice 固定为 **10 秒**（与 `docs/REQUIREMENTS.md`、`docs/API_SPEC.md` 一致），不再通过环境变量调整。

## 5) 共域部署与动态码运维补充

### 5.1 与 `suda-gs-ams` / `suda_union` 共域时的路由建议

- `suda_union` 当前真实 controller 仍是 `/activity`、`/user`、`/session`、`/department`、`/suda_login`、`/token` 等旧前缀，不直接占用 `/api/web/**`。
- 真正的冲突点不在 controller 名字，而在“同域网关怎么分流”：
  - `suda-gs-ams` 当前大量依赖通用 `/api/*`
  - `wxapp-checkin` 正式接口走 `/api/web/**`
- 若同域共存，请至少满足以下一条：
  - 网关先匹配 `/api/web/` 再匹配通用 `/api/`
  - 或者前端改用独立外部前缀（例如 `VITE_API_BASE_PATH=/checkin-api/web`），再把它转发/重写到本服务的 `/api/web/**`
- 前端静态资源建议同时挂在独立子路径（例如 `/checkin/`），避免与另一个 SPA 共享 `/` 和 `/login`。

补充说明（当前 Web-only 正式链路）：

- 已不再写入 `wx_qr_issue_log`，也不再接收/解析 `qr_payload`（二维码扫码链路已删除）。
- `wx_replay_guard` 仍用于动态码防重放（同一用户 + 活动 + 动作 + slot 防重复提交），建议保留定期清理任务。

### 5.2 生产推荐配置（强烈建议）

```bash
# 必须：设置强随机密钥（多实例必须一致）
QR_SIGNING_KEY=<32字节以上强随机密钥>

# 推荐：防重放 TTL（秒）
QR_REPLAY_TTL_SECONDS=90

# 保留与清理（按实际审计需求调整）
QR_REPLAY_GUARD_RETENTION_SECONDS=0
QR_CLEANUP_ENABLED=true
QR_CLEANUP_INTERVAL_MS=300000
```

### 5.3 数据库升级（索引与清理性能）

生产 profile 默认启用 Flyway 自动迁移（`application-prod.yml`），通常无需手工执行 SQL。

仓库仍保留了历史迁移 `V5__add_qr_retention_indexes.sql`（为 legacy `wx_qr_issue_log` 补索引），
主要用于排障/回溯历史数据；当前 Web-only 动态码主链路不依赖该表。

### 5.4 运维注意事项

- **多实例部署**：所有实例必须使用同一个 `QR_SIGNING_KEY`，否则管理员看到的动态码可能无法在另一实例上通过校验（`invalid_code`）。
- **密钥轮换**：轮换 `QR_SIGNING_KEY` 会导致动态码立即变化。建议在低峰期轮换，并确保管理员页刷新出新码后再继续对外放行。

## 6) 前端如何连接与发布

手机 Web 前端默认通过同源 `/api/web/**` 访问后端；若本地分开启动，请在 `web/` 的开发配置中指向当前后端地址。会话凭据统一由前端请求层注入：`Authorization: Bearer <session_token>`。

完整的 Web 打包命令、`web/dist` 托管方式和 Nginx / 网关示例，统一见：`../docs/DEPLOYMENT.md`。
