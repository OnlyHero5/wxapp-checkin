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
  - 需求“已报名 或 已参加”可抽象为 `my_registered || my_checked_in`（后续已扩展到含 `my_checked_out`）。
- 实施决策：
  - 新增活动字段 `my_registered`（后端返回，普通用户可见性判定主字段之一）。
  - 后端列表 API 在 `normal` 角色下仅返回 `my_registered=true` 或 `my_checked_in=true` 的活动。
  - 后端详情 API 在 `normal` 角色下对不满足可见性条件的活动返回 `forbidden`（并附带 message）。
  - 前端详情页兼容 `forbidden` 响应，展示友好提示并返回上一页。
  - 文档统一改写“普通用户活动可见范围”与新增字段说明，避免联调歧义。

## 2026-02-08 新需求研究结果（动态二维码签到/签退）
- 当前问题确认：
  - 工作人员侧原流程为“工作人员自己扫码提交”，不满足“管理员展示码、普通用户扫码”的新业务。
  - 前端缺少独立扫码页，普通用户无法在统一入口执行签到/签退提交。
  - 后端 mock 缺少“二维码会话”抽象（展示过期与提交宽限是两套时间窗）。
- 关键设计决策：
  - 新增二维码会话接口：`POST /api/staff/activities/{id}/qr-session`。
  - 会话字段拆分为 `display_expire_at`（显示有效）与 `accept_expire_at`（提交宽限）。
  - 默认窗口：`rotate=10s`、`grace=20s`，前端按后端时间戳倒计时。
  - 新增普通用户提交接口：`POST /api/checkin/consume`，支持 `qr_payload/path/raw_result` 多来源解析。
  - 普通用户状态扩展：`my_checked_out`，状态文案统一为 `已报名/已签到/已签退`。
  - 管理员二维码页轮询详情接口，实时展示 `checkin_count/checkout_count`。
- UI/交互决策：
  - `index` 页工作人员按钮改为“签到码/签退码”，点击后跳转二维码页。
  - 新增 `pages/staff-qr`：二维码 + 倒计时 + 自动换码 + 手动刷新 + 实时统计。
  - 新增 `pages/scan-action`：摄像头扫码按钮 + 提交结果卡 + 返回活动页入口。

## 2026-02-08 需求变更调研（二维码前端主导）
- 现状代码确认：二维码生成高度依赖后端接口 `POST /api/staff/activities/{id}/qr-session`，前端仅负责倒计时与展示。
- 现状代码确认：普通用户扫码提交依赖后端接口 `POST /api/checkin/consume` 做 payload 解析与有效性判定。
- 现状代码确认：管理员二维码页每 10 秒自动刷新会触发服务端新会话生成，后端压力与并发活动数线性相关。
- 调研约束：`web` 工具无法直接打开 `developers.weixin.qq.com`，需使用可访问镜像与官方同源资料交叉核验。

## 2026-02-08 联网调研补充（二维码前端主导能力边界）
- 小程序扫码能力：`wx.scanCode` 支持扫码后直接返回结果，且当识别到小程序码时会返回 `path`（含 `scene`）。这意味着普通用户侧可完全前端化处理扫码输入与解析。
- 小程序码后端边界：`wxacode.getUnlimited` 等接口文档明确“应在服务端调用”，并依赖 `access_token`；该能力不适合直接放在前端。
- `scene` 约束：文档镜像与社区 issue 引用均指出 `scene` 上限为 32 个可见字符，要求前端化方案对 payload 做短编码（不能直接塞完整 JSON）。
- 安全约束：OWASP 与 Android 安全文档均强调客户端硬编码密钥可被逆向提取；授权与权限校验需在每次请求执行，不能只靠前端逻辑。
- 令牌轮换参考：RFC 4226/6238 给出一次性口令窗口与防重放原则，可作为“前端本地换码 + 后端轻量校验”方案的安全基线。
- 前端生成实现可行性：`weapp-qrcode` / `weapp-qrcode-canvas-2d` 提供小程序内绘制二维码能力，可替代“每 10 秒请求后端生成二维码图片”。

### 当前结论（用于方案设计）
- 可前端化：二维码绘制、轮换计时、扫码解析、提交重试、弱网容错。
- 不宜前端化：签名密钥保管、最终有效性判定、权限与重放校验。
- 推荐方向：改为“后端一次下发短时种子 + 前端本地轮换生成 + 后端按算法校验”，移除现有高频 `qr-session` 生成压力。

## 2026-02-08 用户确认的新约束（二维码全前端化）
- 用户明确要求：二维码相关功能整体放在小程序端实现。
- 用户明确要求：后端只计算业务数据，不承担二维码生成/换码职责。
- 用户明确要求：可以不使用微信官方二维码接口。

### 对应设计收敛
- 采用“前端本地生成与轮换二维码 + 后端业务校验”的架构。
- 后端保留的仅是业务规则：活动有效期、角色权限、重复提交、防重放窗口、统计更新。
- 高风险提醒：若后端不做任何业务防伪（仅信任前端 payload），将存在可伪造风险；需保留最小业务校验集合。

## 2026-02-08 实现发现（二维码全前端化）
- 新增 `src/utils/qr-payload.js`，统一二维码 payload 规范：
  - `wxcheckin:v1:<activity_id>:<action_type>:<slot>:<nonce>`
  - 提供 build/parse/current-slot/window-state 计算函数。
- `staff-qr` 页面改为本地换码：
  - 使用服务端时间校准 `serverOffsetMs`
  - 按 `slot` 变化本地生成新 payload，不再每 10 秒请求后端返回二维码内容。
- `scan-action` 页面新增结构化解析：
  - 扫码后解析 payload，并提交 `activity_id/action_type/slot/nonce`。
- `api.js` 的 `qr-session` 改为“配置接口”：
  - 返回 `rotate_seconds/grace_seconds/server_time`。
  - 移除会话二维码池与 `qr_payload` 生成职责。
- `checkin/consume` 改为业务判定：
  - payload 一致性校验（文本与结构化字段）
  - slot 时间窗校验（10s + 20s）
  - 报名可见性、活动状态、签到/签退状态流转
  - 防重放键与短窗限流
- 关键结果：二维码高频生成负载从后端转移至前端本地逻辑，后端保留业务安全兜底。

## 2026-02-08 API 文档重构问题定位
- 用户反馈明确：现有 API 文档 4.4/4.5 可读性差，后端无法直接理解。
- 核心问题：文档混入过多“前端本地实现描述”，导致后端职责边界不清。
- 核心问题：同一章节中同时出现“接口协议定义”和“实现历史说明”，读者路径混乱。
- 重构目标：
  1. 用“后端视角”重写接口契约；
  2. 明确二维码职责边界（前端生成，后端仅配置与业务校验）；
  3. 提供可直接执行的请求/响应、错误码、校验规则、联调步骤。

## 2026-02-08 API 文档重构产出
- `docs/API_SPEC.md` 已重构为 v3.0（后端实现版），结构从“页面触发视角”切换为“后端契约视角”。
- 4.4 重构结果：`qr-session` 明确为“二维码配置接口”，只返回 `activity_id/action_type/rotate_seconds/grace_seconds/server_time`。
- 4.5 重构结果：`checkin/consume` 增加“推荐请求、payload 协议、校验顺序、错误码矩阵”，可直接指导后端实现。
- 文档噪音清理：去除混杂的历史方案叙述与前端页面实现细节。

## 2026-02-08 API 文档深化重构产出（v4.0）
- 真实调用链再次对齐代码确认：当前小程序主链路仅依赖 6 个后端 API（`wx-login`、`register`、`activities`、`activity-detail`、`qr-session`、`consume`）。
- `docs/API_SPEC.md` 结构重建为“后端实施手册”：
  - 先定义职责边界与全局协议，再进入 4.1~4.6 六个接口的逐条规范。
  - 每条接口均包含：请求参数逐字段说明、后端处理步骤、成功返回字段逐字段说明、失败触发条件。
- 4.4/4.5 二次强化：
  - 4.4（活动详情）明确 normal/staff 权限路径、活动存在性与可见性校验。
  - 4.5（二维码策略）明确仅返回配置，不返回二维码文本/图片。
- A-06 二次强化：
  - 增补解析优先级、字段一致性校验、状态机约束、事务一致性、并发/防重放要求。
- 协议关键结论：
  - 为保证前端能拿到业务错误文案，建议业务失败保持 HTTP 2xx，并通过响应体 `status/message` 表达。

## 2026-02-08 登录注册绑定补齐（首次登录 + 防重复绑定）
- 代码现状问题确认：
  - mock 登录接口一直返回带学号姓名的 `user_profile`，导致“首次登录未注册”分支几乎不可触发。
  - 注册接口未校验“学号+姓名唯一”与“微信唯一绑定”，无法阻止多微信重复绑定同一身份。
  - `auth.applyLoginProfile` 仅在命中学号姓名时设为已绑定，但未对未注册返回做清理，存在旧缓存误判风险。
- 实施决策：
  - 登录返回新增 `is_registered`（后端主判断字段），未注册用户允许返回空 `student_id/name`。
  - mock 注册新增两类冲突状态：
    - `student_already_bound`：同学号姓名已被其他微信绑定。
    - `wx_already_bound`：同一微信已绑定其他学号姓名。
  - 注册建议以数据库唯一索引兜底并发：`UNIQUE(wx_identity)` + `UNIQUE(student_id, name)`（或 `UNIQUE(student_id)`）。
  - 前端以 `is_registered` 为准维护本地 `has_bound`，未注册时主动清空学号姓名缓存。
- 测试与验证结论：
  - 新增 `src/tests/auth-register-binding.test.js`（覆盖首次未注册、绑定成功、双向冲突拦截）。
  - 新增 `src/tests/auth-session-registration-state.test.js`（覆盖 `ensureSession` 未注册状态写入）。
  - 新增/既有测试全部通过，行为符合预期。

## 2026-02-08 API 文档升级（v4.1）
- 文档升级点：
  - 为 A-01~A-06 全部补齐“请求示例（传参示例）”。
  - 新增“3.6 后端解析技术建议”，明确 Node.js / Spring Boot 在 JSON 解析、参数校验、`wx_login_code` 兑换、会话、解密验签、防重放上的推荐技术。
  - A-01 新增 `is_registered` 字段说明与“未注册成功登录”示例。
  - A-02 新增 `student_already_bound`、`wx_already_bound` 的触发条件与冲突响应示例。

## 2026-02-08 管理员注册判定补齐（student_id + name）
- 业务缺口确认：
  - 注册流程之前只做“绑定唯一性”检查，未把 `student_id + name` 映射到管理员名册。
  - 注册页成功后未使用后端返回角色刷新本地 `role/permissions`，可能导致管理员注册后仍走普通用户页面。
- 实施决策：
  - 在 `POST /api/register` 中新增管理员名册判定：
    - 命中名册 -> `role=staff`, 下发管理员权限。
    - 未命中 -> `role=normal`, 权限为空。
  - 注册成功响应新增：
    - `role`
    - `permissions`
    - `admin_verified`
  - 注册页成功分支改为“以后端返回角色为准”进行本地落盘与跳转。
- 校验结论：
  - 新增/更新测试覆盖管理员命中与未命中两条路径，回归通过。
  - API 文档升级到 v4.2，并同步 README / REQUIREMENTS / FUNCTIONAL 口径。

## 2026-02-08 API 文档参数语义细化（v4.3）
- 用户反馈关键点：
  - A-06 中“一致性校验”语句抽象，后端不清楚具体比对对象与失败条件。
  - 多个接口字段虽有名称，但未明确“前端怎么传、后端怎么解析、非法时返回什么”。
- 本次文档补强结论：
  - 新增 `3.7 参数解释总则`，统一字段存在性、空值/非法值、类型转换与错误码优先级。
  - A-01~A-06 均新增“参数落地详解”小节，逐字段给出：
    - 前端来源
    - 后端解析动作
    - 推荐实现
    - 不合法返回
  - A-06 新增 `4.6.2A 一致性校验详解`，明确：
    - `qr_payload` 为主真值来源
    - `activity_id/action_type/slot/nonce` 为冗余字段
    - 冗余字段存在即必须与解析结果一致，不一致返回 `invalid_qr`
    - 提供场景矩阵与伪代码
  - 新增 `8. 参数速查表`，将跨接口关键字段汇总，降低后端落地成本。
