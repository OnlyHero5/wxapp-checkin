# 手机 Web 动态验证码签到平台

`wxapp-checkin` 当前正式基线已经收口为：

- 手机浏览器 Web 前端：`web/`
- Rust 后端：`backend-rust/`
- 唯一数据库：`suda_union`

当前正式基线不再保留：

- 微信小程序 `frontend/`
- Java `backend/`
- `wxcheckin_ext`
- `wx_*` 逻辑表
- `/api/web/auth/change-password`
- Docker Compose 作为默认发布入口

## 目录

| 路径 | 说明 |
| --- | --- |
| `web/` | 唯一正式前端 |
| `backend-rust/` | 唯一正式后端 |
| `docs/` | 正式需求、功能、接口、部署文档 |
| `scripts/` | bootstrap、启动、停止脚本 |

## 当前正式能力

- `POST /api/web/auth/login`：账号密码登录
- `GET /api/web/activities`：活动列表
- `GET /api/web/activities/{activity_id}`：活动详情
- `GET /api/web/activities/{activity_id}/code-session`：staff 动态码
- `POST /api/web/activities/{activity_id}/code-consume`：普通用户签到 / 签退
- `GET /api/web/staff/activities/{activity_id}/roster`：参会名单
- `POST /api/web/staff/activities/{activity_id}/attendance-adjustments`：名单修正
- `POST /api/web/staff/activities/{activity_id}/bulk-checkout`：批量签退

## 快速开始

先生成本地配置：

```bash
cd wxapp-checkin
./scripts/bootstrap.sh
```

本地联调：

```bash
./scripts/dev.sh local
```

最小自检：

```bash
curl http://127.0.0.1:9989/actuator/health
curl http://127.0.0.1:5173/
```

停止：

```bash
./scripts/stop.sh
```

## 本地依赖

- Rust stable（`backend-rust/rust-toolchain.toml` 已固定工具链）
- Node.js + npm
- MySQL 8（只需要 `suda_union`）
- `mysql` CLI
- `curl`

## 推荐验证命令

```bash
cd web
npm test
npm run lint
npm run build

cd ../backend-rust
cargo test
cargo build --release
```

## 生产部署

构建 release：

```bash
cd backend-rust
cargo build --release
```

然后回仓库根目录启动：

```bash
cd ..
./scripts/prod-backend.sh
```

生产环境变量默认读取顺序：

1. `WXAPP_PROD_ENV_FILE`
2. `/etc/wxcheckin/backend-rust.prod.env`
3. `backend-rust/.env.prod`

更多部署细节见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 正式文档

- 需求基线：[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- 功能基线：[docs/FUNCTIONAL_SPEC.md](docs/FUNCTIONAL_SPEC.md)
- 接口基线：[docs/API_SPEC.md](docs/API_SPEC.md)
- 部署手册：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Rust 兼容清单：[docs/plans/2026-03-25-rust-api-compat-checklist.md](docs/plans/2026-03-25-rust-api-compat-checklist.md)
