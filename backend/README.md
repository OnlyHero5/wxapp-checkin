# wxapp-checkin 后端服务

微信小程序活动签到平台后端（Java / Spring Boot）。

## 目录说明
- `src/main/java`：业务代码
- `src/main/resources/db/migration`：Flyway SQL 迁移脚本
- `src/test/java`：自动化测试
- `scripts/`：启动、测试、测试数据重置脚本

## 1. 必装软件（交付给别人时先确认）

Linux 环境建议最低版本：
- Java 17（必须）
- MySQL 8（必须）
- Redis 7（必须）
- Bash（必须）
- Docker + Docker Compose v2（可选，用于容器方式）

可用下面命令快速检查：

```bash
java -version
mysql --version
redis-cli --version
```

## 2. 数据库与账号初始化（MySQL）

后端使用两个 schema：
- `wxcheckin_ext`：小程序扩展库（后端主写）
- `suda_union`：遗留主库（同步读取/回写）

先用 MySQL 管理员执行以下 SQL（账号密码请按你自己的环境改）：

```sql
CREATE DATABASE IF NOT EXISTS wxcheckin_ext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS suda_union CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'wxcheckin'@'%' IDENTIFIED BY 'wxcheckin_test';
GRANT ALL PRIVILEGES ON wxcheckin_ext.* TO 'wxcheckin'@'%';
GRANT ALL PRIVILEGES ON suda_union.* TO 'wxcheckin'@'%';
FLUSH PRIVILEGES;
```

## 3. 环境变量文件（账号密码填这里）

项目脚本默认读取：`~/.wxapp-checkin-test-env.sh`

创建示例（把主机、端口、用户名、密码改成你的）：

```bash
cat > ~/.wxapp-checkin-test-env.sh <<'EOF'
# Java
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"

# 扩展库连接（spring.datasource.*）
export DB_HOST=127.0.0.1
export DB_PORT=3307
export DB_NAME=wxcheckin_ext
export DB_USER=wxcheckin
export DB_PASSWORD=wxcheckin_test

# Redis 连接（spring.data.redis.*）
export REDIS_HOST=127.0.0.1
export REDIS_PORT=16379
export REDIS_PASSWORD=

# 遗留库连接（app.legacy.datasource.*）
export LEGACY_DB_URL="jdbc:mysql://127.0.0.1:3307/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false"
export LEGACY_DB_USER=wxcheckin
export LEGACY_DB_PASSWORD=wxcheckin_test
EOF
```

生效方式：

```bash
source ~/.wxapp-checkin-test-env.sh
```

如果你不用默认路径，也可以改用：
- `WXAPP_TEST_ENV_FILE=/path/to/your-env.sh`

## 4. 启动方式

### 4.1 普通开发启动

```bash
cd /path/to/wxapp-checkin/backend
source ~/.wxapp-checkin-test-env.sh
./scripts/start-dev.sh
```

默认端口来自 `SERVER_PORT`，未设置时为 `8080`。

### 4.2 一键测试启动（推荐联调）

```bash
cd /path/to/wxapp-checkin/backend
./scripts/start-test-env.sh
```

`start-test-env.sh` 会自动：
1. 设置测试运行参数（`dev`、`1455`、同步开关）
2. 覆写 `suda_union` 测试数据
3. 清空微信身份绑定与会话等测试数据（新一轮测试从“未绑定”开始）
4. 启动后端

详细行为见：`backend/TEST_ENV_TESTING.md`

## 5. 启动后验证

```bash
curl http://127.0.0.1:1455/actuator/health
```

返回 `{"status":"UP"...}` 即启动成功。

## 6. 前端联调配置

前端 `baseUrl` 填后端地址，不要带 `/api`。例如：

```text
http://127.0.0.1:1455
```

若真机需要局域网访问，请额外做端口暴露（VS Code Public/all interfaces 或 Windows `portproxy + firewall`）。

## 7. 关键环境变量对照表

- `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`：扩展库连接（账号密码重点）
- `LEGACY_DB_URL/LEGACY_DB_USER/LEGACY_DB_PASSWORD`：`suda_union` 连接（账号密码重点）
- `REDIS_HOST/REDIS_PORT/REDIS_PASSWORD`：Redis 连接
- `SPRING_PROFILES_ACTIVE`：`dev`/`prod`
- `SERVER_PORT`：服务端口（测试默认 `1455`）
- `LEGACY_SYNC_ENABLED`：是否启用 `suda_union -> 扩展库` 同步
- `OUTBOX_RELAY_ENABLED`：是否启用扩展库 -> `suda_union` 回写
- `WECHAT_API_ENABLED`、`WECHAT_APPID`、`WECHAT_SECRET`：微信真实接口配置
- `QR_SIGNING_KEY`：二维码签名密钥（生产必须替换）

## 8. 生产环境注意事项

1. `SPRING_PROFILES_ACTIVE=prod`
2. `DB_NAME` 必须指向扩展库（例如 `wxcheckin_ext`），不要指向 `suda_union`
3. `LEGACY_DB_URL` 指向 `suda_union`
4. 生产下遵守“扩展库与遗留库分离 + 双向同步”策略

## 9. 安全说明

- `GET /api/checkin/records/{record_id}` 需要有效 `session_token`，并且仅允许访问当前会话用户自己的记录详情。
