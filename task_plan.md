# 手机 Web 改造审查与半程推进计划

## 目标

- 完整复核 `wxapp-checkin` 当前文档基线、历史代码与 `web/` 首批改造成果。
- 对已完成的前四分之一代码做真正的代码审查，而不是只复用上一轮“测试通过”的结论。
- 若发现 bug，则先按 TDD 修复；若首批实现可接受，则继续推进到“总改造进度二分之一”。
- 将审查发现、修复动作、后续实施与验证结果持续沉淀到仓库文档，便于回溯。

## 当前阶段

- 状态：complete
- 阶段 1：复核文档基线、现有计划与首批 Web 代码
- 阶段 2：按 TDD 修复首批代码审查发现的问题
- 阶段 3：推进到半程目标（默认按 `M2.2` 普通用户活动与输入码页执行）
- 阶段 4：运行验证并同步 `progress.md` / `findings.md` / `docs/plans/2026-03-09-web-todo-list.md`

## 任务拆分

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 复核正式基线文档 | complete | 已重读 `REQUIREMENTS` / `FUNCTIONAL_SPEC` / `API_SPEC` / `WEB_DETAIL_DESIGN` / 实施计划 |
| 复核现有首批实现边界 | complete | 已确认首批范围为 `web/` 骨架 + shared 基础层 + `/login` `/bind` |
| 审查首批 Web 代码 | complete | 已发现路由保护、根路由、能力探测、HTTP 归一化、存储降级等问题 |
| 修复首批代码问题 | complete | 已按 TDD 修复路由保护、根路由、能力探测、HTTP 归一化、存储降级与登录跳绑定 |
| 推进半程目标 | complete | 已完成 `M2.2`：活动列表 / 活动详情 / 签到页 / 签退页 |
| 全量验证与清单回写 | complete | 已重新跑 `npm test -- --run`、`npm run build` 并同步 `docs/plans/2026-03-09-web-todo-list.md` |

## 已知约束

- 只允许修改 `wxapp-checkin/`。
- `suda_union/` 与 `suda-gs-ams/` 仅可读取和联调参考。
- 新 Web 功能必须以 `docs/REQUIREMENTS.md`、`docs/FUNCTIONAL_SPEC.md`、`docs/API_SPEC.md` 为正式基线。
- 最终目标是删除小程序正式链路，但本轮只推进到“半程”，不提前删旧。

## 范围决策

- “前四分之一”沿用现有计划定义：`M1 + M2.1`，即：
  - 建立 `web/` 工程骨架
  - 建立 Web 公共基础层
  - 实现实名绑定与 Passkey 登录前端
- “推进到二分之一”默认解释为完成下一个独立批次 `M2.2`：
  - 活动列表页
  - 活动详情页
  - 签到 6 位码输入页
  - 签退 6 位码输入页
- M0 决策锁口仍不作为本轮编码完成条件，但相关风险需要持续记录。

## 当前审查问题清单

- 已修：`web/src/app/router.tsx` 补根路由 `/ -> /login|/activities` 与受保护路由。
- 已修：`web/src/shared/device/browser-capability.ts` 收紧 Passkey 基线判断。
- 已修：`web/src/shared/http/client.ts` 补非 JSON / 非 2xx 响应归一化。
- 已修：`web/src/shared/session/session-store.ts` 补 `localStorage` 不可用时降级。
- 已修：`web/src/pages/bind/BindPage.tsx` 与 `web/src/pages/login/LoginPage.tsx` 补不支持浏览器与“未注册 Passkey 跳绑定”处理。

## 错误记录

- 修复阶段的失败测试已全部转绿：
  - `src/app/App.test.tsx`
  - `src/shared/device/browser-capability.test.ts`
  - `src/shared/session/session-store.test.ts`
  - `src/shared/http/client.test.ts`
  - `src/pages/login/LoginPage.test.tsx`
  - `src/pages/bind/BindPage.test.tsx`
- 新鲜验证结果：
  - 首批修复后：`cd web && npm test -- --run` => 7 个测试文件、23 个测试通过
  - 半程实现后：`cd web && npm test -- --run` => 10 个测试文件、28 个测试通过
  - 半程实现后：`cd web && npm run build` => 构建通过

## 2026-03-09 第二阶段任务

### 目标

- 对已完成的首批 Web 改造做代码审查，并修复明确的功能性 bug。
- 若首批质量达标，则继续推进到“整体改造进度二分之一”的下一批前端能力。
- 将审查结论、根因、测试补充和实现过程持续沉淀到仓库内文档。

### 当前阶段

- 状态：in_progress
- 阶段 1：复核文档基线与首批实现一致性
- 阶段 2：完成首批 Web 代码审查并定位根因
- 阶段 3：按 TDD 修复确认的问题
- 阶段 4：补充“从四分之一到二分之一”的设计与实施记录
- 阶段 5：继续推进下一批前端页面并完成验证

### 本轮重点检查项

- 路由是否落实：
  - 未登录跳 `/login`
  - 未绑定跳 `/bind`
  - 管理员与普通用户页面边界
- 绑定页与登录页是否正确处理浏览器 Passkey 能力差异。
- `shared/http/client.ts` 是否对后端异常、非 JSON 响应、会话失效和 API 契约偏差有足够韧性。
- 当前测试是否覆盖关键边界，而不是只覆盖 happy path。
