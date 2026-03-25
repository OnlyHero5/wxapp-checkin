# wxapp-checkin 部署手册

更新日期：2026-03-25  
适用范围：`wxapp-checkin` 当前正式形态（`web/ + backend-rust/ + suda_union`）

## 1. 部署目标

把手机 Web 前端和 Rust 后端部署到一台机器上，并完成最小验收。

## 2. 当前正式部署口径

- 前端：`web/dist`
- 后端：`backend-rust/target/release/wxapp-checkin-backend-rust`
- 数据库：`suda_union`

不再作为正式口径：

- Java `backend/`
- `wxcheckin_ext`
- Docker Compose 默认全栈发布

## 3. 前置依赖

- Rust stable（仅构建机需要）
- Node.js + npm
- MySQL 8
- Nginx（或等价静态资源/反向代理）

## 4. 构建

### 4.1 构建后端

```bash
cd /path/to/wxapp-checkin/backend-rust
cargo build --release
```

产物：

- `backend-rust/target/release/wxapp-checkin-backend-rust`

### 4.2 构建前端

```bash
cd /path/to/wxapp-checkin/web
npm install
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
DATABASE_URL=mysql://wxcheckin_app:replace-password@127.0.0.1:3306/suda_union
SERVER_PORT=8080
SESSION_TTL_SECONDS=7200
QR_SIGNING_KEY=replace-this-before-prod
TOKIO_WORKER_THREADS=2
MYSQL_MAX_CONNECTIONS=4
```

## 6. 启动后端

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

## 7. 发布前端

示例：

```bash
sudo mkdir -p /var/www/wxapp-checkin/checkin
sudo rsync -av --delete /path/to/wxapp-checkin/web/dist/ /var/www/wxapp-checkin/checkin/
```

## 8. Nginx 示例

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

## 9. 最小验收

```bash
curl http://127.0.0.1:8080/actuator/health
curl -I http://<your-host>/checkin/
```

再手工确认：

- 登录
- 首次改密
- 活动列表
- 详情
- staff 发码
- 普通用户签到 / 签退
- roster
- 名单修正
- 批量签退
