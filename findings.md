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
