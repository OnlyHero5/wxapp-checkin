# Changes Log

> 详细记录请见 `docs/changes.md`。此处保留关键更新摘要。

## 2026-02-04
- 切换至 `tdesign-miniprogram` 组件库并移除 AntD 依赖。
- 完成 4 个核心页面的 TDesign 化（签到、记录、详情、注册）。
- 新增“个人中心”页面与 TabBar 入口。
- 将 NPM 配置迁移到 `src/` 以支持 DevTools 构建。
- 视觉风格调整为“石墨雾”，降低黑白撞色的突兀感。
- 主按钮色调整为深蓝，整体更稳重。
- 统一主按钮为居中展示。

## 2026-02-04（发布收尾）
- 移除旧 worktree：`.worktrees/moonshot-miniapp-design`。
- 本地 `main` 已与 `origin/main` 同步，未跟踪文件已备份至 `.backup-untracked/20260204-1107`。
- 根目录文档以中文补充发布与清理记录。
- 计划创建并推送 release tag。
