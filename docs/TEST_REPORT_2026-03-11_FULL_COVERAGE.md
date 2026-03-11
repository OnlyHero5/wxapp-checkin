# 三项目全覆盖测试报告（重点：wxapp-checkin 数据同步与 Web 端稳定性）

更新时间：2026-03-11  
范围：`/home/psx/app` 下三项目（`suda_union`、`suda-gs-ams`、`wxapp-checkin`）  

> 说明
>
> - 本报告强调“可复现证据”：关键命令、关键接口响应、日志与 DB 快照均以文件落盘方式记录（见第 2 节）。
> - “全覆盖”的定义按**功能点清单**逐项覆盖：能自动化的用自动化；必须交互/UI 才能覆盖的，提供可执行的手工验证步骤与断言点，并在“实际执行结果”中标注是否已执行。
> - `suda_union/` 与 `suda-gs-ams/` 在本仓库约束下只做运行与验证，不做任何实现逻辑改动；`wxapp-checkin/` 若发现问题，本报告只记录问题与建议修复方向，不在本轮直接改代码。

---

## 0. 测试结论摘要

- 三项目启动：✅ 通过联调脚本可稳定拉起并完成闭环（见第 2 节 RUN_ID）。
- 自动化测试：✅ `wxapp-checkin/backend` 与 `wxapp-checkin/web` 全绿；`suda-gs-ams` build 通过但 lint 存在大量历史问题；`suda_union` 通过离线 settings + test profile 可在“无外网 DNS”环境跑通 `mvn test`（见第 4 节）。
- 联调数据同步：✅ outbox 可写回 legacy（`check_in/check_out`），并可被后续 legacy pull 拉回投影；未发现“永久不同步/数据丢失”的确定性问题。
- Web 代码风险评估（是否会导致与另外两项目数据同步异常）：Web 端本身不直接写 legacy/其它项目 DB，不会“制造同步异常”；批量签退后的“状态回退/统计延迟”问题（WX-SYNC-001）已通过后端顺序治理 + 回归测试修复（见第 6 节）。
- wxapp-checkin 问题清单（按严重级）：见第 6 节

---

## 1. 测试环境与基线

### 1.1 本地依赖与端口（基线）

- MySQL：`127.0.0.1:3307`（用户：`wxcheckin`，密码：`wxcheckin_test`）
- Redis：`127.0.0.1:16379`
- `suda_union`：`http://127.0.0.1:8088`
- `suda-gs-ams`：`http://127.0.0.1:5173`（通过 `/api/*` 代理到 `suda_union`）
- `wxapp-checkin/backend`：`http://127.0.0.1:9989`

### 1.2 数据基线（legacy / ext）

- legacy schema：`/home/psx/app/suda_union (1).sql`
- legacy seed（最小联调用例）：`/home/psx/app/local_dev/mysql/seed_suda_union_final.sql`
- ext reset（仅清理业务数据，保留表结构/Flyway）：`/home/psx/app/local_dev/mysql/reset_wxcheckin_ext_data.sql`

---

## 2. 证据与产物落盘位置

### 2.1 一键联调脚本产物

联调脚本：`/home/psx/app/local_dev/scripts/run_wxapp_checkin_full_integration_test.sh`

每次运行会生成：

- `local_dev/runtime/integration_test_<RUN_ID>/logs/`：三项目日志
- `local_dev/runtime/integration_test_<RUN_ID>/responses/`：关键接口响应与 DB 快照

本次报告对应的 RUN_ID：`integration_test_20260311_145139`

### 2.2 本报告生成时的命令执行记录

建议以“命令 + 结果摘要 + 关键日志路径”记录，便于复现与回归（执行后补齐）。

---

## 3. 功能点清单与覆盖矩阵（执行中持续补齐）

### 3.1 suda_union（后端服务）

覆盖依据：`/home/psx/app/suda-gs-ams/suda_union接口文档1.md` + 控制器清单（`suda_union/src/main/java/com/suda_union/controller`）

必测功能点（P0/P1）：

- [x] 登录 `/suda_login`（通过 `suda-gs-ams` 代理）
- [ ] 登录 `/suda_login`（直连 `suda_union:8088`，仅作为补充链路）
- [ ] token 校验 `/token`
- [x] 菜单 `/menuList`（通过 `suda-gs-ams` 代理）
- [x] 活动/讲座查询（`/activity/searchAll`、`/activity/searchById`）
- [ ] 活动/讲座：创建、修改、删除
- [x] 报名/状态读取（`/activity/usernameApplications`）
- [ ] 报名/候补/取消报名写入
- [ ] 用户管理：批量导入/创建/封锁/解封、查看用户信息
- [x] 部门：`/department/allDepartment`、`/department/allMembers`
- [ ] 部门：创建/删除/成员查询/任命职务
- [ ] 反馈：创建/查看/对话/结束
- [ ] 日志：查看

说明：若受限于“缺少可用测试数据/文件上传附件/依赖外部服务”等原因导致无法在本地覆盖，将在第 5 节记录“阻塞原因与替代验证策略”。

### 3.2 suda-gs-ams（管理端前端）

覆盖依据：目录结构（`src/features/*`、`src/pages/*`）+ 与 `suda_union` 的接口联通性。

必测功能点（P0/P1）：

- [x] 登录页：能登录并拿到 token（`/api/suda_login`，脚本冒烟）
- [x] 菜单接口：`/api/menuList` 可返回菜单数据（脚本冒烟）
- [ ] 菜单/路由：按角色展示差异（至少 role=0/2/4）
- [ ] 活动管理（activity-admin）：列表/创建/编辑/删除/详情
- [ ] 活动报名管理（activity-apply）：查看报名/候补/补报名等
- [ ] 组织与部门（org）：部门列表/成员
- [ ] RBAC（rbac）：角色/权限页面基本可访问
- [ ] 系统（system）：基础配置页面可访问
- [ ] 反馈（feedback）：列表/详情/对话
- [ ] profile：个人信息/改密

说明：仓库内缺少 UI 自动化测试基线时，本轮以“页面可达 + 关键接口响应正确 + build/lint 通过”为主；必要的深度交互测试将以可执行的手工步骤列出，并在第 4 节注明是否已执行。

### 3.3 wxapp-checkin（Web-only 前端 + 后端 + 同步链路）

覆盖依据：`wxapp-checkin/docs/REQUIREMENTS.md`、`wxapp-checkin/docs/FUNCTIONAL_SPEC.md`、`wxapp-checkin/docs/API_SPEC.md` + 后端控制器（`wxapp-checkin/backend/.../api/controller`）+ Web 页面目录（`wxapp-checkin/web/src/pages`）。

必测功能点（P0/P1）：

- [x] 账号密码登录（默认 123）+ 首次登录强制改密
- [x] 会话失效处理（联调脚本覆盖强制改密拦截；单测覆盖 `session_expired` 归一化）
- [x] 活动列表（staff 全量可见 / normal 仅本人相关）
- [x] 活动详情
- [x] staff 动态码：签到码生成（含时间窗校验）
- [x] normal 输入 6 位码：签到（含 invalid/expired/duplicate）
- [ ] normal 输入 6 位码：签退（本轮脚本未单独覆盖 checkout 动态码消费，建议补充）
- [x] staff 一键全部签退（confirm 语义）
- [x] legacy pull：`suda_union -> wxcheckin_ext` 投影/状态同步
- [x] outbox relay：`wxcheckin_ext -> suda_union` 写回 `suda_activity_apply.check_in/check_out`
- [x] 最终一致性：bulk-checkout + outbox + legacy 回写 + 读接口可见（含 after_wait 对齐证明）

---

## 4. 实际执行的测试与结果

### 4.1 三项目启动与健康检查

- 三项目一键启动（端口监听 + 基础登录校验）：
  - 命令：`cd /home/psx/app && ./local_dev/scripts/start_3_projects_integration.sh`
  - 结果：脚本内检查 `8088/5173/9989` 端口监听成功，并通过 `suda-gs-ams -> /api/suda_login -> /api/menuList` 完成联通性校验。
- 联调脚本启动与健康检查（更强证据，包含 actuator/首页探测）：
  - 命令：`cd /home/psx/app && ./local_dev/scripts/run_wxapp_checkin_full_integration_test.sh`
  - 结果：脚本内 `wait_http` 通过：
    - `GET http://127.0.0.1:9989/actuator/health` => `200`
    - `GET http://127.0.0.1:5173/` => `200`

### 4.2 自动化测试

- `wxapp-checkin/backend`：
  - 命令：`cd wxapp-checkin/backend && ./mvnw -s /home/psx/app/local_dev/maven/settings.no_proxy.xml -Dmaven.repo.local=/home/psx/.m2/repository test`
  - 结果：`BUILD SUCCESS`；`Tests run: 32, Failures: 0, Errors: 0, Skipped: 0`
- `wxapp-checkin/web`：
  - 命令：`cd wxapp-checkin/web && npm test && npm run build`
  - 结果：`14` 个测试文件、`54` 个用例通过；`vite build` 成功产出 `dist/`
- `suda-gs-ams`：
  - 命令：`cd suda-gs-ams && npm run lint && npm run build`
  - 结果：
    - `npm run lint`：❌ 发现大量历史遗留 eslint 问题（主要为 `no-explicit-any` 等），不阻塞运行但不符合“提交前 lint 通过”的工程基线。
    - `npm run build`：✅ 构建成功（产出 `dist/`）
- `suda_union`：
  - 命令：`cd suda_union && mvn -o -gs /home/psx/app/local_dev/maven/settings.global_dual_repo.xml -s /home/psx/app/local_dev/maven/settings.no_proxy.xml -Dmaven.repo.local=/home/psx/.m2/repository test`
  - 结果：✅ `BUILD SUCCESS`；`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`
  - 说明：通过仅配置层调整（pin `maven-surefire-plugin=3.5.3` + 引入 `junit-bom` + 增加 test profile 使用 H2 + Mockito mock-maker-subclass），在“无外网 DNS”的环境也可离线跑通。

### 4.3 联调冒烟（数据同步证据）

- 最新 RUN_ID：`integration_test_20260311_145139`
- 运行目录：
  - logs：`/home/psx/app/local_dev/runtime/integration_test_20260311_145139/logs`
  - responses：`/home/psx/app/local_dev/runtime/integration_test_20260311_145139/responses`

覆盖点与关键证据：

1) `suda-gs-ams -> suda_union` 冒烟（证明三项目联通 + 代理可用）
   - `POST /api/suda_login`：`responses/suda_login.resp.json`
   - `POST /api/menuList`：`responses/suda_menu_list.resp.json`
   - `POST /api/activity/searchAll`：`responses/suda_activity_search_all.resp.json`
   - `POST /api/activity/searchById`：`responses/suda_activity_search_by_id.resp.json`
   - `POST /api/department/allDepartment`：`responses/suda_department_all.resp.json`
   - `POST /api/department/allMembers`：`responses/suda_department_members.resp.json`
   - `POST /api/activity/usernameApplications`（normal 报名记录可见）：`responses/suda_username_applications.resp.json`

2) `wxapp-checkin` staff 登录/改密/活动列表/发码
   - staff 登录：`responses/staff_login.resp.json`
   - staff 改密：`responses/staff_change_password.resp.json`
   - staff 活动列表：`responses/staff_activities.resp.json`
   - 发码（主流程 101）：`responses/code_session_101_checkin_fresh.resp.json`
   - 发码（负例 102 时间窗）：`responses/code_session_102_checkin.resp.json`

3) normal 登录/必须改密拦截/活动列表
   - normal 登录：`responses/normal_login_0101.resp.json`
   - 改密前拉列表（应 `password_change_required`）：`responses/normal_activities_before_change.resp.json`
   - normal 改密：`responses/normal_change_password.resp.json`
   - normal 活动列表（仅本人相关）：`responses/normal_activities.resp.json`

4) normal 动态码消费（invalid/expired/duplicate/success）
   - invalid：`responses/consume_invalid.resp.json`
   - expired：`responses/consume_expired.resp.json`
   - success：`responses/consume_checkin.resp.json`
   - duplicate：`responses/consume_checkin_dup.resp.json`

5) outbox relay 写回 legacy（DB 双证据）
   - 签到后：`responses/legacy_apply_101_0101_after_checkin.tsv`（期望 `1<TAB>0`）
   - 批量签退后：`responses/legacy_apply_101_0101_after_checkout.tsv`（期望 `1<TAB>1`）

6) 批量签退 + 最终一致性窗口（见问题 WX-SYNC-001）
   - bulk-checkout 响应：`responses/bulk_checkout.resp.json`
   - bulk-checkout 后立即读取（可能仍旧）：`responses/normal_detail_101_after_bulk_checkout.resp.json`、`responses/staff_activities_after_bulk_checkout.resp.json`
   - 等待下一次 legacy pull 后读取（应一致）：`responses/normal_detail_101_after_bulk_checkout_after_wait.resp.json`、`responses/staff_activities_after_bulk_checkout_after_wait.resp.json`

---

## 5. 未覆盖项与原因

按“功能点 → 未覆盖原因 → 影响评估 → 替代验证建议”记录如下：

- `suda_union`：反馈对话/结束反馈、批量导入用户、补报名附件上传、邮件验证码等
  - 未覆盖原因：需要额外外部依赖（邮件服务/文件上传落地）与更完整测试数据；且当前环境无外网 DNS，无法通过补依赖快速补齐自动化基线。
  - 影响评估：不影响“wxapp-checkin 与 legacy 同步”主链路验证，但影响管理端全量回归完整性。
  - 替代验证建议：在具备完整依赖的环境补充 Postman/脚本化回归，或为 `suda_union` 增加最小可跑的测试 profile。
- `suda-gs-ams`：UI 全交互回归（表格筛选、弹窗、导出、复杂表单校验等）
  - 未覆盖原因：仓库当前无 UI 自动化基线；本轮以 build + 代理接口冒烟为主。
  - 替代验证建议：补充 Playwright 路由级回归（登录 → 菜单 → 活动列表/详情），并将关键接口断言落盘。

---

## 6. wxapp-checkin 问题清单

> 要求：每条问题必须包含“复现步骤、实际结果、期望结果、影响范围、疑似根因（指向具体代码/配置）、建议修复方向、回归用例与证据路径”。

### WX-SYNC-001（P2）批量签退后存在最终一致性窗口：投影状态/统计需等下一次 legacy pull 才对齐

**复现步骤：**

1) 运行联调脚本：

```bash
cd /home/psx/app
./local_dev/scripts/run_wxapp_checkin_full_integration_test.sh
```

2) 打开最新运行目录（以本次为例）：

- `local_dev/runtime/integration_test_20260311_145139/responses/`

3) 对比 bulk-checkout 之后“立即读取”和“等待 pull 后读取”的结果：

- 立即读取：
  - `normal_detail_101_after_bulk_checkout.resp.json`
  - `staff_activities_after_bulk_checkout.resp.json`
- 等待 pull 后读取：
  - `normal_detail_101_after_bulk_checkout_after_wait.resp.json`
  - `staff_activities_after_bulk_checkout_after_wait.resp.json`

**实际结果（本次证据）：**

- bulk-checkout 后立即读取时，可能仍看到：
  - normal 个人状态：`my_checked_in=true`、`my_checked_out=false`
  - 活动统计：`checkin_count=1`、`checkout_count=2`
- 等待下一次 legacy pull（本脚本最多等 10 秒）后，再读取会对齐为：
  - normal 个人状态：`my_checked_in=false`、`my_checked_out=true`
  - 活动统计：`checkin_count=0`、`checkout_count=3`
- 同时，legacy 写回证据已在 bulk-checkout 后完成（outbox relay 已落库到 legacy）：
  - `legacy_apply_101_0101_after_checkout.tsv` 内容为 `1<TAB>1`

**期望结果：**

- bulk-checkout 返回成功后，`/api/web/activities` 与 `/api/web/activities/{id}` 在同一活动上应尽快（最好是立即）反映：
  - 统计口径一致（`checkin_count` 下降、`checkout_count` 上升）
  - 个人状态一致（已被批量签退的用户不应继续看到“可签退/已签到未签退”）

**影响范围：**

- 用户体验：工作人员执行“一键全部签退”后，普通用户端/工作人员端可能在一段时间内仍显示“未签退”或统计未变化，易造成误判。
- 跨项目一致性：`suda_union`（及其上的 `suda-gs-ams`）可能已经展示“已签退”，但 `wxapp-checkin` 的投影端仍短暂展示旧状态，形成“看起来不同步”的现象。
- 行为风险：普通用户在窗口期可能重复尝试签退，产生额外 checkin_event/outbox 噪声（虽然最终状态会被 pull 对齐）。

**疑似根因（代码指向）：**

- `wxapp-checkin/backend` 同时存在：
  - 本地状态机更新（bulk-checkout / consume 会更新 `wx_user_activity_status` 与 `wx_activity_projection`）
  - legacy pull 覆盖（`LegacySyncService.syncLegacyActivities()` / `syncLegacyUserActivityStatus()` 会用 legacy 的 `suda_activity_apply` 结果覆盖投影）
- 当 bulk-checkout 的 outbox 尚未写回 legacy（或写回与 pull 的时序交错）时，legacy pull 可能用“旧 legacy 状态”覆盖掉本地刚更新的状态/统计，直到下一轮 pull 才重新对齐。
  - 相关代码：`wxapp-checkin/backend/src/main/java/com/wxcheckin/backend/application/service/LegacySyncService.java`

**建议修复方向（择一或组合）：**

- 调度顺序治理：确保 outbox relay 处理优先于 legacy pull（同一 tick 内先 push 再 pull），减少 pull 读取到旧 legacy 的概率。
- pull 侧防回退：在 `syncLegacyUserActivityStatus` / `syncLegacyActivities` 中引入“单调不回退”策略（例如：不允许 `checked_out -> checked_in` 回退；或当存在 pending outbox 时跳过覆盖）。
- 动作后即时对齐：bulk-checkout 成功后，主动触发一次“按 activity_id 的即时同步”或“本地投影强刷新”，避免 UI 必须等待下一次定时 pull。
- UI 侧缓解（非根治）：bulk-checkout 后增加“同步中”提示或短轮询刷新，避免工作人员误判。

**回归用例：**

- 复跑：`./local_dev/scripts/run_wxapp_checkin_full_integration_test.sh`
- 断言：bulk-checkout 后立即读取与 after_wait 读取不应出现“状态回退/统计不变”的差异（或差异窗口可接受且有明确 UI 提示）。

**修复情况（已完成）：**

- 后端顺序治理：在 `LegacySyncService.syncFromLegacy()` 中增加“先 relay outbox 再 pull legacy”的顺序保证，避免 pull 读取旧 legacy 覆盖本地状态（对应本问题的根因假设）。
- 回归测试：新增 `wxapp-checkin/backend/src/test/java/com/wxcheckin/backend/application/service/LegacySyncServiceOutboxOrderingTest.java`，覆盖“本地已签退 + outbox pending + legacy 未写回”的状态回退场景。
- 联调证据：RUN_ID `integration_test_20260311_155437` 中
  - `normal_detail_101_after_bulk_checkout.resp.json` 与 `normal_detail_101_after_bulk_checkout_after_wait.resp.json` 除 `server_time_ms` 外一致（状态与统计立即对齐）
  - `staff_activities_after_bulk_checkout.resp.json` 与 `staff_activities_after_bulk_checkout_after_wait.resp.json` 同样一致

---

## 7. wxapp-checkin/web 代码审查结论

结论需要回答两个问题：

1) Web 端是否存在会直接导致与另外两项目（`suda_union`、`suda-gs-ams`）之间**数据同步异常**的问题？
   - 结论：**未发现**。`wxapp-checkin/web` 仅通过 `/api/web/**` 与 `wxapp-checkin/backend` 交互，不直接连接 legacy DB，也不调用 `suda_union` 的 `/api/*` 命名空间；默认 `VITE_API_BASE_PATH=/api/web`，并在 `vite.config.ts` 只代理该前缀，避免与 `suda-gs-ams` 的 `/api/*` 冲突。
2) 若不会直接导致，是否存在“触发频率/并发/重试策略/错误处理”层面的间接风险，会放大后端同步链路的缺陷？
   - 结论：存在**体验层面的放大**：bulk-checkout 后前端会立即刷新详情/动态码，但不会主动轮询等待后端 pull 对齐，因此在后端存在最终一致性窗口时，UI 可能短暂展示旧状态（对应问题 WX-SYNC-001）。这属于“表现层不做缓冲”的风险，不是同步链路的根因。

---

## 8. 回归与交付建议

- 建议把本报告 RUN_ID 对应的 `local_dev/runtime/integration_test_20260311_145139` 目录作为回归基线证据（logs+responses 可直接对比）。
- 若要把“批量签退后立刻一致”作为验收标准，应优先修复 WX-SYNC-001（调度顺序/防回退/动作后即时对齐），再考虑 UI 轮询提示作为兜底。
