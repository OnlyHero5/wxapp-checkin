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
- 实施计划：`docs/plans/2026-03-09-web-only-migration-implementation-plan.md`

迁移参考：

- 后端部署与配置：`backend/README.md`
- 数据库深度说明：`backend/DB_DATABASE_DEEP_DIVE.md`
- 详细变更：`docs/changes.md`
- 根目录变更摘要：`changes.md`

## 本地启动

前端：

```bash
cd web
npm install
npm run dev
```

后端：

```bash
cd backend
./mvnw test
./scripts/start-test-env.sh
```

## 推荐阅读顺序

如果你现在要推进 Web 改造，建议按下面顺序阅读：

1. `docs/WEB_MIGRATION_REVIEW.md`
2. `docs/REQUIREMENTS.md`
3. `docs/FUNCTIONAL_SPEC.md`
4. `docs/API_SPEC.md`
5. `docs/WEB_DESIGN.md`
6. `docs/WEB_COMPATIBILITY.md`
7. `docs/plans/2026-03-09-web-only-migration-implementation-plan.md`

## 当前最重要的约束

- 只允许改 `wxapp-checkin/`。
- `suda_union/` 与 `suda-gs-ams/` 只允许读取、联调、参考，禁止改业务逻辑。
- 所有正式环境必须运行在 HTTPS。
- 新 Web 功能应统一以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 为准，不再以小程序链路为产品基线。

## 历史说明

- 2026-03-09 起，项目文档正式切换到“手机 Web + Passkey + 动态 6 位码”口径。
- 2026-03-10 起，仓库代码完成 Web-only 收口：历史小程序前端与旧微信登录正式入口已删除。
