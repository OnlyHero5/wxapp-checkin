# wxapp-checkin 生产环境自动迁移 + 测试/生产严格隔离设计

> 历史说明（2026-03-20）：本文记录的是当时的风险分析；文中涉及的 `reset-suda-union-test-data.sh` 与 destructive E2E 入口现已从仓库删除，仅保留为设计背景，不代表当前仓库状态。

**目标**：让 `wxapp-checkin` 在生产环境下做到“数据库可能已存在/可能为空/甚至库不存在”都能自动判断并完成 **wxcheckin_ext 自动建库（可选）+ 自动建表 + 自动迁移**；同时把测试脚本与生产启动流程严格隔离，避免误跑测试重置脚本导致生产 `suda_union` 被 drop。

> 说明：本文档只描述“启动与迁移链路”的收口与安全护栏，不调整业务接口与产品基线。

## 1. 背景与问题

### 1.1 现状

- `suda_union`（legacy）在生产环境内已存在，是事实源 + 回写目标。
- `wxcheckin_ext`（扩展库）在生产环境可能：
  1) 已存在且有数据  
  2) 已存在但缺表/缺列（版本落后）  
  3) 不存在库/不存在表
- 当前 `prod` profile（`backend/src/main/resources/application-prod.yml`）关闭 Flyway：导致生产无法“自动迁移”，需要人工执行 SQL。
- 测试脚本 `backend/scripts/start-test-env.sh` / `reset-suda-union-test-data.sh` 会 **drop + recreate** `suda_union` 测试表，存在误用风险。

### 1.2 风险

- 若有人在生产环境误跑测试脚本，将直接清空/重建 `suda_union` 表，属于不可接受的灾难性风险。
- 若生产启用 Flyway 但没有处理“已有库无 flyway_schema_history”的场景，Flyway 会因 non-empty schema 无历史而拒绝启动。
- `V1__baseline_extension_schema.sql` 含演示数据插入（管理员白名单/活动投影），生产环境必须避免。

## 2. 目标与非目标

### 2.1 目标

1. **生产自动迁移**：`SPRING_PROFILES_ACTIVE=prod` 时，后端启动自动完成：
   - `wxcheckin_ext` 库不存在 → 尝试自动创建（需要 DB 账号具备 CREATE DATABASE 权限；无权限则明确报错并提示预创建/授权）
   - 库存在但无表 → 自动建表（Flyway）
   - 库存在且版本落后 → 自动迁移到最新（Flyway）
   - 库存在但无 Flyway 历史 → 自动推断版本并 baseline，再 migrate
2. **测试/生产严格隔离**：
   - 测试重置脚本默认拒绝执行，除非明确声明“我在测试环境并允许破坏性重置”。
   - `prod` 环境下无论如何禁止执行测试重置。
3. **生产不注入演示数据**：生产迁移不插入任何 demo 活动/默认管理员。

### 2.2 非目标

- 不为生产引入容器化 web（仍由运维选择静态部署方式）。
- 不在代码层面对 `suda_union` 做 schema 迁移（legacy DB 必须由外部系统先存在）。

## 3. 总体方案

### 3.1 Flyway 双迁移目录：prod 去 seed

- `dev/test`：继续使用 `classpath:db/migration`（保留现有演示 seed，方便联调）
- `prod`：使用 `classpath:db/migration_prod`（复制 V1~V11，但 **V1 去掉所有 INSERT demo 数据**）

这样保证：

- 新生产库从 0 初始化时，不会写入 demo 数据。
- 现有 dev/test 环境不受影响（不改动已存在的 migration checksum）。

### 3.2 prod 自动 baseline + migrate（处理“已有库无历史”）

新增 `prod` 专用的迁移策略（Spring Boot `FlywayMigrationStrategy`）：

1. 判断当前 schema 是否为空：
   - 若为空：直接 `migrate()`（从 V1 开始建表）
2. 判断是否存在 `flyway_schema_history`：
   - 若存在：直接 `migrate()`（正常升级）
   - 若不存在且 schema 非空：执行“版本推断 → baseline → migrate”

**版本推断（保守）**：

按最高版本向下检查关键特征（表/列/索引）：

- V11：`wx_sync_outbox.retry_count` 存在
- V10：索引 `idx_wx_user_auth_ext_legacy_user_id` 存在
- V9：`wx_user_auth_ext.password_hash` 存在
- V8：`web_passkey_credential.credential_public_key` 存在
- V7：表 `web_admin_audit_log` 存在
- V6：表 `web_unbind_review` 存在
- V5：索引 `wx_qr_issue_log(accept_expire_at)` 存在
- V4：`wx_activity_projection.end_time` 存在
- V3：`wx_activity_projection.support_checkin` 存在
- V2：表 `wx_sync_outbox` 存在
- 否则视为 V1

**一致性校验**：

若检测到“高版本特征存在但低版本必备表缺失”的非单调状态（例如有 V9 列但没有 V2 表），视为人工改库导致的不一致，直接 fail-fast，并提示运维选择：

- 备份后修复 schema
- 或建立新库并迁移数据
- 或显式指定 baseline 版本（仅作为兜底开关）

### 3.3 自动建库（wxcheckin_ext）

为扩展库 JDBC URL 增加 `createDatabaseIfNotExist=true`：

- DB 不存在时：驱动尝试创建库（需要权限）
- DB 已存在时：不会触发创建

legacy `suda_union` 不增加该能力（必须先存在）。

## 4. 脚本与运行模式隔离

### 4.1 测试脚本加护栏（强制）

对以下脚本增加安全开关：

- `backend/scripts/start-test-env.sh`
- `backend/scripts/reset-suda-union-test-data.sh`

默认行为：

- 若 `SPRING_PROFILES_ACTIVE=prod` → 直接拒绝执行
- 若未显式设置 `WXAPP_CHECKIN_TEST_MODE=1` → 直接拒绝执行，并提示使用 `./scripts/dev.sh local`

### 4.2 生产一键启动入口（后端）

新增 `wxapp-checkin/scripts/prod-backend.sh`（或 `backend/scripts/start-prod.sh`）：

- 只做“生产启动/预检”，不做任何重置
- 读取指定的生产 env 文件（例如 `/etc/wxcheckin/backend.prod.env`），或允许用仓库内 `backend/.env.prod` 作为模板
- 启动方式以 `java -jar` 为基线（更接近真实部署）

> Web 前端生产部署仍按现有文档：`web` 构建产物 `web/dist` 由 Nginx/网关托管；不在本次强制一键化。

## 5. 文档收口点

- `backend/README.md`：
  - 更新 `prod` profile：Flyway 自动迁移开启（说明 baseline 推断行为与兜底开关）
  - 明确 legacy `suda_union` 必须预存在
- `README.md`（仓库根）：
  - dev/test 仍使用 `./scripts/dev.sh ...`
  - 新增生产入口脚本说明（与测试脚本隔离）

## 6. 验证策略

1. 新库（无 schema）+ `prod`：
   - 启动后自动创建库（若权限足够）并完成迁移
2. 旧库（有表无 flyway history）+ `prod`：
   - 自动推断 baseline → baseline → migrate
3. 旧库（有 flyway history）+ `prod`：
   - 正常 migrate
4. 测试脚本护栏：
   - 未设置 `WXAPP_CHECKIN_TEST_MODE=1` 时拒绝执行
   - `prod` profile 下无条件拒绝执行
