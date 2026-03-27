# wxapp-checkin 部署手册

更新日期：2026-03-27  
适用范围：`wxapp-checkin` 当前正式形态（`web/ + backend-rust/ + suda_union`）

## 1. 部署目标

把手机 Web 前端和 Rust 后端部署到一台机器上，并完成最小验收。

## 2. 当前正式部署口径

- 前端：`web/dist`
- 后端：`backend-rust/target/release/wxapp-checkin-backend-rust`
- 数据库：`suda_union`

本文件只描述当前正式部署口径；历史目录、历史运行链路和一次性迁移脚本不再作为当前事实来源。

## 3. 前置依赖

- Rust stable（仅构建机需要，仓库已通过 `backend-rust/rust-toolchain.toml` 固定）
- Node.js + npm
- MySQL 8
- Nginx（或等价静态资源 / 反向代理）

如果你准备直接走当前推荐的云服务器 Docker 方案，还需要：

- Docker / Docker Compose Plugin
- 与 `suda-union` 容器互通的 Docker 网络（脚本会自动创建默认网络）

## 4. 构建

### 4.1 构建后端

```bash
cd /path/to/wxapp-checkin/backend-rust
cargo test
cargo build --release
```

产物：

- `backend-rust/target/release/wxapp-checkin-backend-rust`

### 4.2 构建前端

```bash
cd /path/to/wxapp-checkin/web
npm install
npm test
npm run lint
VITE_APP_BASE_PATH=/checkin/ \
VITE_API_BASE_PATH=/checkin-api/web \
npm run build
```

产物：

- `web/dist/`

## 5. 后端环境变量

推荐文件：

- `/etc/wxcheckin/backend-rust.prod.env`

最小示例：

```bash
DATABASE_URL=mysql://wxcheckin_app:replace-password@suda-union:3499/suda_union
SERVER_PORT=8080
SESSION_TTL_SECONDS=7200
QR_SIGNING_KEY=replace-this-before-prod
TOKIO_WORKER_THREADS=2
MYSQL_MAX_CONNECTIONS=4
```

说明：

- `suda-union:3499` 是当前三容器 / 云服务器口径下的数据库入口
- 如果数据库账号、密码有变动，优先改 `DATABASE_URL` 或 `.env.docker` 中的拆分字段

## 6. 云服务器 Docker 一键部署

先准备配置文件：

```bash
cd /path/to/wxapp-checkin
cp .env.docker.example .env.docker
```

然后编辑 `.env.docker`，至少填好：

- `SUDA_UNION_DB_HOST`
- `SUDA_UNION_DB_PORT=3499`
- `SUDA_UNION_DB_USER`
- `SUDA_UNION_DB_PASSWORD`
- `WXAPP_QR_SIGNING_KEY`

其中 `WXAPP_QR_SIGNING_KEY` 可以直接参考 `.env.docker.example` 里的 Python 3 生成命令；示例文件里也附了一条实际生成结果，便于你核对格式。

最后执行：

```bash
./scripts/docker-prod.sh
```

部署脚本会自动完成：

- 校验 `.env.docker` 是否存在且关键字段不为空
- 若默认 Docker 网络不存在则自动创建
- `docker compose --env-file .env.docker up -d --build wxapp-checkin`
- 容器日志走 `docker logs`，并按 `5m * 2` 的默认滚动上限做保留控制

启动后可用以下命令追日志：

```bash
docker logs -f wxapp-checkin
```

预期终端标识：

- 紫色 `[WXAPP-CHECKIN-OK]`：已连上 `suda_union`、已成功读取所有需要的表、HTTP 监听成功
- 蓝色 `[WXAPP-CHECKIN-ERROR]`：明确指出失败阶段、失败对象和原始错误原因

说明：

- 容器内不再额外写 `/var/log` 文本日志文件，避免有限磁盘空间被重复日志占用
- 如需进一步压缩日志保留量，可在 `.env.docker` 调小 `WXAPP_DOCKER_LOG_MAX_SIZE` 与 `WXAPP_DOCKER_LOG_MAX_FILE`

## 7. 启动后端

```bash
cd /path/to/wxapp-checkin
./scripts/prod-backend.sh
```

最小健康检查：

```bash
curl http://127.0.0.1:8080/actuator/health
```

预期：

```json
{"status":"UP"}
```

## 8. 发布前端

示例：

```bash
sudo mkdir -p /var/www/wxapp-checkin/checkin
sudo rsync -av --delete /path/to/wxapp-checkin/web/dist/ /var/www/wxapp-checkin/checkin/
```

## 9. Nginx 示例

```nginx
server {
  listen 80;
  server_name _;

  location /checkin/ {
    alias /var/www/wxapp-checkin/checkin/;
    try_files $uri $uri/ /checkin/index.html;
  }

  location /checkin-api/web/ {
    proxy_pass http://127.0.0.1:8080/api/web/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 10. 最小验收

```bash
curl http://127.0.0.1:8080/actuator/health
curl -I http://<your-host>/checkin/
```

再手工确认：

- 登录
- 活动列表
- 详情
- staff 发码
- 普通用户签到 / 签退
- roster
- 名单修正
- 批量签退
