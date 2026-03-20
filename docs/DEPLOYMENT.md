# wxapp-checkin 部署手册

更新日期：2026-03-20  
适用范围：`wxapp-checkin` 当前正式 Web-only 形态（`web/ + backend/ + /api/web/**`）

## 1. 这份文档解决什么问题

这份手册只回答一件事：第一次接手项目的人，如何把 **后端 API + 手机 Web 前端** 一起部署起来，并完成最小验收。

如果你只想本地联调，请先看：

- 根 `README.md` 的“一键启动（推荐）”
- `backend/README.md` 的“本地联调/验收（一键脚本）”

## 2. 部署场景选择

| 场景 | 推荐入口 | 说明 |
| --- | --- | --- |
| 本地开发联调 | 根 `README.md` | `./scripts/dev.sh local` / `docker`，适合开发与回归 |
| 单机演示 | `backend/README.md` 第 2 节 | Docker Compose，快速拉起 MySQL + Redis + Backend |
| 正式发布 | 本文第 3 节 | 推荐后端 systemd + 前端静态资源托管 + 网关/反向代理 |

## 3. 推荐生产部署口径

推荐形态：

- 后端：Java 17 + systemd
- 前端：`web/dist` 静态资源托管到 Nginx（或等价静态资源服务）
- 对外路径：
  - 前端：`/checkin/`
  - API：`/checkin-api/web`

这样做的原因很直接：

- 避免和 `suda-gs-ams` 的 `/`、`/login` 路由冲突
- 避免让 `wxapp-checkin` 的 `/api/web/**` 被更宽的 `/api/*` 规则误吞
- 前后端部署边界清晰，排障更直接

### 3.1 前置依赖

至少准备：

- Java 17
- Node.js + npm
- MySQL 8
- Redis 7
- Nginx（或等价静态资源/网关方案）

### 3.2 构建后端

```bash
cd /path/to/wxapp-checkin/backend
./mvnw -DskipTests clean package
```

产物默认位于：

- `backend/target/backend-0.0.1-SNAPSHOT.jar`

### 3.3 配置并启动后端

后端环境变量、systemd 服务文件与安全护栏说明，统一按 `backend/README.md` 第 1 节执行。

至少要确认这几项：

- `SPRING_PROFILES_ACTIVE=prod`
- `LEGACY_DB_URL` 指向 `suda_union`
- `LEGACY_SYNC_ENABLED=true`
- `OUTBOX_RELAY_ENABLED=true`
- `QR_SIGNING_KEY` 已替换为真实强随机密钥

启动成功后先做健康检查：

```bash
curl http://127.0.0.1:8080/actuator/health
```

### 3.4 构建前端

推荐把前端发布到独立子路径 `/checkin/`，并让 API 走 `/checkin-api/web`：

```bash
cd /path/to/wxapp-checkin/web
npm install
VITE_APP_BASE_PATH=/checkin/ \
VITE_API_BASE_PATH=/checkin-api/web \
npm run build
```

构建完成后，静态产物位于：

- `web/dist/`

### 3.5 发布 `web/dist`

示例：把构建产物发布到服务器目录 `/var/www/wxapp-checkin/checkin/`

```bash
sudo mkdir -p /var/www/wxapp-checkin/checkin
sudo rsync -av --delete /path/to/wxapp-checkin/web/dist/ /var/www/wxapp-checkin/checkin/
```

### 3.6 Nginx 示例

下面给一份最小可用示例，核心目的是：

- `/checkin/` 返回前端静态资源
- `/checkin-api/web/` 反代到后端的 `/api/web/`

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

如果你坚持让前端直接走 `/api/web/**`，也可以，但要确保：

- 网关先匹配 `wxapp-checkin` 的 `/api/web/`
- 再匹配 `suda-gs-ams` / `suda_union` 的通用 `/api/`

### 3.7 最小验收

部署完成后，至少先验证下面 2 项：

```bash
curl http://127.0.0.1:8080/actuator/health
curl -I http://<your-host>/checkin/
```

你还应该在手机浏览器里人工确认：

- `/checkin/` 能正常打开登录页
- 登录后能进入活动页
- `must_change_password=true` 的账号会被正确拦到改密页
- 管理员页能拉到动态码与统计

## 4. 常见坑

- 只部署了后端，没有发布 `web/dist`
  - 结果：健康检查是好的，但手机打开页面仍是 404
- 把前端放在 `/`，同时又和 `suda-gs-ams` 共域
  - 结果：两个 SPA 的 `/login` / `/` 容易互相覆盖
- `prod` 下把 `LEGACY_SYNC_ENABLED` 或 `OUTBOX_RELAY_ENABLED` 设成 `false`
  - 结果：后端会被安全护栏拒绝启动
- 本地联调误用 `./scripts/dev.sh local`
  - 结果：当前不会再重置数据库，但该入口只允许 loopback 数据库地址；如果你需要远程排障，请改用更显式的手动启动方式
