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
- `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD`：Redis 连接
- `QR_SIGNING_KEY`：二维码 payload 服务端签名密钥（生产环境必须替换）
- `WECHAT_API_ENABLED`：是否启用真实微信接口调用
- `WECHAT_APPID`、`WECHAT_SECRET`：微信配置
- `LEGACY_SYNC_ENABLED`：是否启用“旧库 -> 扩展表”拉取同步
- `OUTBOX_RELAY_ENABLED`：是否启用 outbox 回写旧库

## 数据库策略
- 保持旧库表结构不改动。
- 通过 Flyway 管理扩展表（`wx_*`）。
- `wx_user_auth_ext` 中包含 `wx_token` 字段（`VARCHAR(255)`）。
- 同步任务默认关闭，由配置开关控制。

## 安全说明（兼容接口）
- `GET /api/checkin/records/{record_id}` 需要有效 `session_token`，并且仅允许访问当前会话用户自己的记录详情。
