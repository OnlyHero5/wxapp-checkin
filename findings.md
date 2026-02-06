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
