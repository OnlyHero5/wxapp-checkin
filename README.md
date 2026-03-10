# 手机 Web 动态验证码签到平台

项目 `wxapp-checkin` 的正式文档基线已切换为：

- 手机浏览器 Web 前端
- `学号 + 姓名 + Passkey + 临时会话 + 浏览器绑定`
- 管理员展示动态 6 位签到码 / 签退码
- 普通用户进入具体活动后输入 6 位码完成签到 / 签退
- `suda_union` 继续作为实名 / 报名事实源，`wxcheckin_ext` 继续承担扩展域与最终一致性回写

## 当前状态

- 文档与代码都已经收口到 Web-only 目标态。
- `web/` 是唯一正式前端；历史小程序目录已删除。
- 正式后端入口统一为 `/api/web/**`。
- `backend/` 继续承接活动查询、会话、状态机、解绑审核、动态码与同步回写主干。
- 默认独立部署时，当前 URL 命名空间与 `suda_union` 不直接重名；若要和 `suda-gs-ams` 共域部署，建议给前端配置子路径，并给网关单独保留 `wxapp-checkin` 的 API 前缀。

## 目标架构

```text
┌──────────────────────────────┐
│ 手机浏览器 Web 前端 (web/)   │
│  normal / staff / review     │
└──────────────┬───────────────┘
               │ HTTPS JSON API
┌──────────────▼───────────────┐
│ Spring Boot 后端 (backend/)  │
│ identity / activity / code   │
│ attendance / review / sync   │
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

正式基线：

- 需求基线：`docs/REQUIREMENTS.md`
- 功能基线：`docs/FUNCTIONAL_SPEC.md`
- 接口基线：`docs/API_SPEC.md`
- 设计文档：`docs/WEB_DESIGN.md`
- 兼容性文档：`docs/WEB_COMPATIBILITY.md`
- 审查与迁移说明：`docs/WEB_MIGRATION_REVIEW.md`
- 收尾设计：`docs/plans/2026-03-10-web-only-cutover-design.md`
- 收尾实施计划：`docs/plans/2026-03-10-web-only-cutover-implementation-plan.md`

迁移参考：

- 后端部署与配置：`backend/README.md`
- 数据库深度说明：`backend/DB_DATABASE_DEEP_DIVE.md`
- 详细变更：`docs/changes.md`
- 根目录变更摘要：`changes.md`

## 本地启动

推荐顺序：

0. 先准备后端测试环境变量文件：

```bash
cp backend/scripts/test-env.example.sh ~/.wxapp-checkin-test-env.sh
```

1. 启动后端测试环境（默认监听 `9989`）：

```bash
cd backend
./scripts/start-test-env.sh
```

2. 启动前端开发服务器：

```bash
cd web
npm install
npm run dev
```

说明：

- `web/.env.example` 给出了默认开发配置；如需覆盖，复制为 `web/.env.local` 后按环境修改。
- 当前前端开发服务器默认把 `VITE_API_BASE_PATH` 对应的路径代理到 `VITE_API_PROXY_TARGET`，默认值是 `http://127.0.0.1:9989`。
- 如果你不是用 `start-test-env.sh`，而是直接运行 `backend/scripts/start-dev.sh` 的默认 `8080` 端口，请同步把 `VITE_API_PROXY_TARGET` 改为 `http://127.0.0.1:8080`。
- 若要和 `suda-gs-ams` 共域部署，建议至少设置：
  - `VITE_APP_BASE_PATH=/checkin/`
  - `VITE_API_BASE_PATH=/checkin-api/web`

部署路由建议：

- `wxapp-checkin` 前端静态资源挂在 `/checkin/` 这类独立子路径下，避免与 `suda-gs-ams` 的 `/`、`/login` 路由冲突。
- 如果仍使用 `/api/web/**`，网关必须先匹配 `wxapp-checkin` 的 `/api/web/`，再匹配 `suda-gs-ams` / `suda_union` 的通用 `/api/`。
- 如果不想依赖网关优先级，建议把前端入口改为 `VITE_API_BASE_PATH=/checkin-api/web`，再由网关把该前缀转发或重写到 `wxapp-checkin` 后端的 `/api/web/**`。

## 推荐阅读顺序

如果你现在要推进 Web-only 联调，建议先读当前正式基线，再按需补充历史复盘：

1. `docs/REQUIREMENTS.md`
2. `docs/FUNCTIONAL_SPEC.md`
3. `docs/API_SPEC.md`
4. `backend/README.md`
5. `docs/WEB_DESIGN.md`
6. `docs/WEB_COMPATIBILITY.md`

历史复盘 / 计划文档请按“参考资料”阅读，不要把它们当成当前仓库状态：

- `docs/WEB_MIGRATION_REVIEW.md`
- `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`
- `docs/plans/2026-03-09-web-todo-list.md`

## 当前最重要的约束

- 只允许改 `wxapp-checkin/`。
- `suda_union/` 与 `suda-gs-ams/` 只允许读取、联调、参考，禁止改业务逻辑。
- 所有正式环境必须运行在 HTTPS。
- 新 Web 功能应统一以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 为准，不再以小程序链路为产品基线。

## 历史说明

- 2026-03-09 起，项目文档正式切换到“手机 Web + Passkey + 动态 6 位码”口径。
- 2026-03-10 起，仓库代码完成 Web-only 收口：历史小程序前端与旧微信登录正式入口已删除。
