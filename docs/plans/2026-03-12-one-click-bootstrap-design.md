# wxapp-checkin 一键配置/一键启动（local + docker）设计

> 历史说明（2026-03-20）：本文中的 `start-test-env.sh` 行为描述已经过时；当前仓库的 local 启动入口不再重置任何数据库，只保留安全启动能力。

**目标**：把 `wxapp-checkin` 的本地联调与演示环境收敛成“开箱即用”的命令集，首次接手的人只需要一次 bootstrap，就能用一条命令启动（local 或 docker 两套均可）。

> 说明：本文档只覆盖“一键配置/一键启动”与相关脚本/文档收口，不改变现有业务逻辑与产品基线（Web-only）。

## 1. 背景与现状

当前仓库已经完成 Web-only 收口：

- `web/`：手机浏览器 Web 前端（Vite + React）
- `backend/`：Spring Boot 后端（正式入口 `/api/web/**`）
- 后端已有两套本地启动手段：
  - `backend/scripts/start-test-env.sh`（本机 MySQL/Redis，默认 `9989`，会重置联调测试数据）
  - `backend/docker-compose.yml`（容器 MySQL + Redis + Backend，默认 `8080`）

主要痛点：

1. “本机联调”默认把测试环境变量文件放在 `~/.wxapp-checkin-test-env.sh`，会把配置写到工作区外（不符合本工作区产物约束，也不利于复现）。
2. 缺少顶层“一条命令同时启动后端 + web dev server”的入口，导致新同学容易在文档/端口/环境文件之间迷路。
3. `web/` 推荐使用 `web/.env.local` 覆盖，但仓库未显式忽略该类文件，容易造成 git 工作区不干净。

## 2. 目标与非目标

### 2.1 目标

- 提供统一入口脚本：一键 bootstrap、一键启动（local / docker）、一键停止。
- 默认把所有**配置文件/日志/运行时产物**落在工作区目录树内，且尽量不污染 git 状态。
- 兼容现有启动方式与文档：不破坏 `backend/README.md` 与 `wxapp-checkin/README.md` 已有路径，同时把“推荐路径”收敛到新的脚本与文件位置。

### 2.2 非目标

- 不新增或修改业务接口、数据库表设计、前端页面功能。
- 不强制引入新的进程管理器（如 pm2/systemd）用于本地联调。
- 不把 `web/` 完全容器化（避免降低前端日常开发体验；如有需要另立方案）。

## 3. 约束与原则

- 仅允许修改 `wxapp-checkin/`（跨项目目录只读）。
- 工作过程中产生的文件（日志、pid、trace、截图、导出等）必须落在 `/home/psx/app/**` 目录树内。
- 对 `wxapp-checkin/` 的改动完成后，保持 `wxapp-checkin` 仓库 `git status --porcelain` 为空（通过 `.gitignore` 隔离本地配置与运行产物）。
- 脚本默认以“可读 + 可排障”为第一优先（避免过度封装）。

## 4. 总体方案（推荐）

采用“顶层 Bash 脚本编排”：

- 新增 `wxapp-checkin/scripts/`：
  - `bootstrap.sh`：生成本地配置文件（仅在缺失时创建，不覆盖已有文件）
  - `dev.sh`：一键启动（`local` / `docker` 两种模式）
  - `stop.sh`：一键停止
- 后端继续复用：
  - `backend/scripts/start-test-env.sh`（local 模式入口）
  - `backend/docker-compose.yml`（docker 模式入口）
- 前端继续复用 `web/.env.example`，通过 `--mode` 切换不同的 dev 配置文件。

## 5. 本地配置文件契约（落盘位置）

### 5.1 后端（docker 模式）

- `backend/.env`：由 `backend/.env.example` 生成（由 `backend/.gitignore` 忽略）
- 用途：`docker compose up -d` 的环境变量输入。

### 5.2 后端（local 模式）

- `backend/.env.test.local.sh`：由 `backend/scripts/test-env.example.sh` 生成（被 `backend/.gitignore` 忽略）
- 用途：`backend/scripts/start-test-env.sh` 读取的测试环境变量文件（替代 `~/.wxapp-checkin-test-env.sh` 的默认路径）。
- 兼容策略：
  - 默认优先读取 `backend/.env.test.local.sh`
  - 仍支持 `WXAPP_TEST_ENV_FILE` 显式指定
  - 仍兼容读取旧的 `~/.wxapp-checkin-test-env.sh`（仅作为 fallback，并在输出中提示 deprecated）

### 5.3 前端（local / docker 两套）

- `web/.env.local`：local 模式（默认代理到 `http://127.0.0.1:9989`）
- `web/.env.docker.local`：docker 模式（默认代理到 `http://127.0.0.1:8080`）
- `web/.env.example`：仍作为模板与文档基线。
- `.gitignore`：显式忽略 `web/.env*.local`，确保仓库状态干净。

## 6. 统一命令与行为定义

### 6.1 一键 bootstrap

命令：

```bash
cd wxapp-checkin
./scripts/bootstrap.sh
```

行为：

- 创建缺失的本地配置文件：
  - `backend/.env`（docker）
  - `backend/.env.test.local.sh`（local）
  - `web/.env.local`（local）
  - `web/.env.docker.local`（docker）
- 创建运行时目录（用于日志/pid 等，且默认被忽略）：
  - `wxapp-checkin/local_dev/runtime/`（或在多项目工作区时，优先写到 `../local_dev/runtime/wxapp-checkin/`，否则 fallback 到仓库内）
- 不覆盖已有文件；若发现已存在，会输出“已存在，跳过”的提示。

### 6.2 一键启动（local）

命令：

```bash
./scripts/dev.sh local
```

行为：

- 启动后端（默认 `9989`）：调用 `backend/scripts/start-test-env.sh`
  - 会重置联调测试数据（该行为与现有文档一致）
- 启动前端：在 `web/` 下执行 `npm run dev`（默认使用 `web/.env.local`）
- 对外输出：
  - 后端健康检查地址
  - web dev server 地址

### 6.3 一键启动（docker）

命令：

```bash
./scripts/dev.sh docker
```

行为：

- 在 `backend/` 下执行 `docker compose up -d`（使用 `backend/.env`）
- 等待后端健康检查可用（或给出明确失败原因）
- 启动前端：`npm run dev -- --mode docker`（加载 `web/.env.docker.local`）

### 6.4 一键停止

命令：

```bash
./scripts/stop.sh
```

行为：

- docker 模式：在 `backend/` 下执行 `docker compose down`
- local 模式：
  - 优先读取 runtime pid 文件停止后端进程（仅当确认是本项目启动的进程）
  - 若 pid 不存在，提示用户用 `ss`/`lsof` 自行释放端口（避免误杀）

## 7. 文档收口点

- `wxapp-checkin/README.md`：
  - 将“本地启动”步骤收敛为：`./scripts/bootstrap.sh` + `./scripts/dev.sh (local|docker)`
  - 仍保留高级用法与端口/网关建议（不删除现有说明）
- `wxapp-checkin/backend/README.md`：
  - 将“测试环境变量文件”默认路径更新为 `backend/.env.test.local.sh`
  - 明确说明旧 `~/.wxapp-checkin-test-env.sh` 仅作兼容 fallback
- 必要时新增 `docs/QUICKSTART.md`：
  - 依赖检查（Java/Node/Docker/MySQL/Redis）
  - 常见故障排查（端口占用、DB 无权限、Redis 未启动、健康检查失败等）

## 8. 验证策略

- `./scripts/bootstrap.sh` 可重复运行且幂等（不覆盖）。
- `./scripts/dev.sh local`：
  - 能拉起后端并通过 `GET /actuator/health`
  - web dev server 能打开并完成基础页面加载
- `./scripts/dev.sh docker`：
  - compose 起容器后，后端健康检查通过
  - web dev server 代理可用

## 9. 回滚策略

- 所有改动集中在 `wxapp-checkin` 仓库内，且以新增脚本/文档与少量默认路径调整为主；如需回滚，只需删除新增脚本并还原 `backend/scripts/start-test-env.sh` 的 env 文件默认路径即可。
