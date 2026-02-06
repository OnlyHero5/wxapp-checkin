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
