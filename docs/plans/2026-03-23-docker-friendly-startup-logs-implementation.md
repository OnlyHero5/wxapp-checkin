# Docker 启动友好日志 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `wxapp-checkin/backend` 增加 Docker 启动前依赖预检，在关键配置缺失或 `suda_union` / `wxcheckin_ext` / Redis 不可达时，以紫色自定义日志明确报错并直接退出容器。

**Architecture:** 在 `backend` 运行时镜像入口前增加一个 shell 预检层。预检脚本独立输出 ANSI 紫色日志，并对配置完整性、主库连通性、legacy `suda_union` 连通性和 Redis 连通性做最小探测；全部通过后才执行原有 `java -jar`。同时补一个仓库内可执行的脚本级回归测试，避免这条启动链路未来回归。

**Tech Stack:** Bash, Dockerfile, MySQL client / Redis tools, Spring Boot runtime image, Bash script regression tests.

---

### Task 1: 搭建预检脚本的回归测试入口

**Files:**
- Create: `backend/scripts/test-docker-preflight.sh`
- Modify: `backend/scripts/run-tests.sh`

**Step 1: Write the failing test**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PRECHECK_SCRIPT="${PROJECT_ROOT}/scripts/docker-preflight.sh"

if [[ ! -f "${PRECHECK_SCRIPT}" ]]; then
  echo "[preflight-test] missing ${PRECHECK_SCRIPT}" >&2
  exit 1
fi
```

目标：

- 先建立一个会失败的脚本级测试入口
- 明确后续实现文件路径必须是 `backend/scripts/docker-preflight.sh`

**Step 2: Run test to verify it fails**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: FAIL，并输出 `missing .../scripts/docker-preflight.sh`

**Step 3: Wire the test into the standard test entry**

```bash
cd "${PROJECT_ROOT}"
bash scripts/test-docker-preflight.sh
./mvnw clean test
```

**Step 4: Run test to verify it still fails from the standard entry**

Run: `cd backend && bash scripts/run-tests.sh`

Expected: FAIL，失败点来自 `test-docker-preflight.sh`

**Step 5: Commit**

```bash
git add backend/scripts/test-docker-preflight.sh backend/scripts/run-tests.sh
git commit -m "test(backend): 增加 Docker 预检脚本回归入口"
```

### Task 2: 先实现最小预检脚本骨架并让测试转绿

**Files:**
- Create: `backend/scripts/docker-preflight.sh`
- Test: `backend/scripts/test-docker-preflight.sh`

**Step 1: Expand the failing test to assert log contract**

```bash
output="$(bash "${PRECHECK_SCRIPT}" 2>&1 || true)"
printf '%s' "${output}" | grep -F "[wxcheckin-preflight]"
printf '%s' "${output}" | grep -F $'\033[35m'
```

目标：

- 固定日志前缀
- 固定紫色 ANSI 输出

**Step 2: Run test to verify it fails**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: FAIL，因为新脚本尚不存在或尚未输出约定前缀与颜色

**Step 3: Write minimal implementation**

```bash
#!/usr/bin/env bash
set -euo pipefail

PURPLE='\033[35m'
RESET='\033[0m'

log_info() {
  printf '%b[wxcheckin-preflight] %s%b\n' "${PURPLE}" "$1" "${RESET}"
}

log_info "开始检查 Docker 启动依赖"
log_info "依赖预检通过，开始启动 Spring Boot"
```

说明：

- 先只实现最小日志骨架
- 暂不引入数据库/Redis 真实探测，先把测试链路跑通

**Step 4: Run test to verify it passes**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: PASS

**Step 5: Commit**

```bash
git add backend/scripts/docker-preflight.sh backend/scripts/test-docker-preflight.sh
git commit -m "feat(backend): 增加 Docker 预检日志骨架"
```

### Task 3: 为配置缺失和依赖不可达补充失败用例

**Files:**
- Modify: `backend/scripts/test-docker-preflight.sh`
- Modify: `backend/scripts/docker-preflight.sh`

**Step 1: Add failing cases for required configuration**

```bash
expect_fail_missing_env "LEGACY_DB_URL" "缺少环境变量"
expect_fail_missing_env "LEGACY_DB_USER" "缺少环境变量"
expect_fail_missing_env "REDIS_HOST" "缺少环境变量"
```

**Step 2: Add failing cases for dependency connectivity**

```bash
expect_fail_mysql "jdbc:mysql://127.0.0.1:39999/suda_union" "suda_union 数据库连接问题"
expect_fail_mysql "jdbc:mysql://127.0.0.1:39999/wxcheckin_ext" "wxcheckin_ext 数据库连接问题"
expect_fail_redis "127.0.0.1" "63999" "Redis 连接问题"
```

目标：

- 在脚本测试里先明确每类错误的业务文案
- 用不可达端口模拟真实失败，而不是 mock 日志文本

**Step 3: Run test to verify it fails**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: FAIL，因为当前脚本还没有真正校验环境变量和网络连通性

**Step 4: Implement minimal failure handling**

实现要求：

- 增加 `require_env` 帮助函数
- 解析 `LEGACY_DB_URL` 得到 host / port / schema
- 区分 `wxcheckin_ext` 与 `suda_union` 的错误文案
- Redis 用 `redis-cli -h ... -p ... ping`
- MySQL 用 `mysqladmin ping` 或等价最小握手命令
- 任一失败时输出紫色错误并 `exit 1`

**Step 5: Run tests to verify they pass**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: PASS

**Step 6: Commit**

```bash
git add backend/scripts/docker-preflight.sh backend/scripts/test-docker-preflight.sh
git commit -m "feat(backend): 增加 Docker 依赖预检失败诊断"
```

### Task 4: 把预检脚本接入 Docker 启动入口

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `backend/scripts/test-docker-preflight.sh`

**Step 1: Add failing test for runtime image contract**

```bash
grep -F "docker-preflight.sh" "${PROJECT_ROOT}/Dockerfile"
grep -F "redis-tools" "${PROJECT_ROOT}/Dockerfile"
grep -E "default-mysql-client|mariadb-client" "${PROJECT_ROOT}/Dockerfile"
```

目标：

- 在接 Docker 前先固定镜像契约
- 确保运行时镜像具备预检所需工具

**Step 2: Run test to verify it fails**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: FAIL，因为当前 Dockerfile 未复制预检脚本，也未安装探测工具

**Step 3: Write minimal Docker integration**

实现要求：

- 运行时镜像安装 `curl`、MySQL 客户端、`redis-cli`
- 复制 `backend/scripts/docker-preflight.sh` 到镜像内
- 把 `ENTRYPOINT` 改为：

```sh
sh -c "/app/docker-preflight.sh && java $JAVA_OPTS -jar /app/app.jar"
```

- 确保脚本具备执行权限

**Step 4: Run test to verify it passes**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: PASS

**Step 5: Commit**

```bash
git add backend/Dockerfile backend/scripts/test-docker-preflight.sh
git commit -m "fix(docker): 接入后端启动前依赖预检"
```

### Task 5: 运行完整回归并补充文档

**Files:**
- Modify: `backend/README.md`
- Modify: `docker-compose.yml`（仅在需要补充注释或 env 说明时）

**Step 1: Add doc note for startup behavior**

补充说明：

- Docker 启动前会先做依赖预检
- `suda_union` / `wxcheckin_ext` / Redis 异常时会直接退出
- 紫色日志前缀为 `[wxcheckin-preflight]`

**Step 2: Run script regression**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: PASS

**Step 3: Run backend test suite**

Run: `cd backend && bash scripts/run-tests.sh`

Expected: PASS

**Step 4: Run package build**

Run: `cd backend && ./mvnw -DskipTests package`

Expected: PASS

**Step 5: Optional Docker smoke test**

Run: `cd /home/psx/app/wxapp-checkin && docker compose build backend`

Expected: PASS，镜像成功构建

**Step 6: Commit**

```bash
git add backend/README.md backend/scripts/test-docker-preflight.sh backend/scripts/docker-preflight.sh backend/Dockerfile
git commit -m "docs(backend): 补充 Docker 预检日志说明"
```
