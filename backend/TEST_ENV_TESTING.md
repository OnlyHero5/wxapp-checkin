# 后端本地联调环境说明（安全版）

> 说明：为避免仓库继续携带“可直接重建 `suda_union`”的危险能力，`wxapp-checkin/backend` 已移除所有 legacy 毁库脚本。本文档只说明当前仍保留的**安全本地启动方式**。

## 1. 当前保留的本地入口

### `scripts/start-test-env.sh`

作用：

- 加载 `backend/.env.test.local.sh`（可用 `WXAPP_TEST_ENV_FILE` 覆盖）。
- 默认补齐本地联调常用参数：
  - `SPRING_PROFILES_ACTIVE=dev`
  - `SERVER_PORT=9989`
  - `LEGACY_SYNC_ENABLED=true`
  - `LEGACY_SYNC_INTERVAL_MS=2000`
  - `OUTBOX_RELAY_ENABLED=true`
  - `OUTBOX_RELAY_INTERVAL_MS=2000`
- 如果 `9989` 端口已被本项目旧后端占用，会先停止旧实例再启动新实例。
- 最后调用 `scripts/start-dev.sh` 启动后端。

安全边界：

- **不会**重置 `suda_union`。
- **不会**清空 `wxcheckin_ext` 的业务数据。
- **不会**再执行任何跨项目数据库重建脚本。
- 只允许 loopback 数据库地址：
  - `DB_HOST` 必须是 `127.0.0.1` / `localhost` / `::1`
  - `LEGACY_DB_URL` 的 host 也必须是本机回环地址
- 若配置成远程数据库地址，脚本会直接拒绝执行，避免误把“本地联调入口”打到真实环境。

## 2. 使用方式

在项目根目录执行：

```bash
cd /path/to/wxapp-checkin
cp backend/scripts/test-env.example.sh backend/.env.test.local.sh
```

按你的本机 MySQL / Redis 实际情况修改 `backend/.env.test.local.sh` 后，再启动：

```bash
cd backend
chmod +x scripts/*.sh
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

- 本地直连模式不再内置“固定测试账号重置”。
- 你在 local 模式下看到的账号、活动与报名数据，取决于你本机数据库当前已有的内容。
- 如果你需要一套可随时丢弃、彼此隔离的演示数据，请优先使用 Docker Compose 模式。

## 4. 推荐的隔离演示方式

如果你的目标是“要一套随时可删的演示环境”，推荐走仓库根目录的一键入口：

```bash
cd /path/to/wxapp-checkin
./scripts/dev.sh docker
```

原因：

- Docker Compose 使用容器内 MySQL / Redis，默认不会碰你的本机数据库。
- 它更适合做演示、冒烟和一次性联调验证。
- 这样可以把“可丢弃的 demo 数据”和“你本机手工维护的数据”明确隔离开。

## 5. 维护约束

- 不要在 `wxapp-checkin/backend` 重新引入任何“重建 / 清空 / 覆盖 `suda_union`”的脚本。
- 若后续确实需要做 destructive 测试，应放在独立、显式、隔离的测试基础设施中，而不是留在当前业务仓库的默认启动链路里。
