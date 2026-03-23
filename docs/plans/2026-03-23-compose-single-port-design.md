# Docker Compose 单端口暴露设计

更新日期：2026-03-23
适用范围：`wxapp-checkin` 根 `docker-compose.yml` 的全栈部署入口

## 1. 目标

把当前全栈 Docker Compose 的宿主机暴露口收敛为单一入口：

- 宿主机只暴露 `89`
- `89` 仅映射到 `web:80`
- `backend`、`mysql`、`redis` 不再直接映射宿主机端口
- 容器间继续通过 Compose 默认网桥通信

## 2. 当前现状

根 `docker-compose.yml` 当前包含 4 个服务：

- `mysql`：未暴露宿主机端口
- `redis`：未暴露宿主机端口
- `backend`：暴露 `127.0.0.1:8080:8080`
- `web`：暴露 `8088:80`

其中 `web` 已通过 `web/docker/nginx.conf` 反代 `/api/web/**` 到 `http://backend:8080`，说明前后端之间已经具备容器内通信能力，不依赖宿主机 `8080`。

## 3. 方案对比

### 方案 A：仅收敛根 Compose 暴露端口（推荐）

- 删除 `backend` 的宿主机端口映射
- 把 `web` 的宿主机端口改为 `89:80`
- 保持 Compose 默认网络与现有 Nginx 反代逻辑不变

优点：

- 改动最小
- 风险最低
- 不影响现有容器内服务发现方式

缺点：

- 宿主机无法再直接访问 `127.0.0.1:8080/actuator/health`
- 后端健康检查需通过容器内命令或 Compose 状态确认

### 方案 B：显式声明自定义 network

- 在 Compose 中手动新增 `networks`
- 把全部服务挂到具名 bridge 网络

优点：

- 网络拓扑更显式

缺点：

- 对当前行为没有实际收益
- 增加了配置噪音

### 方案 C：新增独立网关容器，只暴露 89

- 保留 `web` 为静态资源容器
- 新增单独网关容器转发到 `web` / `backend`

优点：

- 未来更容易扩展 TLS、统一鉴权、限流

缺点：

- 明显超出当前需求
- 增加维护复杂度

## 4. 选型结论

采用方案 A。

理由：

- 用户目标只要求“整套容器对外仅暴露一个 89 端口”
- 现有 `web -> backend` 的容器内访问链路已经成立
- Compose 默认 bridge 网络已经满足“容器内部自己使用一个网桥”的要求

## 5. 具体设计

### 5.1 端口策略

- `web`：宿主机 `89 -> 容器 80`
- `backend`：取消 `ports`，仅保留容器内 `8080`
- `mysql`：继续不暴露
- `redis`：继续不暴露

### 5.2 容器通信

- 浏览器 -> `http://<host>:89/`
- `web` 容器 -> `http://backend:8080/api/web/**`
- `backend` 容器 -> `mysql:3306`
- `backend` 容器 -> `redis:6379`

### 5.3 验收口径

静态验收：

- `docker compose config` 里只允许出现 `published: "89"`
- 不应再出现 `published: "8080"`、`published: "8088"`、`published: "3306"`、`published: "6379"`

运行时验收：

- 宿主机 `curl -I http://127.0.0.1:89/` 可访问
- `docker compose exec backend curl -fsS http://127.0.0.1:8080/actuator/health` 成功

## 6. 影响范围

- `docker-compose.yml`
- `scripts/verify-docker-compose.sh`
- `README.md`
- `docs/DEPLOYMENT.md`

不修改：

- `backend/docker-compose.yml`

原因：

- 该文件服务于“仅后端 Docker Compose”排障/拆分部署场景
- 本次用户确认范围是根 Compose 的整站单端口收口

## 7. 风险与回退

主要风险：

- 依赖宿主机 `127.0.0.1:8080` 的旧验收手册或脚本会失效

对应处理：

- 同步更新仓库文档与静态校验脚本
- 验收命令统一改为 `89` 外部入口 + 容器内后端健康检查

回退方式：

- 恢复 `backend` 的 `127.0.0.1:8080:8080`
- 恢复 `web` 的 `8088:80`
