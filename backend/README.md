# wxapp-checkin 后端部署与测试指南

这份文档面向第一次接手项目的人，目标是回答三件事：
1. 要装哪些软件
2. 数据库/Redis 账号密码到底填在哪里
3. 如何本地测试、如何真实生产部署

## 0. 目录结构
- `scripts/start-test-env.sh`：一键测试启动（会重置测试数据）
- `scripts/reset-suda-union-test-data.sh`：只重置 `suda_union` 测试数据
- `scripts/bootstrap-prod-schema.sql`：生产扩展库建表脚本（不含演示数据）
- `scripts/start-dev.sh`：普通开发启动
- `src/main/resources/application.yml`：基础配置
- `src/main/resources/application-prod.yml`：生产覆盖配置

## 1. 依赖软件（必须）

Linux 服务器或开发机至少需要：
- Java 17
- MySQL 8
- Redis 7
- Bash

可选：
- Maven（如果用 `./mvnw`，无需全局安装）
- Docker + Compose（仅容器方案需要）

快速检查：

```bash
java -version
mysql --version
redis-cli --version
```

## 2. 账号密码和连接信息填哪里

后端读取环境变量，不是写死在代码里。  
推荐放在一个环境文件里，比如：
- 测试环境：`~/.wxapp-checkin-test-env.sh`
- 生产环境：`/etc/wxcheckin/backend.prod.env`

关键变量（你最关心的账号密码）：
- MySQL 扩展库：`DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD`
- MySQL 遗留库：`LEGACY_DB_URL` `LEGACY_DB_USER` `LEGACY_DB_PASSWORD`
- Redis：`REDIS_HOST` `REDIS_PORT` `REDIS_PASSWORD`

## 3. 本地测试（给联调/验收）

### 3.1 先创建 MySQL 库和用户

用 MySQL 管理员执行：

```sql
CREATE DATABASE IF NOT EXISTS wxcheckin_ext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS suda_union CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'wxcheckin'@'%' IDENTIFIED BY 'wxcheckin_test';
GRANT ALL PRIVILEGES ON wxcheckin_ext.* TO 'wxcheckin'@'%';
GRANT ALL PRIVILEGES ON suda_union.* TO 'wxcheckin'@'%';
FLUSH PRIVILEGES;
```

### 3.2 写测试环境变量文件

```bash
cat > ~/.wxapp-checkin-test-env.sh <<'EOF'
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"

export DB_HOST=127.0.0.1
export DB_PORT=3307
export DB_NAME=wxcheckin_ext
export DB_USER=wxcheckin
export DB_PASSWORD=wxcheckin_test

export REDIS_HOST=127.0.0.1
export REDIS_PORT=16379
export REDIS_PASSWORD=

export LEGACY_DB_URL="jdbc:mysql://127.0.0.1:3307/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false"
export LEGACY_DB_USER=wxcheckin
export LEGACY_DB_PASSWORD=wxcheckin_test
EOF
```

### 3.3 一键启动测试后端

```bash
cd /path/to/wxapp-checkin/backend
chmod +x scripts/*.sh
./scripts/start-test-env.sh
```

该脚本每次会自动：
1. 覆写 `suda_union` 测试数据
2. 清空微信身份绑定（`wx_user_auth_ext`、`wx_session` 等）
3. 启动后端（端口 `1455`）

健康检查：

```bash
curl http://127.0.0.1:1455/actuator/health
```

详细测试账号见：`backend/TEST_ENV_TESTING.md`

## 4. 生产环境部署（真实上线）

下面是最直接、可交付给小白执行的“单机 Linux + systemd”流程。

### 4.1 准备生产库和账号（MySQL）

建议创建独立应用账号（不要用 root）：

```sql
CREATE DATABASE IF NOT EXISTS wxcheckin_ext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- suda_union 通常已经存在于现网
-- 如果是新环境再建：
-- CREATE DATABASE IF NOT EXISTS suda_union CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'wxcheckin_app'@'%' IDENTIFIED BY '请替换为强密码';
GRANT SELECT,INSERT,UPDATE,DELETE ON wxcheckin_ext.* TO 'wxcheckin_app'@'%';
GRANT SELECT,INSERT,UPDATE,DELETE ON suda_union.* TO 'wxcheckin_app'@'%';
FLUSH PRIVILEGES;
```

### 4.2 初始化扩展库表结构（生产）

生产 profile 默认关闭 Flyway/DDL 自动建表，所以要手动初始化：

```bash
cd /path/to/wxapp-checkin/backend
mysql -h <DB_HOST> -P <DB_PORT> -u <DB_ADMIN_USER> -p wxcheckin_ext < scripts/bootstrap-prod-schema.sql
```

### 4.3 写生产环境变量文件（重点）

新建 `/etc/wxcheckin/backend.prod.env`：

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

# 业务安全参数（必须替换）
QR_SIGNING_KEY=请填32位以上随机强密钥
SESSION_TTL_SECONDS=7200

# 微信
WECHAT_API_ENABLED=true
WECHAT_APPID=请填微信小程序AppID
WECHAT_SECRET=请填微信小程序Secret

# 同步（生产建议开启）
LEGACY_SYNC_ENABLED=true
LEGACY_SYNC_INTERVAL_MS=2000
OUTBOX_RELAY_ENABLED=true
OUTBOX_RELAY_INTERVAL_MS=1000
```

生成强密钥示例：

```bash
openssl rand -hex 32
```

### 4.4 构建 Jar

```bash
cd /path/to/wxapp-checkin/backend
./mvnw -DskipTests clean package
```

产物：
- `target/backend-0.0.1-SNAPSHOT.jar`

### 4.5 使用 systemd 托管

创建 `/etc/systemd/system/wxcheckin-backend.service`：

```ini
[Unit]
Description=wxcheckin backend
After=network.target mysql.service redis.service

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

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable wxcheckin-backend
sudo systemctl start wxcheckin-backend
sudo systemctl status wxcheckin-backend
```

查看日志：

```bash
journalctl -u wxcheckin-backend -f
```

### 4.6 生产启动后检查

```bash
curl http://127.0.0.1:8080/actuator/health
```

返回 `{"status":"UP"...}` 表示服务正常。

## 5. 前端如何连接

前端 `baseUrl` 填后端地址，不要加 `/api`：

- 本机测试：`http://127.0.0.1:1455`
- 生产示例：`https://api.your-domain.com`（推荐挂 Nginx/HTTPS）

## 6. 真实生产最容易踩坑的点

1. `DB_NAME` 填成 `suda_union`（错误）：应填 `wxcheckin_ext`
2. 只配了 `DB_*`，没配 `LEGACY_DB_*`（会影响同步）
3. 忘了初始化扩展库表（prod 不会自动建表）
4. `QR_SIGNING_KEY` 沿用默认值（高风险）
5. Redis 连不上（`REDIS_HOST/PORT/PASSWORD` 配错）

## 7. 安全说明

- `GET /api/checkin/records/{record_id}` 需要有效 `session_token`，且只允许访问当前会话用户自己的记录详情。
