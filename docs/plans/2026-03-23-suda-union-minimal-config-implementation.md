# suda_union 最小配置口径 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `wxapp-checkin` 的 legacy 配置收敛为只需填写 `SUDA_UNION_DB_HOST`、`SUDA_UNION_DB_USER`、`SUDA_UNION_DB_PASSWORD` 三项，并在 Docker 启动时明确区分“单项目演示状态”与“外部 suda_union 在线模式”。

**Architecture:** 通过 Spring `application-prod.yml` 内部拼装 legacy JDBC，把外部接入细节从 `LEGACY_DB_URL` 收口到 `SUDA_UNION_DB_*`。同时扩展 Docker 预检脚本为三态模式判断：演示模式、外部在线模式、配置不完整失败。脚本级测试先定义这些行为，再以最小修改让配置链路和文档同步落地。

**Tech Stack:** Bash, Docker Compose env files, Spring Boot YAML configuration, Maven, Docker image build, shell regression tests.

---

### Task 1: 先把预检回归用例改成三态模式

**Files:**
- Modify: `backend/scripts/test-docker-preflight.sh`
- Test: `backend/scripts/docker-preflight.sh`

**Step 1: Write the failing test**

把默认测试口径从 `LEGACY_DB_URL` 改为“未填写 `SUDA_UNION_DB_*` 时仍能通过，并输出演示模式提示”：

```bash
run_precheck
assert_status 0
assert_contains "未填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD"
assert_contains "单项目演示状态，非生产在线状态"
```

同时新增两组失败 / 成功用例：

```bash
run_precheck "SUDA_UNION_DB_HOST=legacy-db"
assert_status 1
assert_contains "suda_union 外部配置不完整"

run_precheck \
  "SUDA_UNION_DB_HOST=legacy-db" \
  "SUDA_UNION_DB_USER=legacy_user" \
  "SUDA_UNION_DB_PASSWORD=legacy_pass"
assert_status 0
assert_contains "外部 suda_union 模式"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: FAIL，因为当前脚本仍强依赖 `LEGACY_DB_URL`

**Step 3: Write minimal implementation in the test harness**

实现要点：

- 删除默认 `LEGACY_DB_URL` / `LEGACY_DB_USER` / `LEGACY_DB_PASSWORD` 注入
- 增加 `SUDA_UNION_DB_HOST` / `SUDA_UNION_DB_USER` / `SUDA_UNION_DB_PASSWORD` 覆盖入口
- 保留 `wxcheckin_ext`、Redis 和 Dockerfile 契约断言

**Step 4: Run test to verify it still fails for the right reason**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: FAIL，失败点来自预检脚本还没实现三态逻辑

**Step 5: Commit**

```bash
git add backend/scripts/test-docker-preflight.sh
git commit -m "test(backend): 覆盖 suda_union 最小配置模式"
```

### Task 2: 修改 Docker 预检脚本实现三态行为

**Files:**
- Modify: `backend/scripts/docker-preflight.sh`
- Test: `backend/scripts/test-docker-preflight.sh`

**Step 1: Implement the failing branches**

按以下规则改 `docker-preflight.sh`：

- 不再强制 `LEGACY_DB_URL` / `LEGACY_DB_USER`
- 新增 `resolve_legacy_mode` 或等价逻辑：
  - 三个 `SUDA_UNION_DB_*` 都为空：演示模式，legacy 使用 `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD`
  - 三个 `SUDA_UNION_DB_*` 都存在：外部模式，legacy 使用 `SUDA_UNION_DB_HOST:3306` + `SUDA_UNION_DB_USER` + `SUDA_UNION_DB_PASSWORD`
  - 只存在部分：直接失败
- 紫色日志文案固定为：
  - `未填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD，当前是单项目演示状态，非生产在线状态`
  - `已填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD，当前按外部 suda_union 模式启动`
  - `suda_union 外部配置不完整：请同时填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD`

**Step 2: Run test to verify it passes**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: PASS

**Step 3: Refactor lightly**

确保变量命名清晰：

- `LEGACY_DB_HOST`
- `LEGACY_DB_PORT`
- `LEGACY_DB_SCHEMA`
- `LEGACY_DB_USERNAME`
- `LEGACY_DB_PASSWORD_VALUE`

并补充中文维护注释解释三态切换原因。

**Step 4: Run test again**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: PASS

**Step 5: Commit**

```bash
git add backend/scripts/docker-preflight.sh backend/scripts/test-docker-preflight.sh
git commit -m "fix(docker): 支持 suda_union 最小配置模式"
```

### Task 3: 切换 Spring prod 配置到 `SUDA_UNION_DB_*`

**Files:**
- Modify: `backend/src/main/resources/application-prod.yml`

**Step 1: Write the failing configuration expectation**

先在本地检查当前文件仍主推 `LEGACY_DB_URL`：

Run: `rg -n "LEGACY_DB_URL|SUDA_UNION_DB_HOST" backend/src/main/resources/application-prod.yml`

Expected: 仅看到旧 `LEGACY_DB_URL` 口径

**Step 2: Write minimal implementation**

把 legacy 数据源改成以下优先级：

```yaml
url: ${LEGACY_DB_URL:jdbc:mysql://${SUDA_UNION_DB_HOST:${DB_HOST:127.0.0.1}}:3306/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false}
username: ${LEGACY_DB_USER:${SUDA_UNION_DB_USER:${DB_USER:root}}}
password: ${LEGACY_DB_PASSWORD:${SUDA_UNION_DB_PASSWORD:${DB_PASSWORD:root}}}
```

说明：

- 对外新主口径是 `SUDA_UNION_DB_*`
- 保留 `LEGACY_DB_*` 兼容优先级，避免老部署立即失效
- 不额外暴露 port 和 schema

**Step 3: Run targeted verification**

Run: `sed -n '1,220p' backend/src/main/resources/application-prod.yml`

Expected: 能看到 `SUDA_UNION_DB_HOST` / `SUDA_UNION_DB_USER` / `SUDA_UNION_DB_PASSWORD`

**Step 4: Commit**

```bash
git add backend/src/main/resources/application-prod.yml
git commit -m "fix(backend): 收口 suda_union 的 legacy 配置口径"
```

### Task 4: 更新 compose 示例和文档

**Files:**
- Modify: `docker/compose.env`
- Modify: `docker/compose.override.env.example`
- Modify: `backend/README.md`

**Step 1: Write the failing doc/config expectation**

确认以下旧口径仍存在：

Run: `rg -n "LEGACY_DB_URL|LEGACY_DB_USER|LEGACY_DB_PASSWORD" docker/compose.env docker/compose.override.env.example backend/README.md`

Expected: 返回旧 legacy 配置示例

**Step 2: Write minimal implementation**

要求：

- `docker/compose.env` 删除对外暴露的默认 `LEGACY_DB_*` 示例，并解释“未填写 `SUDA_UNION_DB_*` 时会回退到单项目演示状态”
- `docker/compose.override.env.example` 只主推：
  - `SUDA_UNION_DB_HOST`
  - `SUDA_UNION_DB_USER`
  - `SUDA_UNION_DB_PASSWORD`
- `backend/README.md` 改成：
  - 默认直接 `docker compose up -d`
  - 若要接真实 `suda_union`，只改 override 里的 3 行
  - 若不改则会提示“单项目演示状态，非生产在线状态”

**Step 3: Run quick verification**

Run: `rg -n "SUDA_UNION_DB_HOST|单项目演示状态|非生产在线状态" docker/compose.env docker/compose.override.env.example backend/README.md`

Expected: 返回新文案

**Step 4: Commit**

```bash
git add docker/compose.env docker/compose.override.env.example backend/README.md
git commit -m "docs(docker): 简化 suda_union 外部接入配置"
```

### Task 5: 跑完整验证并整理结果

**Files:**
- Modify: `backend/scripts/run-tests.sh`（仅在需要调整验证入口时）

**Step 1: Run script regression**

Run: `cd backend && bash scripts/test-docker-preflight.sh`

Expected: PASS

**Step 2: Run backend tests**

Run: `cd backend && ./mvnw -s target/no-proxy-settings.xml clean test`

Expected: PASS

**Step 3: Run package build**

Run: `cd backend && ./mvnw -s target/no-proxy-settings.xml -DskipTests package`

Expected: PASS

**Step 4: Run Docker build**

Run: `cd /home/psx/app/wxapp-checkin && docker compose build backend`

Expected: PASS

**Step 5: Check git cleanliness**

Run: `git -C /home/psx/app/wxapp-checkin status --short`

Expected: empty

**Step 6: Commit**

```bash
git add backend/scripts/docker-preflight.sh backend/scripts/test-docker-preflight.sh backend/src/main/resources/application-prod.yml docker/compose.env docker/compose.override.env.example backend/README.md
git commit -m "fix(docker): 收口 suda_union 最小配置口径"
```
