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
- 会话失效恢复能力补齐：
  - 统一约定后端返回 `status=forbidden + error_code=session_expired`
  - 前端收到后清理本地登录态并跳转 `pages/login` 自动重登
  - `README.md` / `docs/API_SPEC.md` / `docs/FUNCTIONAL_SPEC.md` / `docs/REQUIREMENTS.md` 同步更新
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
- API 文档可读性重构：
  - `docs/API_SPEC.md` 重写为 v3.0（后端实现版）
  - 重点重构 4.4/4.5，避免前端实现细节干扰后端联调
- API 文档深化重构：
  - `docs/API_SPEC.md` 升级至 v4.0，完整覆盖主链路 6 个后端 API（A-01~A-06）
  - 所有接口补齐“入参逐字段说明 + 后端处理步骤 + 出参逐字段说明 + 错误触发条件”
  - A-06 增补事务一致性、并发与防重放要求，后端可直接按文档实现
  - 明确业务错误通过响应体 `status` 返回，减少前端误判为网络异常
- 注册绑定管理员识别补齐：
  - `POST /api/register` 新增 `student_id + name` 管理员名册判定
  - 命中管理员名册返回 `role=staff` 与权限集，注册后直接进入管理员页面
  - 未命中返回 `role=normal`，进入“我的”页面
  - 注册响应新增 `admin_verified`，用于联调定位管理员判定结果
- 文档同步升级：
  - `docs/API_SPEC.md` 升级到 v4.2（管理员名册判定步骤 + 响应示例）
  - `README.md`、`docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md` 同步新口径

## 2026-02-09
- 二维码后端化前端先行改造（本次）：
  - `src/pages/staff-qr/staff-qr.js` 仅请求 A-05 获取二维码，不再前端本地组码。
  - `src/pages/scan-action/scan-action.js` 改为“扫码原文直传 A-06”为主，减少前端解析耦合。
  - `src/utils/api.js` 对齐当前接口口径：A-05 mock 返回 `qr_payload/display_expire_at/accept_expire_at`；A-06 冗余字段按需传递。
  - `docs/API_SPEC.md` 升级到 v4.5，A-05/A-06 与当前代码行为对齐。
  - `README.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/REQUIREMENTS.md` 全量清理旧口径并同步当前实现。
  - 删除过时二维码方案文档：`docs/plans/2026-02-08-qr-frontend-first-plan.md`、`docs/plans/2026-02-08-qr-all-frontend-plan.md`、`docs/plans/2026-02-09-qr-backend-first-implementation-plan.md`。
