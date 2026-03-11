# wxapp-checkin 三项目联调全覆盖测试报告（重点：数据同步）

更新时间：2026-03-11  
范围：`/home/psx/app` 下三项目（`suda_union`、`suda-gs-ams`、`wxapp-checkin`）联调；对 `wxapp-checkin` 做接口 + 数据同步链路覆盖测试。  

> 说明：本报告以“可复现证据”为主，所有关键接口响应与日志已落盘到 `local_dev/runtime/`（见下文）。

---

## 1. 测试结论摘要

### 1.1 结论

- 三项目可拉起并完成闭环：`staff 发码 -> normal 提交动态码 -> outbox 回写 legacy -> bulk-checkout -> legacy 再回写`。
- `wxapp-checkin` 自动化测试（后端 + Web 前端）均通过。
- **发现 1 个与“数据同步/统计一致性”相关的确定性问题（P1）**：`LegacySyncService` 的活动统计口径与 `wxcheckin_ext` 内部状态机/计数更新口径不一致，导致 `checkin_count` 被周期性同步覆盖为错误值，出现 `checkin_count < checkout_count` 等不可能状态。

### 1.2 本次产物（可复现证据）

- 联调脚本：`local_dev/scripts/run_wxapp_checkin_full_integration_test.sh`
- 两次完整联调运行目录（含 logs + responses + DB 证据）：
  - `local_dev/runtime/integration_test_20260311_120617`
  - `local_dev/runtime/integration_test_20260311_121648`（包含“动作前/后统计快照”，推荐作为主要证据）

---

## 2. 测试环境与配置

### 2.1 端口与依赖

- MySQL：`127.0.0.1:3307`（用户：`wxcheckin`，密码：`wxcheckin_test`）
- Redis：`127.0.0.1:16379`
- `suda_union`：`http://127.0.0.1:8088`
- `suda-gs-ams`：`http://127.0.0.1:5173`（通过 `/api/*` 代理到 `suda_union`）
- `wxapp-checkin/backend`：`http://127.0.0.1:9989`

### 2.2 数据准备（重要）

联调脚本每次运行会执行：

1) 重建 legacy 库 `suda_union`（导入最终 schema + 最小联调数据）  
- schema：`suda_union (1).sql`  
- seed：`local_dev/mysql/seed_suda_union_final.sql`（包含活动 101/102 与报名数据）

2) 清理扩展库 `wxcheckin_ext` 的业务数据（保留表结构/Flyway）  
- SQL：`local_dev/mysql/reset_wxcheckin_ext_data.sql`

3) 额外插入一个“未报名活动”用于负例验证  
- 活动：`legacy_act_103`（用于验证“未报名提交动态码 -> forbidden”）

---

## 3. 自动化测试结果（wxapp-checkin 全覆盖基础证据）

### 3.1 后端单测/集成测

- 命令：`cd wxapp-checkin/backend && ./mvnw test`
- 结果：`BUILD SUCCESS`，`Tests run: 29, Failures: 0, Errors: 0`

备注（测试噪声）：
- `ProdProfileSafetyConfigTest` 运行期间日志出现 `wx_qr_issue_log` 表不存在的错误日志（H2 空库 + 定时任务触发导致），但不影响测试通过；建议后续作为“测试环境洁净度”整改项（见第 5 节）。

### 3.2 Web 前端测试与构建

- 命令：
  - `cd wxapp-checkin/web && npm test`
  - `cd wxapp-checkin/web && npm run build`
- 结果：
  - `14` 个测试文件通过，`54` 个测试用例通过
  - `vite build` 成功产出 `dist/`

---

## 4. 联调覆盖点与结果（重点：数据同步）

### 4.1 覆盖的核心链路

本次联调覆盖的关键链路如下：

1) `suda-gs-ams -> suda_union`：代理登录可用（证明三项目联通）  
2) `legacy pull`（`suda_union -> wxcheckin_ext`）：活动投影、用户活动状态可见  
3) `staff code-session`：动态码生成 + 时间窗校验  
4) `normal code-consume`：状态机推进 + 防重放（replay guard）  
5) `outbox relay`（`wxcheckin_ext -> suda_union`）：写回 `suda_activity_apply.check_in/check_out`  
6) `staff bulk-checkout`：批量签退 + outbox + legacy 回写  

### 4.2 被测用户与活动

来自 `seed_suda_union_final.sql` 的账号（legacy 事实源）：

- staff：`20254227087`（role=0）
- normal：`2025000101`（已报名 `101/102`，初始未签到）
- normal2：`2025000102`（仅报名 `101`，用于“未报名 103”负例）

活动：

- `legacy_act_101`：处于允许发码时间窗内（用于主流程）
- `legacy_act_102`：不在发码时间窗（用于 `outside_activity_time_window` 负例）
- `legacy_act_103`：脚本额外插入（用于“未报名”负例）

### 4.3 关键接口用例（带证据路径）

以下证据以 `integration_test_20260311_121648` 为主：

#### A) staff 登录 + 改密

- `POST /api/web/auth/login`（默认密码 `123`）
  - 响应：`responses/staff_login.resp.json`
- `POST /api/web/auth/change-password`
  - 响应：`responses/staff_change_password.resp.json`

#### B) staff 拉取活动列表（验证 legacy pull 生效）

- `GET /api/web/activities`
  - 响应：`responses/staff_activities.resp.json`
  - 观察：活动 101/102/103 均可见（staff 可见全量 active 活动）

#### C) staff 发码（动态码 + 时间窗）

- `GET /api/web/activities/legacy_act_101/code-session?action_type=checkin`
  - 响应：`responses/code_session_101_checkin.resp.json`
- `GET /api/web/activities/legacy_act_102/code-session?action_type=checkin`
  - 响应：`responses/code_session_102_checkin.resp.json`
  - 期望：`error_code=outside_activity_time_window`（实际满足）

#### D) normal 登录 + 必须改密拦截

- `POST /api/web/auth/login`
  - 响应：`responses/normal_login_0101.resp.json`
- 未改密直接拉列表：`GET /api/web/activities`
  - 响应：`responses/normal_activities_before_change.resp.json`
  - 期望：`password_change_required`（实际满足）
- 改密：`POST /api/web/auth/change-password`
  - 响应：`responses/normal_change_password.resp.json`

#### E) normal 拉活动列表（验证“本人已报名可见”）

- `GET /api/web/activities`
  - 响应：`responses/normal_activities.resp.json`
  - 观察：只返回本人报名/有状态的活动（本次为 101/102）

#### F) normal 动态码消费（负例 + 正例 + 防重放）

- 错误码：`000000`  
  - `POST /api/web/activities/legacy_act_101/code-consume`
  - 响应：`responses/consume_invalid.resp.json`（`invalid_code`）
- 过期码：跨时间片后提交上一 slot 的码  
  - 响应：`responses/consume_expired.resp.json`（`expired`）
- 正常签到  
  - 响应：`responses/consume_checkin.resp.json`（`success`）
- 同 slot 重复提交（replay guard）  
  - 响应：`responses/consume_checkin_dup.resp.json`（`duplicate`）

#### G) 数据同步证据：outbox relay 写回 legacy

- 签到后，legacy 应为 `check_in=1, check_out=0`  
  - 证据：`responses/legacy_apply_101_0101_after_checkin.tsv`
- 批量签退后，legacy 应为 `check_in=1, check_out=1`  
  - 证据：`responses/legacy_apply_101_0101_after_checkout.tsv`

#### H) staff 批量签退（bulk-checkout）

- `POST /api/web/staff/activities/legacy_act_101/bulk-checkout`（confirm=true）
  - 响应：`responses/bulk_checkout.resp.json`（`affected_count=1`）
- confirm=false 负例
  - 响应：`responses/bulk_checkout_not_confirm.resp.json`（`invalid_param`）

#### I) 权限负例

- normal 调 `code-session`（应 forbidden）
  - 响应：`responses/normal_issue_code_should_fail.resp.json`
- staff 调 `code-consume`（应 forbidden）
  - 响应：`responses/staff_consume.resp.json`
- 未报名用户消费 `legacy_act_103`（应 forbidden）
  - 响应：`responses/consume_103_not_registered.resp.json`

---

## 5. 已发现问题清单（含复现与修复方向）

### P1 - 数据同步口径不一致：`checkin_count` 统计被 legacy pull 覆盖为错误值

**现象（确定复现）：**

- 动作前（legacy 中无人处于“已签到未签退”态）：
  - `legacy_act_101` 在活动列表/详情里返回：`checkin_count=2, checkout_count=2`
  - 证据：`local_dev/runtime/integration_test_20260311_121648/responses/staff_activities.resp.json`
- normal 签到后：
  - 返回：`checkin_count=3, checkout_count=2`
  - 证据：`.../responses/normal_detail_101_after_checkin.resp.json`
- staff 批量签退后（理论上应回到“0 人已签到未签退”）：
  - 返回：`checkin_count=2, checkout_count=3`，出现 `checkin_count < checkout_count` 的不可能状态
  - 证据：`.../responses/staff_activities_after_bulk_checkout.resp.json`

**影响：**

- 管理员页展示的“签到人数/签退人数”会出现错误，且在定时 `legacy pull` 下会被周期性覆盖；
- 统计错误会误导现场运营判断（是否需要一键签退、当前在场人数等）。

**疑似根因：**

- `wxapp-checkin/backend` 的 `LegacySyncService.syncLegacyActivities()` 统计 SQL 口径与业务状态机不一致：
  - 当前 SQL 把 `checkin_count` 统计为 `check_in=1` 的总人数（包含已签退的人）
  - 但 `CheckinConsumeService` / `BulkCheckoutService` 的计数更新口径是“已签到未签退”：
    - 签退会执行 `checkin_count -= 1`、`checkout_count += 1`

**建议修复方向：**

- 将 `LegacySyncService` 的统计改为与状态机一致的口径：
  - `checkin_count = SUM(check_in=1 AND check_out=0)`
  - `checkout_count = SUM(check_in=1 AND check_out=1)`
- 修复位置：`wxapp-checkin/backend/src/main/java/com/wxcheckin/backend/application/service/LegacySyncService.java`

**回归用例：**

- 复跑 `local_dev/scripts/run_wxapp_checkin_full_integration_test.sh`
- 期望在 `staff_activities.resp.json` 初始就满足：
  - `checkin_count + checkout_count == 已签到总人数`
  - 且 bulk-checkout 后 `checkin_count` 不会出现负向漂移或小于 `checkout_count`

---

### P2 - 首次登录后的活动可见性存在“等待 pull 同步”的空窗期

**现象（本次可观察）：**

- normal 用户首次登录并改密后，活动列表需要等待定时 `legacy pull` 把该用户的 `wx_user_activity_status` 补齐后才可见。
- 本次联调把 interval 调成了 `2000ms`，实际等待约 2~3 秒；若使用默认 `60000ms`，用户体验可能出现“登录后列表空白几十秒”。

**影响：**

- 首次使用/更换设备时，用户可能误以为“没有活动/没有报名记录”。

**建议修复方向（择一即可）：**

- 登录成功后对当前用户执行一次“按 legacy_user_id 的即时 status 同步”（只同步该用户）；
- 或将默认 pull interval 下调，并为 UI 增加“同步中/稍后刷新”的明确状态；
- 或活动列表对 normal 用户在 status 缺失时做一次 legacy 查询兜底（只读）。

---

### P2 - outbox `failed` 事件默认不重试（一致性可靠性风险）

**现象（设计层风险，本次未触发）：**

- `OutboxRelayService` 只拉取 `status=pending` 的事件；
- 一旦触发 `DataAccessException`，事件会被标记为 `failed`，后续不会再次被处理（除非人工干预）。

**影响：**

- 遗留库短暂不可用时可能造成“扩展库已成功、legacy 永久不同步”的长期脏数据。

**建议修复方向：**

- 将 `failed` 改为可重试状态（例如回到 `pending` 并延后 `available_at`），或引入 `retry_count` + 指数退避；
- 对 `skipped`（依赖数据未齐）同样需要可重试机制，避免“先写 outbox 后补映射”导致永久丢失。

---

### P3 - 联调脚本/启动脚本口径不一致导致误报警告

**现象：**

- `local_dev/scripts/start_3_projects_integration.sh` 内置登录校验默认用 `admin/123`；
- 但本次联调用的 `seed_suda_union_final.sql` 并不存在 `admin/123`（而是 `20254227087/123456`）。

**影响：**

- 一键启动时会输出 `login check failed`，容易误判为服务不可用。

**建议修复方向：**

- 统一种子数据账号口径，或把启动脚本的“登录校验账号”参数化。

---

### P3 - 测试环境日志噪声：定时任务在空库上执行导致 error log

**现象：**

- `wxapp-checkin/backend` 的测试运行时出现：
  - `Table "wx_qr_issue_log" not found (this database is empty)`
- 推测为：测试 profile 使用内存 H2 且未迁移完整 schema，但定时清理任务仍启动执行。

**影响：**

- CI/本地测试日志出现误导性 ERROR，降低信噪比。

**建议修复方向：**

- 在 `test` profile 关闭 `app.qr.cleanup-enabled` / `app.sync.scheduler-enabled`；
- 或让测试 DB 也跑一份最小迁移（确保相关表存在）。

---

## 6. 建议的后续修复优先级

1) **先修 P1（统计口径一致性）**：属于数据同步口径错误，且复现稳定。  
2) 再修 P2（首次登录可见性空窗 + outbox 重试）：“最终一致性”链路的可靠性与体验问题。  
3) 最后处理 P3（脚本口径与测试噪声）：提升联调/回归效率与信噪比。  

---

## 7. 如何复现/回归（最短命令）

1) 运行联调全量脚本（会重建本地 DB）：

```bash
cd /home/psx/app
./local_dev/scripts/run_wxapp_checkin_full_integration_test.sh
```

2) 查看最新运行目录：

```bash
ls -dt /home/psx/app/local_dev/runtime/integration_test_* | head
```

3) 重点证据文件（以最新目录为准）：

- 活动统计快照：
  - `responses/staff_activities.resp.json`
  - `responses/staff_activities_after_checkin.resp.json`
  - `responses/staff_activities_after_bulk_checkout.resp.json`
- legacy 回写证据：
  - `responses/legacy_apply_101_0101_after_checkin.tsv`
  - `responses/legacy_apply_101_0101_after_checkout.tsv`
- 后端日志：
  - `logs/wxapp_checkin_backend.log`

