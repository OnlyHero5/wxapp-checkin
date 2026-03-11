# Web 改造整改清单（按严重级排序）

更新时间：2026-03-10  
适用范围：`wxapp-checkin`（Web-only，HTTP 内网账号密码 + 首次强制改密 + 临时会话 session_token）  
用途：为“新开对话继续修复”提供可直接接手的整改清单与验证口径（问题 -> 目标 -> 建议方案 -> 验证方式）。

## 0. 接手快照（便于新对话快速进入状态）

- 当前分支：`web`
- 改动边界：只允许修改 `wxapp-checkin/`；`suda_union/` 与 `suda-gs-ams/` 仅可读取/联调参考，禁止改业务逻辑。
- 代码约束：2 空格缩进；修改 `wxapp-checkin/` 源码时需补中文维护注释（默认注释密度约 1/4~1/3，短文件不适用需在说明中写明原因）。
- 已通过的自动化验证（仓库内）：
  - `cd web && npm test`
  - `cd web && npm run build`
  - `cd backend && ./mvnw test -q`
- 已做过的命令行联调（真实接口，不是 mock）：
  - 账号密码登录 / 强制改密闭环
  - 会话拦截：`password_change_required`
  - 活动列表分页：`page/page_size/has_more` 与前端“加载更多”
  - 契约一致性复测：详情 `can_checkin/can_checkout` 与 staff 发码时间窗一致（开始前30分钟~结束后30分钟）
- 当前缺口（需要补“可复核证据”）：
  - `wxapp-checkin/web -> wxapp-checkin/backend -> outbox -> suda_union -> suda-gs-ams` 全链路验收记录（仓库内暂无落盘证据）

## 1. 严重级定义

- **P0（阻塞）**：用户无法完成关键流程 / 前后端契约不一致导致联调卡死 / 明确的业务错误
- **P1（高）**：明显性能隐患 / 规模化后会出问题 / 验收高概率被追问
- **P2（中）**：文档口径偏差、可用性瑕疵、边界未补齐（不一定阻塞）
- **P3（低）**：工程化增强、补矩阵/补证据、体验优化（可排后）

## 2. 整改清单（按 P0 -> P3）

### P0-1：基线调整：取消浏览器绑定（不再要求与浏览器捆绑）

- **结论**：✅ 已完成（2026-03-10）。浏览器唯一绑定与解绑审核不再作为产品基线，相关防代签逻辑已从前后端移除。
- **背景**：原方案依赖 `X-Browser-Binding-Key` + 解绑审核降低代签风险，但会导致换机/清缓存/换浏览器无法恢复使用；本轮整改明确要求“不再要求与浏览器捆绑”。
- **改动点（代码证据）**：
  - 后端登录与业务鉴权仅依赖 `session_token`：`backend/src/main/java/com/wxcheckin/backend/application/service/WebPasswordAuthService.java`、`backend/src/main/java/com/wxcheckin/backend/application/service/SessionService.java`
  - 前端请求层仅携带 `Authorization: Bearer <session_token>`，不再生成/注入浏览器绑定 key：`web/src/shared/http/client.ts`
  - `binding_conflict` / `account_bound_elsewhere` / `binding_revoked` 等绑定相关错误码与解绑接口已废弃（不再出现在正式契约与实现中）。
- **新的验收口径**：
  - 同一账号允许在多个设备/浏览器同时登录并正常使用（多个 `session_token` 并存）。
  - 未改密时仍统一被 `password_change_required` 拦截（改密接口除外）。
- **验证方式**：
  - 后端集成测试：`backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`（`shouldAllowMultipleSessionsForSameAccountAfterLogin`）
  - 命令：`cd backend && ./mvnw test -q`

### P0-2：活动动作可执行性契约不一致（`can_checkin/can_checkout` 与真实时间窗不一致）

- **状态**：✅ 已修复（2026-03-10）。
- **现象**：活动详情返回 `can_checkin=true`，但 staff 获取动态码会因为时间窗返回 `outside_activity_time_window`；出现“前端提示可签到/去签到，但管理员无法发码”的契约冲突。
- **根因**：详情页的动作可执行性推导没有复用 staff 发码使用的时间窗判断与 legacy 时间兜底逻辑，导致两套规则漂移。
- **修复方案**：抽取统一时间窗判断 `ActivityTimeWindowService`，并在以下入口复用：
  - staff 发码：`backend/src/main/java/com/wxcheckin/backend/application/service/QrSessionService.java`
  - 详情动作：`backend/src/main/java/com/wxcheckin/backend/application/service/ActivityQueryService.java`
  - 时间窗服务：`backend/src/main/java/com/wxcheckin/backend/application/service/ActivityTimeWindowService.java`
- **验收口径**：
  - `can_checkin/can_checkout` 与 `code-session` 的时间窗规则一致：活动开始前 30 分钟 ~ 结束后 30 分钟（包含边界）。
- **验证方式**：
  - 后端集成测试：`backend/src/test/java/com/wxcheckin/backend/api/ApiFlowIntegrationTest.java`（`shouldAlignActivityCanCheckinWithCodeSessionTimeWindow`）
  - 命令：`cd backend && ./mvnw test -q`

### P1-1：活动列表缺分页（潜在性能与稳定性风险）

- **状态**：✅ 已修复（2026-03-10）。
- **现状**：活动列表无分页时，数据量上来后会导致接口与页面性能不可控。
- **影响**：中后期压测/验收容易被追问；真实数据多时会引发慢查询与页面卡顿。
- **定位**：
  - 活动列表查询：`backend/src/main/java/com/wxcheckin/backend/application/service/ActivityQueryService.java`
- **整改目标**：
  - 为列表接口补 `page/page_size`（或 cursor）并设置合理默认值与最大值。
  - 前端对列表加载做“可持续滚动/分页”适配（避免一次性拉全）。
- **修复点（代码证据）**：
  - 后端：`GET /api/web/activities` 支持 `page/page_size`，响应返回 `page/page_size/has_more`：`backend/src/main/java/com/wxcheckin/backend/api/controller/WebActivityController.java`、`backend/src/main/java/com/wxcheckin/backend/api/dto/WebActivityListResponse.java`
  - 前端：活动列表页增加“加载更多”按钮并按 `has_more` 持续拉取：`web/src/pages/activities/ActivitiesPage.tsx`、`web/src/features/activities/api.ts`

### P1-2：`legacy_user_id` 缺索引（登录/查人路径可退化成全表扫）

- **状态**：✅ 已修复（2026-03-10）。
- **现状**：登录/身份查找路径按 `legacy_user_id` 查询，但 `wx_user_auth_ext.legacy_user_id` 未建索引。
- **影响**：用户量上来后登录抖动明显；属于低成本高收益的性能整改项。
- **定位**：`backend/src/main/resources/db/migration/V1__baseline_extension_schema.sql`
- **整改目标**：
  - 新增 Flyway migration：为 `wx_user_auth_ext(legacy_user_id)` 加索引（必要时加唯一约束口径说明）。
  - 同步 `backend/scripts/bootstrap-prod-schema.sql`（若生产不跑 Flyway）。
- **修复点（代码证据）**：
  - Flyway：`backend/src/main/resources/db/migration/V10__add_legacy_user_id_index.sql`
  - 生产 schema：`backend/scripts/bootstrap-prod-schema.sql`

### P1-3：三项目联调“全闭环证据”缺失（需要补可复核验收记录）

- **现状**：三项目可以同时拉起，且脚本输出 `login ok`；但仓库内尚无可复核的“全闭环验收记录”（尤其是 outbox 同步链路）。
- **影响**：审查目标 3 需要“联调成功且功能达成目的”的证据；缺记录会被认为未完成。
- **整改目标**：
  - 将一套可重复的联调步骤写入文档，并在 `progress.md` 记录一次成功跑通的时间与关键输出（日志/SQL/接口响应摘要）。
- **建议补充的联调验收点（最小闭环）**：
  - `wxapp-checkin` 能从 `suda_union` 同步到活动/报名事实（legacy sync）。
  - Web 前端能读到活动并完成“发码/验码/签退/批量签退”关键路径。
  - outbox 回写（若当前口径要求）在 `suda_union` / `suda-gs-ams` 可观察到一致性结果。

### P2-1：文档口径残留与不一致（需要收口为“描述精准”）

- **状态**：✅ 已修复（2026-03-10）。
- **修复点**：
  - 正式文档已统一收口到“HTTP 内网账号密码 + 首次强制改密 + session_token”的现状。
  - 历史 Passkey/浏览器绑定相关内容仅保留为“历史遗留/回溯说明”，并明确标注“当前正式基线不依赖”。
- **验证方式**：
  - 文档侧：全仓搜索 `Passkey|WebAuthn|X-Browser-Binding-Key` 应只出现在“历史遗留”上下文。

### P3-1：Playwright 真浏览器冒烟缺失（当前环境限制）

- **现状**：仓库内自动化以单测为主；Playwright 真浏览器冒烟在当前容器环境可能缺少浏览器依赖（历史记录显示安装 chrome 需要 sudo）。
- **整改目标**：
  - 若后续需要“真机/真浏览器证据”，建议把 Playwright 冒烟拆成可选步骤，并在文档中明确环境前置（避免 CI/容器里硬跑失败）。

## 3. 新对话推荐修复顺序（按风险/收益）

1) 先看 **P0-1（取消浏览器绑定）**：这是当前基线决策，后续所有文档与实现都必须对齐。  
2) 再修 **P0-2（契约一致性）**：它会影响普通用户与 staff 的核心链路，验收最敏感。  
3) 再做 **P1 性能项**：分页 + 索引。  
4) 最后收口 **P2 文档** 与 **P3 冒烟/证据**。

## 4. 快速验证命令（复制即用）

- Web 单测/构建：
  - `cd wxapp-checkin/web && npm test`
  - `cd wxapp-checkin/web && npm run build`
- 后端单测：
  - `cd wxapp-checkin/backend && ./mvnw test -q`
- 三项目联调启动：
  - `cd /home/psx/app && ./local_dev/scripts/start_3_projects_integration.sh`
- 端口占用排查（可选）：
  - `ss -ltnp | rg ':(8088|5173|9989|5174)\\b'`
