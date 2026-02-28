# 后端测试一键脚本说明（Linux）

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
- 每次启动前还会清空扩展库中的微信身份绑定及关联测试数据（确保“新一轮测试从未绑定状态开始”）：
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

## 3. 前端联调 baseURL

- 前端 `baseUrl` 使用：`http://127.0.0.1:9989`
- 注意：前端请求代码会自动拼接 `/api/...`，`baseUrl` 不要再额外加 `/api`。

## 4. 测试账号（学号 + 姓名）

### 管理员测试账号（注册后应为 `staff`）
- `2025000007` / `刘洋`
- `2025000008` / `王敏`

### 普通用户测试账号（注册后应为 `normal`）
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
- 每次执行 `start-test-env.sh` 也会重置微信身份绑定；同一次脚本启动后的测试过程会保留你当次绑定数据。
- 当前项目登录流程是“微信登录 + 学号姓名绑定”，不是“账号密码登录”。
