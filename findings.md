# Findings & Decisions

## Requirements
- Redesign all four pages: index, records, record-detail, register
- Add a new minimal “个人中心” page and tabBar entry
- Visual style: Moonshot-like geek minimalism, dark background dominant
- Use TDesign (腾讯官方小程序组件库) as the primary UI building blocks; remove Ant Design
- Keep key status feedback (network, success, errors) and animations
- Record changes in changes.md

## Research Findings
- Product docs emphasize 10s rolling QR, non-repeat check-in, and clear error states.
- Current layout uses plain WXML + custom CSS, no AntD components detected in src.
- Global styling is centralized in src/app.wxss; page wxss files are empty.
- Tab bar currently has two items: 签到, 记录 (text only).
- Storage keys exist for session, wx identity, studentId, name, and bound status in src/utils/storage.js.
- Page JS already handles network status and bound checks; no logic changes needed for UI refactor.
- TDesign miniprogram uses npm package `tdesign-miniprogram` with `usingComponents` paths like `tdesign-miniprogram/button/button`; min base library version ^2.6.5; npm install is the recommended install method.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Adopt Obsidian Grid dark minimal design | Closest to Moonshot style and user preference |
| Keep global theme tokens in app.wxss | Ensures consistency across all pages |
| Minimal “个人中心” content only | User explicitly requested option 3 |
| TabBar text-only | Keeps minimalism and avoids icon asset management |
| Use TDesign components across pages | Align with Tencent official component library request |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| session-catchup.py path missing under .claude | Located script under .codex and executed |
| Recursive search timeout | Used targeted path search |

## Resources
- docs/REQUIREMENTS.md
- docs/FUNCTIONAL_SPEC.md
- docs/plans/2026-02-03-moonshot-miniapp-design.md
- docs/plans/2026-02-03-moonshot-tdesign-ui-design.md
- docs/plans/2026-02-03-moonshot-tdesign-ui-implementation.md
- docs/plans/2026-02-03-moonshot-ui-implementation-plan.md
- src/app.json
- src/app.wxss
- src/pages/index/index.wxml
- src/pages/records/records.wxml
- src/pages/record-detail/record-detail.wxml
- src/pages/register/register.wxml
- design-system/moonshot-checkin/MASTER.md

## Visual/Browser Findings
- Existing pages use header + card layout with simple list patterns; all are light theme by default.
- Current status messaging relies on inline banners and hint text.
- Success overlay is implemented in index with a modal-like card.

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

## 2026-02-04 继续执行
- 用户要求：继续执行并更新根目录 Markdown 文档，且以中文为主记录。
- 已更新执行计划：新增“更新根目录文档 + 提交 + 推送”步骤，并将打 tag 放在文档提交之后。

## 2026-02-04 文档同步
- 根目录文档当前以英文为主，需补充中文执行记录与发布收尾。
- 计划将本次清理与发布流程写入 changes.md / progress.md / task_plan.md。
- 已完成发布标签：`v2026.02.04` 并推送至 GitHub。

## 2026-02-04 README 检查
- 根目录 README.md 仍为早期描述，缺少 TDesign、构建方式与发布信息，需要补充。
- README.md 已更新为当前实现状态与构建流程说明。

## 2026-02-04 文档全量检查
- 发现 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md` 与 `docs/plans/2026-02-03-moonshot-miniapp-design.md` 仍停留在 02-03，需要补充 02-04 的 TDesign/发布收尾说明。
- `docs/changes.md` 需追加 README 更新与 tag 重新指向最新提交的记录。
- 已完成全量 Markdown 复核与补齐（需求/功能/计划/变更/README）。
- `.backup-untracked/` 已加入 .gitignore 保留备份但不再影响状态。
- 发布标签 `v2026.02.04` 已重新指向 main 最新提交。

## 2026-02-04 API 对齐
- 现有前端实现定义的接口：/api/auth/wx-login、/api/register、/api/checkin/verify、/api/checkin/records、/api/checkin/records/{id}、/api/activity/current。
- 请求字段与返回字段已在 src/utils/api.js 中明确（包含 session_token、student_id、name、qr_token、checkin_record_id 等）。
- 将新增 docs/API_SPEC.md 作为后端接口说明主文档。
- API 说明文档已建立：docs/API_SPEC.md（统一返回结构）。

## 2026-02-06 新需求研究结果（角色分流 + 活动卡片）
- 现状：`app.json` 目前 tabBar 为 `签到/记录/个人中心`，无角色分流机制。
- 现状：`index` 是“单活动扫码签到”页面，不是“多活动卡片管理”。
- 现状：`profile` 仅展示姓名学号绑定状态，信息维度不足。
- 现状：`auth.ensureSession` 只缓存 `session_token/wx_identity`，没有角色和权限字段。
- 现状：mock API 仅支持 `/api/activity/current` 单活动，不支持工作人员活动列表和签到/签退动作。
- 约束：微信小程序 tabBar 为静态配置，不适合直接按角色动态删减；更稳妥方案是普通用户进入活动 tab 时自动转到个人页。

### 实施决策
| 决策 | 理由 |
|------|------|
| 在 `storage` 增加 role/permissions/department/club/avatar 等字段 | 满足个人信息展示与角色分流 |
| 在 `auth.ensureSession` 中接收登录返回的角色与用户资料并缓存 | 角色判断需在页面加载初期可用 |
| `index` 改为工作人员活动列表，普通用户 `switchTab` 到 profile | 在静态 tabBar 条件下最接近“普通用户仅个人页” |
| `profile` 增加历史活动列表（复用 records API） | 满足“可选显示曾参加活动”需求 |
| 新增 `activity-detail` 页面承接“详情”按钮 | 满足卡片详情可选需求，并便于后续对接后台 |

### 已完成实现（2026-02-06）
- 已在 mock 登录返回中引入 `role + permissions + user_profile`，并提供 `config.mockUserRole` 切换（`staff` / `normal`）。
- 已实现工作人员活动接口：`/api/staff/activities`、`/api/staff/activity-action`、`/api/staff/activities/{id}`（mock）。
- 已实现活动卡片操作：
  - `签到`：始终展示，扫码后调用 staff action
  - `签退`：仅当 `support_checkout=true` 展示
  - `详情`：仅当 `has_detail=true` 展示，并跳转新页面
- 已实现普通用户分流：进入活动 tab 时自动跳转个人信息页。
- 已实现个人页扩展：姓名/学号/学院部门/社团组织/账号状态 + 历史活动列表。

## 2026-02-06 补充需求调整
- 用户新增要求：普通用户“我的”页底部展示“社会分 + 讲座分”。
- 用户新增要求：活动页需要显示活动卡片（普通用户不再自动跳转个人页）。
- 调整决策：
  - 保留工作人员在活动卡片上的签到/签退/详情操作；
  - 普通用户仅展示活动卡片与详情按钮，不展示签到/签退按钮；
  - 社会分与讲座分由登录 profile 字段 `social_score/lecture_score` 提供并落本地缓存。

## 2026-02-06 二次补充（普通用户视角）
- 普通用户“我的”页面移除“曾参加活动”卡片。
- 普通用户“活动页面”卡片不展示“已签到多少人”，仅展示“我的签到状态（已签到/未签到）”。
- 分数字段继续保持后端返回来源，不在前端做业务计算。

## 2026-02-07 新需求研究结果（工作人员页去重 + 活动分组）
- 现状：`profile` 的“曾参加活动”仅对工作人员展示，且跳转 `record-detail`，和活动页信息重复。
- 现状：活动页目前是单列表，不区分进行状态，排序依赖后端返回顺序。
- 决策：直接移除 `profile` 历史活动卡片及其数据请求逻辑，避免重复入口。
- 决策：在前端按 `progress_status/activity_status` 优先分类；无状态字段时按 `start_time` 与当前时间回退判断。
- 决策：活动分组顺序固定为“正在进行”在上，“已完成”在下；两组均按时间倒序。
- 决策：hack/mock 数据补充多类型活动（进行中/已完成、可签退/不可签退、可详情/不可详情），提高验收覆盖率。

## 2026-02-07 用户反馈修正（已完成活动按钮 + 视觉）
- 问题：`已完成` 分组仍显示 `签到/签退`，与业务语义冲突。
- 修正：活动按钮条件改为仅 `section.key === 'ongoing' && role === 'staff'` 显示 `签到/签退`；`已完成` 仅保留 `详情`。
- 防护：在 `scanAndSubmit` 与 mock API `staff/activity-action` 两侧增加 `completed` 拦截，避免绕过 UI 触发操作。
- 视觉改造：活动页新增顶部概览卡（进行中/已完成计数），卡片操作区下移到底部，分组头强化标签与统计，提升页面秩序与可读性。

## 2026-02-07 联网样例研究（色彩增强）
- 用户反馈：当前活动页色彩偏单一，需要更明显的信息色层级。
- 联网样例与规范参考：
  - Material Design Chips（强调圆角胶囊作为类别信息载体）
  - MUI Chip（分类标签和状态色组合实践）
  - Atlassian Lozenge（语义色标签用于分类/状态）
  - Dribbble 活动卡片样例（深色背景下通过局部高饱和标签提取视觉焦点）
- 落地策略：
  - 增加 `activity_type -> tone` 映射（路演/竞赛/工作坊/论坛/讲座/培训/社群/展会）。
  - `WXML` 通过 `activity-type-{{activity.type_tone}}` 注入动态样式类。
  - `WXSS` 为每个 `tone` 提供渐变底色 + 边框 + 对应文字色，形成“圆角长方体高亮”效果。
  - 进行中/已完成卡片再做轻量背景色差，提高分组感知。

## 2026-02-07 文档重构发现（接口定位精细化）
- 原 `docs/API_SPEC.md` 存在“字段有、场景无”的问题：未明确具体页面触发点与前端呈现结果，后端难以按 UI 回归。
- 当前真实路由仅 4 个页面（`index/register/activity-detail/profile`），`records` 与 `record-detail` 已下线。
- 活动页真实规则已升级：双分组、组内倒序、已完成仅详情、进行中才允许 staff 扫码动作。
- 文档修正策略：
  - 在 API 文档中新增“接口 -> 前端函数 -> 页面入口 -> 成功/失败表现 -> 测试定位”链路。
  - 对未接入 UI 的保留接口单独标识，避免后端误判为主验收阻塞项。
  - 在 README/功能说明/需求文档中统一页面结构和按钮规则，避免跨文档冲突。

## 2026-02-08 新需求研究结果（普通用户可见性收敛）
- 当前问题确认：
  - `src/pages/index/index.js` 的 `loadActivities` 直接渲染 `/api/staff/activities` 返回的全量活动。
  - 普通用户虽然仅显示 `my_checked_in`，但依然可看到未报名未参加的活动卡片。
  - `src/utils/api.js` 的 `/api/staff/activities/{id}` 未做普通用户归属校验，存在通过活动 ID 查看任意活动详情的风险（mock 侧）。
- 现有字段现状：
  - 已有 `my_checked_in`，但缺少“已报名”显式字段。
  - 需求“已报名 或 已参加”可抽象为 `my_registered || my_checked_in`。
- 实施决策：
  - 新增活动字段 `my_registered`（后端返回，普通用户可见性判定主字段之一）。
  - 后端列表 API 在 `normal` 角色下仅返回 `my_registered=true` 或 `my_checked_in=true` 的活动。
  - 后端详情 API 在 `normal` 角色下对不满足可见性条件的活动返回 `forbidden`（并附带 message）。
  - 前端详情页兼容 `forbidden` 响应，展示友好提示并返回上一页。
  - 文档统一改写“普通用户活动可见范围”与新增字段说明，避免联调歧义。
