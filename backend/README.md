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
| 安全 | `QR_SIGNING_KEY` | 二维码签名密钥（生产必须替换） |
| 会话 | `SESSION_TTL_SECONDS` | session 过期秒数 |
| 微信 | `WECHAT_API_ENABLED` `WECHAT_APPID` `WECHAT_SECRET` | 微信登录换取 openid/session_key |
| 同步 | `LEGACY_SYNC_ENABLED` `LEGACY_SYNC_INTERVAL_MS` | legacy pull 同步开关与间隔 |
| 同步 | `OUTBOX_RELAY_ENABLED` `OUTBOX_RELAY_INTERVAL_MS` | outbox relay 开关与间隔 |
| 注册 | `REGISTER_PAYLOAD_VERIFY_ENABLED` | 是否校验注册载荷签名 |

## 5) 前端如何连接

前端 `baseUrl` 填后端地址，不要加 `/api`（见 `../frontend/README.md`）。
