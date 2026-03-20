# 手机 Web 动态验证码签到平台

项目 `wxapp-checkin` 的正式文档基线已切换为：

- 手机浏览器 Web 前端
- `学号 + 密码（默认 123，首次登录强制改密）+ 临时会话（session_token）`
- 管理员展示动态 6 位签到码 / 签退码
- 普通用户进入具体活动后输入 6 位码完成签到 / 签退
- `suda_union` 继续作为实名 / 报名事实源，`wxcheckin_ext` 继续承担扩展域与最终一致性回写

## 当前状态

- 文档与代码都已经收口到 Web-only 目标态。
- `web/` 是唯一正式前端；历史小程序目录已删除。
- 正式后端入口统一为 `/api/web/**`。
- `backend/` 继续承接活动查询、会话、状态机、动态码与同步回写主干。
- 默认独立部署时，当前 URL 命名空间与 `suda_union` 不直接重名；若要和 `suda-gs-ams` 共域部署，建议给前端配置子路径，并给网关单独保留 `wxapp-checkin` 的 API 前缀。

## 快速导航

如果你是第一次接手，建议按目标直接跳转：

| 目标 | 先看哪里 | 说明 |
| --- | --- | --- |
| 快速理解项目现状 | 当前 README | 先确认“唯一正式前端是 `web/`、唯一正式 API 是 `/api/web/**`” |
| 本地跑起来 | 本文的“**一键启动（推荐）**” | 适合开发联调；`local` 模式只启动本地服务，不再重置数据库 |
| 完整生产部署（前后端 + Web） | `docs/DEPLOYMENT.md` | 包含后端构建、Web 打包、Nginx/网关示例与验收步骤 |
| 生产部署后端 | `backend/README.md` | 包含 systemd、Docker Compose、环境变量与排障说明 |
| 查看本地测试环境细节 | `backend/TEST_ENV_TESTING.md` | 包含本地测试环境、安全边界与手工验证方式 |
| 核对正式产品/接口基线 | `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` | 需求、页面行为、接口契约三份正式基线 |

## 当前 Web 导航结构

- 顶级信息架构已收口为两个稳定入口：`活动`、`我的`。
- `活动` 域覆盖活动列表、活动详情、签到/签退、staff 管理与名单页；活动子页面不再把“返回链路”伪装成底部 tab。
- 活动列表页内部保留页内二级分段：普通用户看到 `进行中 / 历史活动`，staff 看到 `进行中 / 已完成`。
- `我的` 页已落地为个人中心，展示本地会话中的 `name / student_id / department / club`，并提供 `修改密码`、`退出登录` 两个账户动作。
- 改密链路现在区分两种模式：
  - 首次登录强制改密：仍然优先拦截并在成功后返回业务首页。
  - 个人中心自助改密：通过个人中心进入，成功后返回 `我的` 页，不再被路由守卫立即踢回活动列表。

## 目标架构

```text
┌──────────────────────────────┐
│ 手机浏览器 Web 前端 (web/)   │
│  normal / staff              │
└──────────────┬───────────────┘
               │ HTTP JSON API（内网基线）
┌──────────────▼───────────────┐
│ Spring Boot 后端 (backend/)  │
│ identity / activity / code   │
│ attendance / sync            │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────────────┐   ┌────▼───────────┐
│ wxcheckin_ext  │   │ suda_union     │
│ 扩展域主写库    │   │ 只读事实源+回写 │
└────────────────┘   └────────────────┘
```

## 仓库结构

| 路径 | 说明 | 当前状态 |
| --- | --- | --- |
| `backend/` | Java Spring Boot 后端、数据库迁移、测试与部署脚本 | 正式业务后端 |
| `web/` | 手机 Web 前端 | 唯一正式前端 |
| `docs/` | 正式需求、功能、接口、设计、兼容性与实施计划 | 已切换到 Web 口径 |
| `changes.md` | 根目录变更摘要 | 保留 |

## 文档导航

正式基线（验收与实现必须对齐）：

- 需求基线：`docs/REQUIREMENTS.md`
- 功能基线：`docs/FUNCTIONAL_SPEC.md`
- 接口基线：`docs/API_SPEC.md`

部署与联调文档（第一次接手最常用）：

- 完整部署手册：`docs/DEPLOYMENT.md`
- 后端部署与配置：`backend/README.md`
- 本地测试环境与安全边界：`backend/TEST_ENV_TESTING.md`
- 数据库深度说明：`backend/DB_DATABASE_DEEP_DIVE.md`

补充文档（用于设计、兼容性、审查与收尾，不替代正式基线）：

- 概要设计（现状复盘）：`docs/WEB_OVERVIEW_DESIGN.md`
- 详细设计（现状落点）：`docs/WEB_DETAIL_DESIGN.md`
- 兼容性文档：`docs/WEB_COMPATIBILITY.md`
- 审查与迁移说明：`docs/WEB_MIGRATION_REVIEW.md`
- 整改清单（按严重级排序）：`docs/RECTIFICATION_CHECKLIST.md`
- 认证基线变更设计：`docs/plans/2026-03-10-http-password-auth-design.md`
- 认证基线变更实施计划：`docs/plans/2026-03-10-http-password-auth-implementation-plan.md`

历史参考（复盘资料，不代表当前仍存在对应代码入口）：

- 早期 Web 设计草案：`docs/WEB_DESIGN.md`
- 详细变更：`docs/changes.md`
- 根目录变更摘要：`changes.md`

## 前置依赖

第一次接手时，至少先确认下面这些依赖：

| 场景 | 最少依赖 |
| --- | --- |
| 本地 `local` 联调 | Node/npm、Java 17、MySQL 8、Redis 7、`mysql` CLI、`curl`、`ss` |
| 本地 `docker` 联调 | Node/npm、Docker、Docker Compose、`curl` |
| 生产部署 | Node/npm、Java 17、MySQL 8、Redis 7、Nginx（或等价静态资源/网关方案） |

## 一键启动（推荐）

先一键生成本地配置文件（幂等，不会覆盖已有文件）：

```bash
cd wxapp-checkin
./scripts/bootstrap.sh
```

然后选择一种启动方式：

```bash
# 本机 MySQL/Redis + 后端 9989 + web dev
# 只启动本地联调服务，不重置任何数据库
./scripts/dev.sh local

# 或：Docker Compose (MySQL + Redis + Backend 8080) + web dev（Vite docker mode）
# 适合隔离演示/快速联调，不会动你的本机 MySQL
./scripts/dev.sh docker
```

停止：

```bash
./scripts/stop.sh
```

配置文件位置（都在仓库内，且默认不会污染 git 状态）：

- local：
  - 后端：`backend/.env.test.local.sh`
  - 前端：`web/.env.local`
- docker：
  - 后端：`backend/.env`
  - 前端：`web/.env.docker.local`

说明：

- `web/.env.example` 给出了默认开发配置（local 默认代理到 `http://127.0.0.1:9989`）。
- docker 模式通过 `vite --mode docker` 读取 `web/.env.docker.local` 覆盖 `web/.env.local`，默认代理到 `http://127.0.0.1:8080`。
- `./scripts/dev.sh local` 内部会调用 `backend/scripts/start-test-env.sh`；该脚本现在只加载本地 env 并启动后端，不再内置任何 legacy / 扩展库重置逻辑。
- `backend/scripts/start-test-env.sh` 默认只允许 loopback 数据库地址，避免把“本地联调入口”误连到远程环境。
- 若要和 `suda-gs-ams` 共域部署，建议至少设置：
  - `VITE_APP_BASE_PATH=/checkin/`
  - `VITE_API_BASE_PATH=/checkin-api/web`

启动后可用下面两个地址做最小自检：

```bash
curl http://127.0.0.1:9989/actuator/health
curl http://127.0.0.1:5174/
```

## 生产部署

完整前后端生产发布说明见：`docs/DEPLOYMENT.md`。

如果你当前只需要在单机上构建并启动后端做演示/排障，可按下面的最小流程执行：

仓库也提供了一个“生产后端一键启动（prod）”脚本，适合单机演示/排障（不会执行任何测试数据重置）：

```bash
cd wxapp-checkin
cd backend && ./mvnw -DskipTests clean package && cd ..
cp backend/.env.prod.example backend/.env.prod
./scripts/prod-backend.sh
```

说明：

- `prod` profile 下后端会对 `wxcheckin_ext` 执行 Flyway 自动迁移（不包含演示 seed 数据）。
- `suda_union`（legacy）必须预先存在；后端不会对 legacy 做 schema 迁移。
- 若扩展库已存在但缺少 `flyway_schema_history`（历史手工建表/拷贝库），后端会尝试推断 baseline 版本；极端情况下可用 `WXAPP_FLYWAY_BASELINE_OVERRIDE` 兜底（详见 `backend/README.md`）。
- Web 前端生产构建、`web/dist` 托管路径与 Nginx 反向代理示例，统一写在 `docs/DEPLOYMENT.md`，不要只部署后端而遗漏前端静态资源。

## 手动启动（排障用）

推荐顺序：

0. 先准备后端测试环境变量文件：

```bash
cp backend/scripts/test-env.example.sh backend/.env.test.local.sh
```

> 兼容说明：`backend/scripts/start-test-env.sh` 仍兼容旧 `~/.wxapp-checkin-test-env.sh`，但不再推荐写到 `~`。

1. 启动后端测试环境（默认监听 `9989`）：

```bash
cd backend
./scripts/start-test-env.sh
```

说明：

- 该脚本现在只会加载 `backend/.env.test.local.sh`（或你通过 `WXAPP_TEST_ENV_FILE` 指定的文件）并启动后端。
- 该脚本不会重置 `suda_union`，也不会清空扩展库业务数据。
- 若 `DB_HOST` 或 `LEGACY_DB_URL` 指向非本机回环地址，脚本会直接拒绝执行。

2. 启动前端开发服务器：

```bash
cd web
npm install
npm run dev
```

部署路由建议：

- `wxapp-checkin` 前端静态资源挂在 `/checkin/` 这类独立子路径下，避免与 `suda-gs-ams` 的 `/`、`/login` 路由冲突。
- 如果仍使用 `/api/web/**`，网关必须先匹配 `wxapp-checkin` 的 `/api/web/`，再匹配 `suda-gs-ams` / `suda_union` 的通用 `/api/`。
- 如果不想依赖网关优先级，建议把前端入口改为 `VITE_API_BASE_PATH=/checkin-api/web`，再由网关把该前缀转发或重写到 `wxapp-checkin` 后端的 `/api/web/**`。

## 推荐阅读顺序

如果你现在要推进 Web-only 联调，建议先读当前正式基线，再按需补充历史复盘：

1. `docs/REQUIREMENTS.md`
2. `docs/FUNCTIONAL_SPEC.md`
3. `docs/API_SPEC.md`
4. `docs/DEPLOYMENT.md`
5. `backend/README.md`
6. `docs/WEB_OVERVIEW_DESIGN.md`
7. `docs/WEB_DETAIL_DESIGN.md`
8. `docs/WEB_COMPATIBILITY.md`

历史复盘 / 计划文档请按“参考资料”阅读，不要把它们当成当前仓库状态：

- `docs/WEB_DESIGN.md`
- `docs/WEB_MIGRATION_REVIEW.md`
- `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`
- `docs/plans/2026-03-09-web-todo-list.md`

## 当前最重要的约束

- 只允许改 `wxapp-checkin/`。
- `suda_union/` 与 `suda-gs-ams/` 只允许读取、联调、参考，禁止改业务逻辑。
- 当前部署基线是 **HTTP + 内网 IP + 端口号**；不再依赖 Passkey/WebAuthn（因此不再要求 HTTPS 才能登录）。
- 新 Web 功能应统一以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 为准，不再以小程序链路为产品基线。

## 历史说明

- 2026-03-09 ~ 2026-03-10：项目曾采用“手机 Web + Passkey + 动态 6 位码”的口径并完成 Web-only 收口。
- 2026-03-10 起：认证基线调整为“HTTP 内网 + 账号密码（默认 123，首次强制改密）+ 临时会话（session_token）”，不再要求浏览器唯一绑定与解绑审核。
