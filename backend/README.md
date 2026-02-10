# wxapp-checkin 后端服务

微信小程序活动签到平台后端（Java / Spring Boot）。

## 技术栈
- Java 17
- Spring Boot 3.5
- Spring Web + Validation + Data JPA
- Flyway 数据库迁移
- MySQL 8
- Redis 7

## 目录说明
- `src/main/java`：业务代码
- `src/main/resources/db/migration`：Flyway SQL 迁移脚本
- `src/test/java`：自动化测试
- `scripts/`：本地开发脚本（Linux 优先，附 PowerShell 版本）

## 本地运行（Linux/macOS）
1. 启动依赖服务：
```bash
docker compose up -d mysql redis
```
2. 启动后端：
```bash
chmod +x scripts/*.sh
./scripts/start-dev.sh
```

## 本地运行（Windows PowerShell）
1. 启动依赖服务：
```powershell
docker compose up -d mysql redis
```
2. 启动后端：
```powershell
.\scripts\start-dev.ps1
```

## 运行测试
- Linux/macOS：
```bash
chmod +x scripts/*.sh
./scripts/run-tests.sh
```
- Windows PowerShell：
```powershell
.\scripts\run-tests.ps1
```

## 容器方式运行
```bash
docker compose up --build
```

默认暴露地址：`http://localhost:8080`

## 关键环境变量
- `SPRING_PROFILES_ACTIVE`：运行环境（`dev` / `prod`）
- `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`：MySQL 连接
- `LEGACY_DB_URL`、`LEGACY_DB_USER`、`LEGACY_DB_PASSWORD`、`LEGACY_DB_DRIVER`：Web 管理系统主库（`suda_union`）连接（默认同机同 MySQL）
- `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`：Redis 连接
- `QR_SIGNING_KEY`：二维码 payload 服务端签名密钥（生产环境必须替换）
- `WECHAT_API_ENABLED`：是否启用真实微信接口调用
- `WECHAT_APPID`、`WECHAT_SECRET`：微信配置
- `LEGACY_SYNC_ENABLED`：是否启用“`suda_union` -> 扩展库”拉取同步
- `OUTBOX_RELAY_ENABLED`：是否启用“扩展库 -> `suda_union`”回写同步

## 数据库策略
- `suda_union` 是 Web 管理系统**在用主库**，不是废弃库。
- 保持 `suda_union.sql` 主表结构不改动。
- 小程序后端业务表使用独立扩展库（`wx_*`）方案，与主库解耦。
- `wx_user_auth_ext` 中包含 `wx_token` 字段（`VARCHAR(255)`）。
- 通过双向同步保持一致：
  - `suda_union -> 扩展库`（活动/报名状态拉取）
  - `扩展库 -> suda_union`（签到签退结果回写）

### 生产环境（必须遵守）
1. `SPRING_PROFILES_ACTIVE=prod`
2. 主库 `DB_NAME` 指向**新扩展库**（建议：`wxcheckin_ext`），不要指向 `suda_union`
3. `LEGACY_DB_URL` 指向 `suda_union`（建议与扩展库同一 MySQL 实例，仅 schema 不同）
4. `prod` 配置下：
   - `LEGACY_SYNC_ENABLED=true`
   - `OUTBOX_RELAY_ENABLED=true`
   - 默认轮询周期：`LEGACY_SYNC_INTERVAL_MS=2000`、`OUTBOX_RELAY_INTERVAL_MS=1000`
   - `spring.jpa.hibernate.ddl-auto=none`
   - `spring.flyway.enabled=false`
   - 启动时不会自动建表/改表/迁移

### 测试或联调环境（允许）
- 可以使用 `dev` / `test` 进行本地验证。
- 当暂时拿不到正式 `suda_union.sql` 时，可先只准备扩展库并关闭同步开关。
- 需要验证同步时，再补充 `LEGACY_DB_URL` 指向可用的 `suda_union` 实例（或临时自建同结构表）。

## 安全说明（兼容接口）
- `GET /api/checkin/records/{record_id}` 需要有效 `session_token`，并且仅允许访问当前会话用户自己的记录详情。
