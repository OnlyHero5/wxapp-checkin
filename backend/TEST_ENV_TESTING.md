# 后端测试一键脚本说明（Linux）

> 说明：本文档描述的是当前 `backend/scripts/*.sh` 测试环境脚本与历史联调口径，主要用于迁移期运维和排障参考，不是手机 Web 正式接入文档。正式产品基线请阅读 `../docs/REQUIREMENTS.md`、`../docs/FUNCTIONAL_SPEC.md`、`../docs/API_SPEC.md`。

本文档说明 `backend/scripts/start-test-env.sh` 与 `backend/scripts/reset-suda-union-test-data.sh` 的作用与用法。

## 1. 脚本作用

### `scripts/start-test-env.sh`
- 一键加载测试环境变量（默认 `~/.wxapp-checkin-test-env.sh`）。
- 自动设置测试运行参数：
  - `SPRING_PROFILES_ACTIVE=dev`
  - `SERVER_PORT=9989`
  - `LEGACY_SYNC_ENABLED=true`
  - `LEGACY_SYNC_INTERVAL_MS=2000`
  - `OUTBOX_RELAY_ENABLED=true`
  - `OUTBOX_RELAY_INTERVAL_MS=2000`
- **每次启动前强制执行** `scripts/reset-suda-union-test-data.sh`，覆盖测试数据。
- 每次启动前还会清空扩展库中的 Web 身份与关联测试数据（确保“新一轮测试从全新账号密码态开始”）：
  - `wx_user_auth_ext`
  - `wx_session`
  - `wx_user_activity_status`
  - `wx_checkin_event`
  - `wx_qr_issue_log`
  - `wx_replay_guard`
  - `wx_sync_outbox`
- 如果 `9989` 端口被旧的本项目后端进程占用，会先自动停止旧进程后再启动新实例。
- 最后调用 `scripts/start-dev.sh` 启动后端。

### `scripts/reset-suda-union-test-data.sh`
- 连接测试 MySQL（读取 `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD`）。
- 重建/清空并写入 `suda_union` 下测试表数据：
  - `suda_user`
  - `suda_activity`
  - `suda_activity_apply`
- 覆盖场景包括：
  - 管理员候选、普通用户
  - 活动进行中/已结束
  - 已报名未签到、已签到未签退、已签退、取消报名
- 如果扩展库 `wx_admin_roster` 已存在，自动写入管理员白名单（`2025000007 刘洋`、`2025000008 王敏`）。

## 2. 使用方式

在项目根目录执行：

```bash
cd /path/to/wxapp-checkin/backend
chmod +x scripts/start-test-env.sh scripts/reset-suda-union-test-data.sh
./scripts/start-test-env.sh
```

启动成功后可检查：

```bash
curl http://127.0.0.1:9989/actuator/health
```

返回 `{"status":"UP"...}` 即正常。

## 3. 前端联调口径

当前唯一正式前端是 `web/`：

- Vite 开发服务器默认地址：`http://127.0.0.1:5173`
- 默认代理目标：`http://127.0.0.1:9989`
- 正式接口前缀：`/api/web/**`

联调步骤：

1. 执行 `./scripts/start-test-env.sh`
2. 在 `../web` 执行 `npm run dev`
3. 直接访问 `http://127.0.0.1:5173`

注意：

- 不再存在历史小程序 `baseUrl` 配置入口。
- 如果你改了后端端口，请同步修改 `web/.env.local` 中的 `VITE_API_PROXY_TARGET`。

## 4. 测试账号（学号 + 初始密码）

说明：

- 登录账号口径统一为学号 `student_id`。
- 初始密码固定为 `123`；首次登录成功后必须修改密码。

### 管理员测试账号（应为 `staff`）
- 初始密码：`123`
- `2025000007` / `刘洋`
- `2025000008` / `王敏`

### 普通用户测试账号（应为 `normal`）
- 初始密码：`123`
- `2025000101` / `张三`
- `2025000102` / `李四`
- `2025000103` / `王五`
- `2025000104` / `赵六`
- `2025000105` / `孙七`
- `2025000106` / `周八`
- `2025000107` / `吴九`

## 5. 注意事项

- 本脚本仅用于测试/联调环境，禁止用于生产环境。
- 每次执行 `start-test-env.sh` 都会覆盖 `suda_union` 测试数据，请勿在该库保存手工数据。
- 每次执行 `start-test-env.sh` 都会重置扩展库中的 Web 身份与会话数据（包括 `wx_user_auth_ext`、`wx_session`），因此你的改密记录也会被清空。
- 当前项目正式登录流程是“学号 + 密码（默认 123，首次登录强制改密）+ session_token”；不再依赖 Passkey/WebAuthn，也不再要求浏览器唯一绑定。
