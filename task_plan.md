# Task Plan: Moonshot UI Overhaul for wxapp-checkin

## Goal
Redesign all four mini program pages in a Moonshot-like dark minimal style using TDesign Miniprogram components, add a minimal “个人中心” tab page, and record all changes in changes.md.

## Current Phase
Phase 4

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach (AntD Mini Program components + global theme tokens)
- [x] Map pages to components and layout structure
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Update global theme + page styles
- [x] Refactor four pages (index, records, record-detail, register)
- [x] Add “个人中心” page + tabBar entry
- [x] Ensure motion/interaction states
- [x] Update changes.md with modifications
- **Status:** complete

### Phase 4: Testing & Verification
- [ ] Verify all requirements met visually (WeChat DevTools)
- [ ] Check tab navigation and page layouts
- [ ] Document test results in progress.md
- **Status:** in_progress

### Phase 5: Delivery
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** pending

## Key Questions
1. Which official component library should we adopt? (Resolved: TDesign)
2. Should the tabBar remain text-only? (Default: text-only for minimalism)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use Obsidian Grid dark minimal aesthetic | Matches Moonshot-like geek minimal style and user request |
| Accent color: cold green for primary actions | Keeps dark UI clean with high-contrast highlights |
| Minimal “个人中心” content | User explicitly requested option 3 |
| TabBar stays text-only | Maintains minimalism and avoids icon asset overhead |
| Centralize design tokens in app.wxss | Ensures consistent styling across pages |
| Adopt TDesign components (full) | Tencent official component library per request |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| session-catchup.py not found at C:\Users\Lenovo\.claude | 1 | Located script in C:\Users\Lenovo\.codex\skills\planning-with-files\scripts |
| Get-ChildItem -Recurse timeout | 1 | Retried with a narrower target and used known path |
| rg command failed on "--bg" (interpreted as flag) | 1 | Re-ran with `rg -n -- "--bg" src/app.wxss` |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

## 2026-02-04 发布收尾清单
- [x] 移除旧 worktree
- [x] 同步 `main` 至 `origin/main`（已备份未跟踪文件）
- [x] 更新根目录中文记录
- [x] 创建并推送 release tag（v2026.02.04）
- [x] README.md 已更新（构建步骤与发布说明）
- [x] 全量检查并更新其他 Markdown 文档
- [x] 处理备份目录（加入 .gitignore，保留备份）
- [x] 重新指向并推送 v2026.02.04（已完成）
- [x] 新增 docs/API_SPEC.md（后端接口说明）

## 2026-02-06 角色分流与活动卡片新需求

### Goal
- 登录后按角色分流：
- 普通用户：仅个人信息页（可查看历史参加活动）
- 有权限工作人员：活动页 + 个人信息页
- 活动页卡片支持动作按钮：`签到`、`签退（可选）`、`详情（可选）`

### Phases
- [x] Phase A: 扩展 storage/auth/api，支持角色、权限、个人信息字段与工作人员活动接口
- [x] Phase B: 重构 `pages/index` 为工作人员活动卡片页 + 扫码签到/签退流程
- [x] Phase C: 重构 `pages/profile`，展示个人信息 + 历史活动列表
- [x] Phase D: 新增活动详情页并调整 `app.json` 路由与 tabBar
- [x] Phase E: 更新 planning 文件并完成关键路径验证

### Current Phase
- `Completed`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| PowerShell 下 `rg` 正则含引号时解析失败 | 1 | 改用 `--fixed-strings` 与单引号模式进行精确检索 |

### Follow-up (2026-02-06)
- [x] 普通用户“我的”页新增 `社会分`、`讲座分`
- [x] 活动页对普通用户显示活动卡片（不再自动跳转）
- [x] 普通用户“我的”页移除“曾参加活动”卡片
- [x] 普通用户活动卡片仅显示“我的签到状态”

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| superpowers bootstrap 直接执行失败（PowerShell 文件关联） | 1 | 改为 `node ~/.codex/superpowers/.codex/superpowers-codex bootstrap` |
| `rg` 正则包含未闭合分组导致解析失败 | 1 | 改为 `--fixed-strings` 精确匹配 |

## 2026-02-07 工作人员“曾参加活动”清理 + 活动页分组排序 + hack 数据扩充

### Goal
- 删除工作人员个人页中“曾参加活动”模块，避免与活动页重复。
- 活动页按业务状态拆分为 `正在进行` 与 `已完成` 两组。
- 两组均按活动时间倒序（新的在上），且 `正在进行` 固定显示在上方。
- hack/mock 模式提供更多活动与记录数据，覆盖更多验收场景。

### Phases
- [x] Phase A: 清理 `profile` 历史活动 UI 与逻辑
- [x] Phase B: 移除相关旧页面路由（`records`、`record-detail`）
- [x] Phase C: 改造 `index` 为分组视图 + 组内倒序
- [x] Phase D: 扩展 `api.js` mock 活动/记录数据
- [x] Phase E: 语法与引用验证、更新交付记录

### Current Phase
- `Completed`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| `ui-ux-pro-max` 技能说明里的 `scripts/search.py` 直连路径不存在 | 1 | 发现本地技能为路径映射文件，改为按现有代码结构手工执行 UI 改造并验证 |

## 2026-02-07 活动页按钮规则修复 + UI 美化

### Goal
- `已完成` 分组活动仅保留 `详情` 按钮，不显示 `签到/签退`。
- 活动页整体视觉重构，提升层级、密度与可读性。

### Phases
- [x] Phase A: 修改活动卡片动作条件（仅 ongoing 显示签到/签退）
- [x] Phase B: 增加已完成活动动作保护（前端 + mock API）
- [x] Phase C: 重构活动页布局与样式（概览卡、分组头、卡片操作区）
- [x] Phase D: 语法检查与引用验证

### Current Phase
- `Completed`

## 2026-02-07 活动页色彩增强（类型彩色胶囊 + 样例参考）

### Goal
- 解决“页面主要是白字+深背景”导致层次单一的问题。
- 按活动类型（如路演、竞赛）增加彩色圆角胶囊高亮。
- 保持深色主题统一，不引入高噪声颜色冲突。

### Phases
- [x] Phase A: 联网检索活动卡片/标签优秀样例与设计系统规范
- [x] Phase B: 设计类型到色彩语义映射（type -> tone）
- [x] Phase C: 实现 WXML + WXSS 动态类型胶囊样式
- [x] Phase D: 完成语法检查与规则回归验证

### Current Phase
- `Completed`

## 2026-02-07 文档全量对齐（重点 API_SPEC）

### Goal
- 按当前代码行为全量更新文档，避免“文档写法”与“前端真实表现”脱节。
- 重点重写 `docs/API_SPEC.md`：逐接口写明页面入口、触发动作、请求字段来源、响应字段映射、错误表现与联调定位方式。

### Phases
- [x] Phase A: 盘点代码与文档差异（页面、路由、按钮规则、接口字段）
- [x] Phase B: 重写 `docs/API_SPEC.md`
- [x] Phase C: 同步更新 `docs/FUNCTIONAL_SPEC.md`、`docs/REQUIREMENTS.md`
- [x] Phase D: 同步更新 `README.md`、`docs/changes.md`、`changes.md`
- [x] Phase E: 扫描一致性并完成交付

### Current Phase
- `Completed`

## 2026-02-08 普通用户活动可见性收敛（仅已报名/已签到/已签退）

### Goal
- 普通用户只能看到“自己已报名的活动”与“自己已签到/已签退过的活动”。
- 普通用户不能看到“未报名且未参加”的活动。
- 活动详情接口同样按上述规则做后端鉴权，防止通过活动 ID 越权查看。
- 前后端 API 与全部文档保持一致。

### Phases
- [x] Phase A: 以测试定义可见性规则（列表过滤 + 详情鉴权）
- [x] Phase B: 改造 mock 后端 API（活动列表/详情）
- [x] Phase C: 前端活动页与详情页适配新字段与提示文案
- [x] Phase D: 全量更新文档（README、REQUIREMENTS、FUNCTIONAL、API_SPEC、changes）
- [x] Phase E: 语法与行为验证，更新 planning 文件

### Current Phase
- `Completed`

## 2026-02-08 动态二维码签到/签退（管理员换码 + 普通用户扫码）

### Goal
- 管理员在活动页点击“签到码/签退码”后，进入二维码展示页并显示倒计时。
- 二维码每 10 秒自动换新，普通用户扫码后允许 20 秒宽限提交。
- 普通用户新增“签到/签退”页面，点击按钮打开摄像头扫码并提交。
- 扫码成功后给出即时反馈，活动页“我的状态”更新为已签到/已签退。
- 管理员二维码页实时更新已签到/已签退人数。
- 前后端 API 与全部文档同步更新。

### Phases
- [x] Phase A: 先补测试（二维码会话 + 宽限提交 + 状态同步）
- [x] Phase B: 改造 mock API（`qr-session` / `checkin-consume` / 统计字段）
- [x] Phase C: 新增页面 `staff-qr` 与 `scan-action` 并接入路由
- [x] Phase D: 适配活动页/详情页状态文案（已报名/已签到/已签退）
- [x] Phase E: 全量更新文档（README/REQUIREMENTS/FUNCTIONAL/API_SPEC/changes）
- [x] Phase F: 语法 + 测试验证，更新 planning 文件

### Current Phase
- `Completed`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| `superpowers-codex` 在 PowerShell 直接执行失败（文件关联错误） | 1 | 改为 `node C:\\Users\\Lenovo\\.codex\\superpowers\\.codex\\superpowers-codex ...` |

## 2026-02-08 二维码前端主导改造调研与规划

### Goal
- 在不增加后端负担的前提下，重构二维码相关能力为“前端主导”，并先输出可确认的实施计划。

### Phases
- [x] Phase A: 复盘现有二维码链路与后端耦合点（`api.js`/`staff-qr`/`scan-action`）
- [ ] Phase B: 联网调研微信小程序能力边界与前端可行实现
- [ ] Phase C: 形成方案对比、推荐路线与实施计划（待用户确认）

### Current Phase
- `Phase B in_progress`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| `web` 工具直连 `developers.weixin.qq.com` 失败 | 1 | 切换为可访问镜像/官方同源文档继续调研 |

### Update (2026-02-08)
- [x] Phase B: 联网调研微信小程序能力边界与前端可行实现
- [x] Phase C: 形成方案对比、推荐路线与实施计划（待用户确认）
- `docs/plans/2026-02-08-qr-frontend-first-plan.md` 已生成。
- `Current Phase` -> `Waiting for user confirmation`

### Update (2026-02-08, 用户新约束)
- [x] 方案重写为“二维码全前端化（后端仅业务计算）”。
- 新计划文档：`docs/plans/2026-02-08-qr-all-frontend-plan.md`。
- `Current Phase` -> `Waiting for user confirmation (business-level anti-forgery minimum set)`。

## 2026-02-08 二维码全前端化实现（后端仅业务计算）

### Goal
- 二维码生成、轮换、渲染、扫码解析主流程迁移到前端。
- 后端仅承担业务校验（时间窗/权限/状态流转/防重放/计数）。

### Phases
- [x] Phase A: 新增统一 payload 工具（build/parse/slot 窗口计算）
- [x] Phase B: 重构 staff-qr（前端本地换码，移除高频后端换码依赖）
- [x] Phase C: 重构 scan-action 与 consume 入参（结构化字段）
- [x] Phase D: 改造 mock API 为业务校验模式（不再返回二维码内容）
- [x] Phase E: 测试与文档更新

### Current Phase
- `Completed`

## 2026-02-08 API 文档重构（可读性与后端可执行性）

### Goal
- 彻底重构 `docs/API_SPEC.md`，让后端可直接按文档实现/联调，不再混杂前端实现细节。

### Phases
- [x] Phase A: 识别当前文档混乱点（特别是 4.4 / 4.5）
- [ ] Phase B: 重建文档信息架构（职责边界 -> 协议 -> 错误码 -> 联调清单）
- [ ] Phase C: 全量重写 API 文档正文
- [ ] Phase D: 对齐其他文档摘要并推送

### Current Phase
- `Phase B in_progress`

### Update (2026-02-08)
- [x] Phase B: 重建文档信息架构（职责边界 -> 协议 -> 错误码 -> 联调清单）
- [x] Phase C: 全量重写 API 文档正文
- [x] Phase D: 对齐变更记录并准备推送
- `Current Phase` -> `Completed`

### Update (2026-02-08, v4.0 深化)
- [x] 对齐真实调用链，确认主链路 API 覆盖完整（6/6）
- [x] 二次重构 4.4/4.5，提高后端可执行性与可读性
- [x] 补齐逐字段出参语义与 A-06 事务/并发/防重放要求
- [x] 更新变更日志与 planning 文件
- `Current Phase` -> `Completed (ready to commit/push)`

## 2026-02-08 登录注册绑定补齐 + API 文档 v4.1

### Goal
- 完整支持“微信首次登录识别未注册 -> 引导注册绑定 -> 防止同学号姓名多微信绑定”。
- 在 `docs/API_SPEC.md` 中补齐高可读传参示例与后端解析技术说明。

### Phases
- [x] Phase A: 以测试定义行为（未注册识别、重复绑定拦截、前端会话绑定状态）
- [x] Phase B: 改造 `src/utils/api.js` mock 登录/注册鉴权与唯一性约束
- [x] Phase C: 改造 `src/utils/auth.js`，按 `is_registered` 严格维护本地绑定状态
- [x] Phase D: 升级 `docs/API_SPEC.md` 到 v4.1（请求示例 + 解析技术 + 新状态码）
- [x] Phase E: 回归测试与语法校验，更新 planning 文件

### Current Phase
- `Completed`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| `superpowers-codex` 在 PowerShell 直接执行失败（文件关联问题） | 1 | 改用 `node C:\\Users\\Lenovo\\.codex\\superpowers\\.codex\\superpowers-codex ...` 方式执行 |

## 2026-02-08 管理员注册名册校验 + 页面分流 + 文档全量同步

### Goal
- 注册时后端按 `student_id + name` 查询管理员名册，命中后返回 `staff` 并进入管理员页面。
- 同步更新全部核心文档并推送到 GitHub。

### Phases
- [x] Phase A: 先补失败测试（管理员注册角色判定与返回字段）
- [x] Phase B: 改造 `src/utils/api.js` 注册逻辑（名册校验 -> 角色归一）
- [x] Phase C: 改造 `src/pages/register/register.js`（按后端返回角色即时跳转）
- [x] Phase D: 更新文档（README/REQUIREMENTS/FUNCTIONAL/API_SPEC/changes）
- [x] Phase E: 回归验证并准备提交推送

### Current Phase
- `Completed`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| PowerShell 下 `rg` 含括号/引号模式导致正则解析失败 | 1 | 改为 `--fixed-strings` 与分步检索 |

## 2026-02-08 API 文档参数语义细化（v4.3）

### Goal
- 解决“后端看不懂字段语义与传参来源”的问题。
- 将 `docs/API_SPEC.md` 提升到“后端按文档可直接实现”的细粒度。

### Phases
- [x] Phase A: 收敛用户疑问点（尤其 4.6 一致性校验）
- [x] Phase B: 为 A-01~A-06 增加参数落地解释（前端来源/后端解析/错误返回）
- [x] Phase C: 补充全局参数总则与参数速查表
- [x] Phase D: 回归验证并更新 planning 文件

### Current Phase
- `Completed`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| `~/.codex/.../superpowers-codex bootstrap` 在 PowerShell 直接执行失败 | 1 | 改为 `node C:\\Users\\Lenovo\\.codex\\superpowers\\.codex\\superpowers-codex bootstrap` |

## 2026-02-09 新需求：后端完整实现方案评审（先讨论）

### Goal
- 梳理当前 `docs/API_SPEC.md` 的完整后端能力边界（A-01~A-06）。
- 对照 `d:\\软件\\QQ\\suda_union.sql` 评估数据库设计是否可直接承载现有接口。
- 评估后端语言与技术栈，形成推荐方案与待确认决策。

### Phases
- [x] Phase A: 提取主链路接口、字段与事务要求
- [x] Phase B: 审查现有数据库结构并识别缺口（含 `user.wx_token`）
- [x] Phase C: 对比后端实现栈（Node.js / Java）并给出推荐
- [ ] Phase D: 与用户确认落地范围与技术选型

### Current Phase
- `Waiting for user decision`

## 2026-02-09 新需求：二维码后端主导实现（进行中）

### Goal
- 将二维码签发、时效校验、防重放与状态流转从前端迁移到真实后端服务。
- 前端仅负责展示二维码与扫码提交，降低前端可篡改风险。

### Phases
- [x] Phase A: 现状梳理（确认 `src/utils/api.js` 承担了 mock 后端职责）
- [x] Phase B: 制定实施计划（`docs/plans/2026-02-09-qr-backend-first-implementation-plan.md`）
- [ ] Phase C: 按 TDD 建立后端测试并落地 backend 服务
- [ ] Phase D: 前端 API/页面改造为后端驱动二维码
- [ ] Phase E: 全量验证与文档更新

### Current Phase
- `Phase C in_progress`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| `superpowers-codex` 在 PowerShell 直接执行失败（文件关联） | 1 | 改用 `node C:\Users\Lenovo\.codex\superpowers\.codex\superpowers-codex ...` |

### Update (2026-02-09, 完成)
- [x] Phase C: 按 TDD 建立后端测试并落地 backend 服务
- [x] Phase D: 前端 API/页面改造为后端驱动二维码
- [x] Phase E: 全量验证与文档更新
- `Current Phase` -> `Completed`

### Errors Encountered (This Task)
| Error | Attempt | Resolution |
|-------|---------|------------|
| 并行写入 `backend/tests` 时目录尚未创建 | 1 | 改为串行先建目录再写文件 |
| Node `fetch` 不允许 `GET` 携带 `body`（后端测试） | 1 | 测试请求器改为 `GET` 自动拼 query string |

## 2026-02-09 新需求：二维码后端化前端先行改造（仅前端 + API 文档）

### Goal
- 不落地后端实现代码，仅先完成小程序前端改造与 API 文档对齐。
- 将二维码职责明确为“后端签发 + 后端验签”，前端仅负责展示、刷新触发与扫码提交。

### Phases
- [x] Phase A: 盘点现状差异（`staff-qr` 已按后端票据实现，但 mock 与文档仍是前端组码口径）
- [x] Phase B: 改造前端调用链（`api.js` / `staff-qr.js` / `scan-action.js`）
- [x] Phase C: 升级 `docs/API_SPEC.md` 为后端签发票据口径（v4.5）
- [x] Phase D: 回归验证并同步变更记录

### Current Phase
- `Completed`

### Update (2026-02-09, 文档全量对齐 + 清理)
- [x] 全量核对 README/API/FUNCTIONAL/REQUIREMENTS 与当前代码一致性
- [x] 删除不再适用的二维码旧方案文档（docs/plans 下 3 个文件）
- [x] 清理 changes 文档中的不一致描述（如不存在的 backend 目录）
- [x] 准备提交并推送到 GitHub
- `Current Phase` -> `Ready for commit/push`
