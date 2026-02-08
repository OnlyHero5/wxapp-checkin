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
- 已创建并推送 release tag：`v2026.02.04`。
- 更新 README.md，补充 TDesign、构建步骤与发布信息。
- 已将发布标签 `v2026.02.04` 重新指向最新提交。
- 新增 `docs/API_SPEC.md`，提供后端接口说明（code/message/data 统一返回）。

## 2026-02-06
- 登录后角色分流落地：普通用户 / 工作人员两套页面能力。
- 活动页改为活动卡片模型，支持可选签到、签退、详情按钮。
- 普通用户活动卡片展示“我的签到状态”，不展示总签到人数。
- 普通用户“我的”页新增积分卡（社会分、讲座分），并移除“曾参加活动”卡片。
- 新增 `pages/activity-detail` 页面。
- 更新 `docs/API_SPEC.md`，补充角色、权限、积分、活动状态字段定义。

## 2026-02-07
- 活动页升级为双分组卡片：`正在进行` / `已完成`，组内按时间倒序。
- 已完成活动只保留“详情”按钮；签到/签退仅对进行中活动开放。
- 新增活动类型彩色胶囊（路演/竞赛等），优化活动卡片视觉层级。
- 下线 `records` 与 `record-detail` 页面入口，清理“曾参加活动”重复信息。
- 重写 `docs/API_SPEC.md` 为前端联调版，明确每个接口对应页面功能与前端呈现。
- 同步更新 `docs/FUNCTIONAL_SPEC.md`、`docs/REQUIREMENTS.md`、`README.md`。

## 2026-02-08
- 普通用户活动可见性收敛为“已报名或已参加”：
  - 列表仅返回 `my_registered=true` 或 `my_checked_in=true` 或 `my_checked_out=true` 的活动
  - 未报名未参加活动对普通用户不可见
- 普通用户活动详情鉴权补齐：
  - 访问不可见活动详情返回 `forbidden`
  - 前端收到 `forbidden` 后提示并返回上一页
- 活动字段补充：
  - 新增 `my_registered` 并与 `my_checked_in` 共同驱动“我的状态”
- 已同步更新主文档：`docs/API_SPEC.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/REQUIREMENTS.md`、`README.md`。
- 新增动态二维码签到/签退流程：
  - 管理员在活动页点击“签到码/签退码”进入二维码页（10 秒自动换码，20 秒宽限）
  - 普通用户新增“签到/签退”扫码页，摄像头扫码后即时反馈
  - 后端新增二维码会话接口与扫码消费接口，管理员端实时更新已签到/已签退人数
- 二维码链路按“前端主导”重构：
  - 管理员二维码改为前端本地换码生成，不再依赖后端按 10 秒高频返回二维码内容
  - `qr-session` 接口仅返回换码配置（`rotate_seconds/grace_seconds/server_time`）
  - `checkin/consume` 支持结构化字段并加入业务级防重放与时间窗校验
