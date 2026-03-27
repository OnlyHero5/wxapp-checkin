# Findings & Decisions

## Requirements
- 审查是否存在过长的手写 HTML / CSS / JavaScript
- 审查是否违反“能用组件库就用组件库”的原则
- 联网学习组件库文档，判断现有手写实现能否由组件库替代
- 审查是否存在“看似用了组件库，实则只是套壳手写”的实现
- 审查是否存在单文件过长、失去可维护性的情况

## Research Findings
- `wxapp-checkin` 当前前端目录为 `web/`
- `web/package.json` 显示当前 UI 依赖为 `tdesign-mobile-react`
- 当前工作分支为 `wxapp-checkin/web`
- `src` 规模约 7893 行（含测试），运行时代码中长度较高的文件集中在 `pages/`、`shared/ui/` 和 `features/staff/components/`
- 运行时代码里较长的文件包括 `src/pages/checkin/CheckinPage.tsx`（197 行）、`src/pages/activity-detail/ActivityDetailPage.tsx`（193 行）、`src/pages/activity-roster/ActivityRosterPage.tsx`（182 行）、`src/shared/ui/ActivityMetaPanel.tsx`（163 行）、`src/features/staff/components/DynamicCodePanel.tsx`（156 行）
- 全局样式集中在 `src/app/styles/*.css`，其中 `staff-page.css`（162 行）、`layouts.css`（130 行）、`page-shell.css`（99 行）较长，存在页面级样式持续膨胀风险
- 当前已直接引用 `tdesign-mobile-react` 的文件约 20 个，说明项目不是完全未用组件库，但需要检查是否只用了基础壳层组件（`Cell`、`Form`、`Button`、`Tabs` 等）后仍在业务侧重复手写
- 静态扫描未发现覆盖 `.t-*` 内部类名的样式；项目主要通过公开组件 API 和 CSS 变量使用 TDesign，这一点是健康的
- `npm run lint` 与 `npm run build` 均通过，说明审查基于当前可构建基线
- 官方文档确认 `Tabs` 支持 `sticky`、`theme`、`TabPanel` 等能力，项目已正确复用这些公开能力
- 官方文档确认 `CellGroup` 只有 `theme="card"`、`title` 等基础卡片能力，并不提供当前项目 `ActivityMetaPanel` 所需的标题区状态位、描述区与 footer slot 组合
- 官方文档确认 `Navbar` 主要提供 `left/right/title`、`leftArrow`、`safeAreaInsetTop` 等导航栏能力，不提供当前 `MobilePage` 这种整页 surface 壳层
- 官方文档确认 `NoticeBar` 用于页面或模块顶部的持续提示，`Message` / `Toast` 则偏轻量反馈；当前项目把页内错误和成功提示都统一到 `NoticeBar`

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 以 `tdesign-mobile-react` 为组件库对照基线 | 这是当前项目已安装且实际依赖的 UI 库 |
| 审查结论按“组件库替代空间 + 代码可维护性”双轴整理 | 这与用户提出的 5 项要求直接对应 |
| 把 `ActivityMetaPanel` / `MobilePage` 视为“项目层自建壳层”而非直接违规 | 官方组件库没有等价的完整页面壳和信息卡片原语，但这些壳层已经开始形成第二套设计系统，需要单独管控 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 仓库指南与当前前端目录不一致 | 使用真实目录 `web/` 继续审查 |

## Resources
- `/home/psx/app/wxapp-checkin/web/package.json`
- `/home/psx/app/wxapp-checkin/web/src`
- `/home/psx/app/wxapp-checkin/task_plan.md`
- https://tdesign.tencent.com/mobile-react/components/cell?tab=api
- https://tdesign.tencent.com/mobile-react/components/tabs?tab=api
- https://tdesign.tencent.com/mobile-react/components/navbar?tab=api
- https://tdesign.tencent.com/mobile-react/components/notice-bar?tab=api
- https://tdesign.tencent.com/mobile-react/components/message?tab=api
- https://tdesign.tencent.com/mobile-react/components/layout?tab=api
- https://tdesign.tencent.com/mobile-react/components/grid?tab=api
- https://tdesign.tencent.com/mobile-react/components/footer?tab=api

## Visual/Browser Findings
- 官方站点组件目录确认 `tdesign-mobile-react` 具备 `Layout`、`Navbar`、`TabBar`、`Tabs`、`Cell`、`Grid`、`Footer`、`Message`、`NoticeBar`、`SwipeCell` 等原语
- `NoticeBar` 设计说明强调“在导航栏下方，用于给用户显示提示消息”，并支持错误/成功/警告主题，适合持续停留的顶部提示
- `Message` / `Toast` 设计说明强调“轻量级反馈或提示，不会打断用户操作”，更适合短时反馈
