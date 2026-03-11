# 一键配置/一键启动（local + docker）Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `wxapp-checkin` 提供可复用的一键 bootstrap + 一键启动（local / docker）脚本，并把本地配置文件默认落盘到仓库内且不污染 git 状态。

**Architecture:** 在 `wxapp-checkin/scripts/` 新增统一入口脚本编排后端与前端启动；后端继续复用 `backend/scripts/start-test-env.sh` 与 `backend/docker-compose.yml`，仅调整“测试 env 文件默认位置”与兼容提示。

**Tech Stack:** Bash、Docker Compose、Node.js（Vite）、Spring Boot（Maven Wrapper）。

---

### Task 1: 忽略本地配置与运行产物

**Files:**
- Modify: `wxapp-checkin/.gitignore`

**Step 1: 更新 gitignore 规则**

- 忽略 `web/.env*.local`（例如 `web/.env.local`、`web/.env.docker.local`）
- 忽略 `wxapp-checkin/local_dev/runtime/`（脚本 fallback 运行时目录）

**Step 2: 验证**

Run: `cd wxapp-checkin && git status --porcelain`  
Expected: 为空（本次改动提交后保持干净；后续 bootstrap 生成的本地文件不应出现在 status 中）

**Step 3: Commit**

Run:

```bash
cd wxapp-checkin
git add .gitignore
git commit -m "chore: 忽略本地 env 与运行产物"
```

---

### Task 2: 后端本机联调 env 文件默认落盘到仓库内

**Files:**
- Modify: `wxapp-checkin/backend/scripts/start-test-env.sh`
- Modify: `wxapp-checkin/backend/scripts/reset-suda-union-test-data.sh`
- Modify: `wxapp-checkin/backend/README.md`

**Step 1: 调整默认 env 文件搜索顺序**

把默认 env 文件路径从 `~/.wxapp-checkin-test-env.sh` 调整为：

1. `backend/.env.test.local.sh`（推荐，仓库内）
2. `WXAPP_TEST_ENV_FILE`（显式覆盖）
3. `~/.wxapp-checkin-test-env.sh`（仅兼容 fallback，并提示 deprecated）

**Step 2: 验证**

Run: `cd wxapp-checkin/backend && WXAPP_TEST_ENV_FILE=./scripts/test-env.example.sh ./scripts/start-test-env.sh`  
Expected: 能读取 env 文件（即使 DB 不存在也应给出清晰错误；不要直接提示“Missing env file”）

**Step 3: 文档同步**

更新 `backend/README.md`：

- `cp backend/scripts/test-env.example.sh backend/.env.test.local.sh`
- 不再推荐写入 `~`；旧路径仅作为兼容说明

**Step 4: Commit**

Run:

```bash
cd wxapp-checkin
git add backend/scripts/start-test-env.sh backend/scripts/reset-suda-union-test-data.sh backend/README.md
git commit -m "docs: 收敛本机联调 env 默认路径"
```

---

### Task 3: 前端 docker mode env 文件与启动方式

**Files:**
- Create: `wxapp-checkin/web/.env.docker.local`（模板由脚本生成，文件本身不提交；这里只在文档与脚本里约定）
- Modify: `wxapp-checkin/web/.env.example`
- Modify: `wxapp-checkin/README.md`

**Step 1: 明确 docker 模式的 Vite 加载策略**

约定：

- local：`vite`（默认 mode），读取 `web/.env.local`
- docker：`vite --mode docker`，读取 `web/.env.docker.local` 覆盖 `web/.env.local`

**Step 2: 文档同步**

在 `README.md` 给出两套一键启动命令，并解释端口：

- local：后端 `9989`（start-test-env）
- docker：后端 `8080`（compose）

**Step 3: Commit（若仅文档改动）**

```bash
cd wxapp-checkin
git add README.md web/.env.example
git commit -m "docs: 补齐 web local/docker 配置说明"
```

---

### Task 4: 新增顶层一键脚本（bootstrap/dev/stop）

**Files:**
- Create: `wxapp-checkin/scripts/bootstrap.sh`
- Create: `wxapp-checkin/scripts/dev.sh`
- Create: `wxapp-checkin/scripts/stop.sh`

**Step 1: bootstrap.sh（幂等）**

职责：

- 生成缺失的本地配置文件（不覆盖）：
  - `backend/.env`（from `backend/.env.example`）
  - `backend/.env.test.local.sh`（from `backend/scripts/test-env.example.sh`）
  - `web/.env.local`（from `web/.env.example`，默认指向 `9989`）
  - `web/.env.docker.local`（基于 `web/.env.example` 生成，默认指向 `8080`）
- 创建运行时目录（优先 workspace `../local_dev/runtime/wxapp-checkin/`，否则 fallback `wxapp-checkin/local_dev/runtime/`）
- 输出下一步命令与提示（需要 Java/Node/Docker 的场景）

**Step 2: dev.sh**

职责：

- `./scripts/dev.sh local`：
  - 先执行 `./scripts/bootstrap.sh`（保证 env 文件存在）
  - 后台启动 `backend/scripts/start-test-env.sh`，写入 pid 与日志到 runtime
  - 等待 `GET http://127.0.0.1:9989/actuator/health` 成功
  - 前台启动 `cd web && npm install(若缺失) && npm run dev`
- `./scripts/dev.sh docker`：
  - 先执行 `./scripts/bootstrap.sh`
  - `cd backend && docker compose up -d --build`
  - 等待 `GET http://127.0.0.1:8080/actuator/health` 成功
  - 前台启动 `cd web && npm install(若缺失) && npm run dev -- --mode docker`

**Step 3: stop.sh**

职责：

- docker：`cd backend && docker compose down`
- local：读取 runtime pid，安全停止；必要时按端口确认进程归属后再停止（避免误杀）

**Step 4: 可执行权限**

Run: `chmod +x wxapp-checkin/scripts/*.sh`

**Step 5: Commit**

```bash
cd wxapp-checkin
git add scripts/bootstrap.sh scripts/dev.sh scripts/stop.sh
git commit -m "feat: 增加一键 bootstrap 与启动脚本"
```

---

### Task 5: 关键验证与回归

**Files:**
- (none)

**Step 1: local 模式基础链路**

Run:

```bash
cd wxapp-checkin
./scripts/dev.sh local
```

Expected:

- 后端健康检查通过
- web dev server 启动成功

**Step 2: docker 模式基础链路**

Run:

```bash
cd wxapp-checkin
./scripts/stop.sh
./scripts/dev.sh docker
```

Expected:

- compose 三个容器健康
- 后端健康检查通过
- web dev server 启动成功（docker mode）

**Step 3: 停止与清理**

Run: `./scripts/stop.sh`  
Expected: docker 容器停止；local 后端端口释放；`git status --porcelain` 仍为空

