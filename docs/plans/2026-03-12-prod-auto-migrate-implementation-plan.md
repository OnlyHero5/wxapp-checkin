# 生产环境自动迁移 + 测试/生产隔离 Implementation Plan

> 历史说明（2026-03-20）：本文提到的 `reset-suda-union-test-data.sh`、三项目 destructive E2E 脚本与 `WXAPP_CHECKIN_TEST_MODE` 链路已从当前仓库移除，不能再按本文旧步骤执行。

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `prod` profile 下自动完成 `wxcheckin_ext` 建库（可选）+ Flyway 自动迁移，并为测试重置脚本加硬护栏，避免生产误用；同时提供独立的生产启动入口脚本。

**Architecture:** `prod` 使用独立的 Flyway migration 目录（无 demo seed），并通过 `@Profile("prod")` 的 `FlywayMigrationStrategy` 实现“无历史但已有表”的 baseline 推断；测试脚本增加 `WXAPP_CHECKIN_TEST_MODE` 强制开关；生产脚本只做预检与启动，不做任何重置。

**Tech Stack:** Spring Boot + Flyway + MySQL、Bash。

---

### Task 1: 增加 prod 专用 migration 目录（去 seed）

**Files:**
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V1__baseline_extension_schema.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V2__add_sync_outbox.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V3__add_support_checkin.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V4__add_end_time_to_activity_projection.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V5__add_qr_retention_indexes.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V6__add_web_unbind_review.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V7__add_web_identity_tables.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V8__add_passkey_verification_fields.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V9__add_web_password_auth.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V10__add_legacy_user_id_index.sql`
- Create: `wxapp-checkin/backend/src/main/resources/db/migration_prod/V11__add_outbox_retry_count.sql`

**Step 1: 复制 dev migration 到 prod 目录**

- V2~V11 内容保持一致（避免 prod/dev 的 schema 演进分叉）
- V1 删除所有 demo INSERT（管理员白名单/活动投影演示数据）

**Step 2: Commit**

```bash
cd wxapp-checkin
git add backend/src/main/resources/db/migration_prod
git commit -m "feat(backend): 增加 prod 去 seed 的迁移目录"
```

---

### Task 2: prod profile 启用 Flyway + 指向 migration_prod

**Files:**
- Modify: `wxapp-checkin/backend/src/main/resources/application-prod.yml`

**Step 1: 开启 Flyway 并配置 locations**

- `spring.flyway.enabled=true`
- `spring.flyway.locations=classpath:db/migration_prod`

**Step 2: Commit**

```bash
cd wxapp-checkin
git add backend/src/main/resources/application-prod.yml
git commit -m "feat(backend): prod 启用 Flyway 自动迁移"
```

---

### Task 3: 扩展库支持 createDatabaseIfNotExist

**Files:**
- Modify: `wxapp-checkin/backend/src/main/resources/application.yml`

**Step 1: 为 spring.datasource.url 增加 createDatabaseIfNotExist=true**

只对 `wxcheckin_ext` 生效；legacy `LEGACY_DB_URL` 不变。

**Step 2: Commit**

```bash
cd wxapp-checkin
git add backend/src/main/resources/application.yml
git commit -m "feat(backend): 扩展库支持自动建库"
```

---

### Task 4: prod 无历史库的 baseline 推断与迁移策略

**Files:**
- Create: `wxapp-checkin/backend/src/main/java/com/wxcheckin/backend/config/ProdFlywayMigrationStrategy.java`

**Step 1: 实现 FlywayMigrationStrategy（仅 prod 生效）**

- 若 schema 为空：直接 migrate
- 若存在 flyway_schema_history：直接 migrate
- 若无历史但 schema 非空：
  - 基于关键表/列/索引推断 baseline 版本（V1~V11）
  - 一致性校验失败则 fail-fast（提示运维手工处理或指定 override）
  - baseline 后再 migrate

**Step 2: 增加兜底开关**

- 环境变量 `WXAPP_FLYWAY_BASELINE_OVERRIDE`（例如 `11`），用于极端情况下强制 baseline 版本

**Step 3: Commit**

```bash
cd wxapp-checkin
git add backend/src/main/java/com/wxcheckin/backend/config/ProdFlywayMigrationStrategy.java
git commit -m "feat(backend): prod 支持无历史库自动 baseline"
```

---

### Task 5: 测试重置脚本加硬护栏

**Files:**
- Modify: `wxapp-checkin/backend/scripts/start-test-env.sh`
- Modify: `wxapp-checkin/backend/scripts/reset-suda-union-test-data.sh`
- Modify: `wxapp-checkin/scripts/dev.sh`
- Modify: `wxapp-checkin/backend/TEST_ENV_TESTING.md`

**Step 1: 强制要求 WXAPP_CHECKIN_TEST_MODE=1**

- 未设置时拒绝执行（并提示使用 `./scripts/dev.sh local`）
- `SPRING_PROFILES_ACTIVE=prod` 时无条件拒绝

**Step 2: dev.sh local 自动设置**

- `dev.sh local` 调用后端脚本前 export `WXAPP_CHECKIN_TEST_MODE=1`

**Step 3: Commit**

```bash
cd wxapp-checkin
git add backend/scripts/start-test-env.sh backend/scripts/reset-suda-union-test-data.sh scripts/dev.sh backend/TEST_ENV_TESTING.md
git commit -m "fix(backend): 测试重置脚本增加生产护栏"
```

---

### Task 6: 新增生产启动脚本（后端）

**Files:**
- Create: `wxapp-checkin/scripts/prod-backend.sh`
- Create: `wxapp-checkin/backend/.env.prod.example`
- Modify: `wxapp-checkin/backend/README.md`

**Step 1: prod-backend.sh**

- 只做预检 + 启动（不 reset、不 seed）
- 支持 `ENV_FILE` 参数或环境变量指定（默认提示使用 `/etc/wxcheckin/backend.prod.env`）
- `SPRING_PROFILES_ACTIVE=prod` 强制生效

**Step 2: 文档同步**

- 说明生产 env 文件关键项（LEGACY_DB_URL 等必须存在）
- 说明自动迁移/baseline 的行为与兜底 override

**Step 3: Commit**

```bash
cd wxapp-checkin
git add scripts/prod-backend.sh backend/.env.prod.example backend/README.md
git commit -m "feat(backend): 增加生产一键启动脚本"
```

---

### Task 7: 验证

**Files:** (none)

**Step 1: 编译通过**

Run: `cd wxapp-checkin/backend && ./mvnw -DskipTests test`  
Expected: build success

**Step 2: 脚本语法**

Run: `bash -n wxapp-checkin/scripts/*.sh wxapp-checkin/backend/scripts/*.sh`

**Step 3: Git 状态**

Run: `cd wxapp-checkin && git status --porcelain`  
Expected: 为空
