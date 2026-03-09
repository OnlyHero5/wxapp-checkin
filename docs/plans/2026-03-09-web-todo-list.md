# 手机 Web 动态验证码签到 TODO List

文档版本: v1.0
状态: 进行中（已完成前半程 M1 + M2）
更新日期: 2026-03-09
项目: `wxapp-checkin`
用途: 作为后续分批次实施编码的执行清单，与 `2026-03-09-web-detailed-coding-plan.md` 配套使用。

## 1. 使用规则

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- 每完成一个批次，先更新本清单，再做下一批次。
- 若某项被阻塞，直接在条目后补“阻塞原因”，不要只停留在口头说明。

## 2. M0 决策锁定

- [ ] T-001 锁定 Passkey `RP ID`
- [ ] T-002 锁定允许的正式 `Origin`
- [ ] T-003 锁定本地开发域名方案
- [ ] T-004 锁定是否同域部署 Web 前后端
- [ ] T-005 锁定 Web 会话 TTL
- [ ] T-006 锁定解绑审批通过后的旧会话失效策略
- [ ] T-007 锁定浏览器绑定唯一性口径
- [ ] T-008 锁定浏览器指纹只作为辅助风控还是强约束
- [ ] T-009 锁定动态码错误尝试限流维度
- [ ] T-010 锁定动态码错误尝试限流阈值

## 3. M1 前端基础设施

- [x] T-011 创建 `web/package.json`
- [x] T-012 创建 `web/tsconfig.json`
- [x] T-013 创建 `web/vite.config.ts`
- [x] T-014 创建 `web/index.html`
- [x] T-015 创建 `web/src/main.tsx`
- [x] T-016 创建 `web/src/app/App.tsx`
- [x] T-017 创建 `web/src/app/router.tsx`
- [x] T-018 创建 `web/src/app/styles/base.css`
- [x] T-019 创建 `web/src/test/setup.ts`
- [x] T-020 补 `web/src/app/App.test.tsx`
- [x] T-021 建立 `shared/http/client.ts`
- [x] T-022 建立 `shared/http/errors.ts`
- [x] T-023 建立 `shared/session/session-store.ts`
- [x] T-024 建立 `shared/device/browser-capability.ts`
- [x] T-025 建立 `shared/device/page-lifecycle.ts`
- [x] T-026 建立 `shared/ui/MobilePage.tsx`
- [x] T-027 建立 `shared/ui/UnsupportedBrowser.tsx`
- [x] T-028 补 `session-store.test.ts`
- [x] T-029 补 `browser-capability.test.ts`
- [x] T-030 跑 `npm test -- --run`
- [x] T-031 跑 `npm run build`

## 4. M2 前端主链路

### 4.1 认证与绑定

- [x] T-032 建立 `features/auth/api.ts`
- [x] T-033 建立 `features/auth/webauthn.ts`
- [x] T-034 建立 `IdentityBindForm.tsx`
- [x] T-035 建立 `PasskeyLoginPanel.tsx`
- [x] T-036 建立 `pages/login/LoginPage.tsx`
- [x] T-037 建立 `pages/bind/BindPage.tsx`
- [x] T-038 补 `LoginPage.test.tsx`
- [x] T-039 补 `BindPage.test.tsx`
- [x] T-040 打通实名校验流程
- [x] T-041 打通 Passkey 注册流程
- [x] T-042 打通 Passkey 登录流程
- [x] T-043 登录成功后写入会话并跳转活动页

### 4.2 普通用户活动与输入码

- [x] T-044 建立 `features/activities/api.ts`
- [x] T-045 建立 `ActivityCard.tsx`
- [x] T-046 建立 `features/attendance/components/CodeInput.tsx`
- [x] T-047 建立 `pages/activities/ActivitiesPage.tsx`
- [x] T-048 建立 `pages/activity-detail/ActivityDetailPage.tsx`
- [x] T-049 建立 `pages/checkin/CheckinPage.tsx`
- [x] T-050 建立 `pages/checkout/CheckoutPage.tsx`
- [x] T-051 补 `ActivitiesPage.test.tsx`
- [x] T-052 补 `CheckinPage.test.tsx`
- [x] T-053 实现活动列表展示
- [x] T-054 实现活动详情展示
- [x] T-055 实现签到码输入页
- [x] T-056 实现签退码输入页
- [x] T-057 补齐错误码、过期码、重复提交反馈

### 4.3 管理员页面

- [ ] T-058 建立 `features/staff/api.ts`
- [ ] T-059 建立 `DynamicCodePanel.tsx`
- [ ] T-060 建立 `BulkCheckoutButton.tsx`
- [ ] T-061 建立 `features/review/components/UnbindReviewList.tsx`
- [ ] T-062 建立 `pages/staff-manage/StaffManagePage.tsx`
- [ ] T-063 建立 `pages/unbind-reviews/UnbindReviewPage.tsx`
- [ ] T-064 补 `StaffManagePage.test.tsx`
- [ ] T-065 补 `UnbindReviewPage.test.tsx`
- [ ] T-066 实现签到码/签退码切换
- [ ] T-067 实现前后台切换后自动刷新
- [ ] T-068 实现一键全部签退确认与调用
- [ ] T-069 实现解绑审核列表
- [ ] T-070 实现解绑审批动作

## 5. M3 后端数据模型与认证

### 5.1 数据模型

- [ ] T-071 创建 `V6__add_web_identity_tables.sql`
- [ ] T-072 创建 `WebPasskeyCredentialEntity.java`
- [ ] T-073 创建 `WebBrowserBindingEntity.java`
- [ ] T-074 创建 `WebUnbindReviewEntity.java`
- [ ] T-075 创建 `WebAdminAuditLogEntity.java`
- [ ] T-076 创建 `WebPasskeyCredentialRepository.java`
- [ ] T-077 创建 `WebBrowserBindingRepository.java`
- [ ] T-078 创建 `WebUnbindReviewRepository.java`
- [ ] T-079 创建 `WebAdminAuditLogRepository.java`
- [ ] T-080 修改 `WxUserAuthExtEntity.java`
- [ ] T-081 补 `FlywayMigrationTest.java`
- [ ] T-082 验证唯一约束：
  - 一个账号一个活跃绑定
  - 一个浏览器一个活跃绑定

### 5.2 身份与登录接口

- [ ] T-083 创建 `WebAuthController.java`
- [ ] T-084 创建 `WebBindVerifyRequest.java`
- [ ] T-085 创建 `WebPasskeyRegisterOptionsResponse.java`
- [ ] T-086 创建 `WebPasskeyRegisterCompleteRequest.java`
- [ ] T-087 创建 `WebPasskeyLoginOptionsResponse.java`
- [ ] T-088 创建 `WebPasskeyLoginCompleteRequest.java`
- [ ] T-089 创建 `WebIdentityService.java`
- [ ] T-090 创建 `PasskeyChallengeService.java`
- [ ] T-091 修改 `SessionService.java`
- [ ] T-092 修改 `LegacyUserLookupService.java`
- [ ] T-093 补 `WebIdentityServiceTest.java`
- [ ] T-094 补 `WebAuthControllerTest.java`
- [ ] T-095 打通 `verify-identity`
- [ ] T-096 打通 `register/options`
- [ ] T-097 打通 `register/complete`
- [ ] T-098 打通 `login/options`
- [ ] T-099 打通 `login/complete`

## 6. M4 后端活动、动态码与管理员能力

### 6.1 活动与动态码

- [ ] T-100 创建 `WebActivityController.java`
- [ ] T-101 创建 `WebAttendanceController.java`
- [ ] T-102 创建 `WebCodeConsumeRequest.java`
- [ ] T-103 创建 `DynamicCodeService.java`
- [ ] T-104 修改 `ActivityQueryService.java`
- [ ] T-105 修改 `QrSessionService.java`
- [ ] T-106 修改 `CheckinConsumeService.java`
- [ ] T-107 修改 `WxCheckinEventEntity.java`
- [ ] T-108 修改 `WxReplayGuardEntity.java`
- [ ] T-109 补 `DynamicCodeServiceTest.java`
- [ ] T-110 补 `CheckinConsumeServiceTest.java`
- [ ] T-111 打通 `/api/web/activities`
- [ ] T-112 打通 `/api/web/activities/{id}`
- [ ] T-113 打通 `/code-session`
- [ ] T-114 打通 `/code-consume`
- [ ] T-115 移除正式 Web 路径对 `qr_payload` 的依赖

### 6.2 管理员高权限能力

- [ ] T-116 创建 `WebStaffController.java`
- [ ] T-117 创建 `BulkCheckoutService.java`
- [ ] T-118 创建 `UnbindReviewService.java`
- [ ] T-119 修改 `RecordQueryService.java`
- [ ] T-120 修改 `OutboxRelayService.java`
- [ ] T-121 补 `BulkCheckoutServiceTest.java`
- [ ] T-122 补 `UnbindReviewServiceTest.java`
- [ ] T-123 打通 `bulk-checkout`
- [ ] T-124 打通解绑申请接口
- [ ] T-125 打通待审列表接口
- [ ] T-126 打通批准接口
- [ ] T-127 打通拒绝接口
- [ ] T-128 补管理员审计日志写入

## 7. M5 并发治理与稳定性

- [ ] T-129 修改 `WxActivityProjectionRepository.java`
- [ ] T-130 让 `CheckinConsumeService` 走原子计数路径
- [ ] T-131 让 `BulkCheckoutService` 走原子计数路径
- [ ] T-132 补 `AttendanceCounterConcurrencyTest.java`
- [ ] T-133 验证并发签到计数不丢失
- [ ] T-134 验证并发签退计数不丢失
- [ ] T-135 补动态码错误尝试限流实现
- [ ] T-136 验证解绑通过后旧会话失效

## 8. M6 联调回归与兼容性验证

- [ ] T-137 创建 `web/playwright.config.ts`
- [ ] T-138 创建 `web/tests/auth-flow.spec.ts`
- [ ] T-139 创建 `web/tests/checkin-flow.spec.ts`
- [ ] T-140 创建 `web/tests/staff-flow.spec.ts`
- [ ] T-141 跑 Web 端 Playwright 回归
- [ ] T-142 更新 `docs/WEB_COMPATIBILITY.md` 的实测记录
- [ ] T-143 更新 `progress.md`
- [ ] T-144 验证 iPhone Safari 主流程
- [ ] T-145 验证 iPhone Chrome/Edge 主流程
- [ ] T-146 验证 Android Chrome 主流程
- [ ] T-147 验证 Samsung Internet 主流程
- [ ] T-148 验证 Android Edge 主流程
- [ ] T-149 验证 Firefox Android 主流程
- [ ] T-150 验证 iOS 微信内 H5 主流程
- [ ] T-151 验证 Android 微信内 H5 主流程
- [ ] T-152 验证至少 1 台 HarmonyOS 设备

## 9. M7 删旧与正式切换

- [ ] T-153 逐条核对删旧前检查清单
- [ ] T-154 删除 `frontend/`
- [ ] T-155 修改 `AuthController.java`
- [ ] T-156 修改 `CheckinController.java`
- [ ] T-157 修改 `AuthService.java`
- [ ] T-158 修改 `WeChatIdentityResolver.java`
- [ ] T-159 修改 `QrSessionService.java`
- [ ] T-160 更新 `docs/REQUIREMENTS.md`
- [ ] T-161 更新 `docs/FUNCTIONAL_SPEC.md`
- [ ] T-162 更新 `docs/API_SPEC.md`
- [ ] T-163 更新 `docs/changes.md`
- [ ] T-164 跑 `cd backend && ./mvnw test`
- [ ] T-165 跑 `cd web && npm test -- --run && npm run build`
- [ ] T-166 确认仓库中不再存在小程序正式链路说明

## 10. 阻塞项记录

- [ ] B-001 Passkey 正式域名尚未最终确定
- [ ] B-002 本地开发域名与 HTTPS 方案尚未最终确定
- [ ] B-003 解绑审核角色边界是否单独区分 `review_admin` 仍需业务确认
- [ ] B-004 动态码错误尝试限流阈值仍需业务确认
- [ ] B-005 HarmonyOS 真机验证资源是否具备

## 11. 完成判定

以下条件全部满足后，可将本清单整体标记完成：

- [ ] C-001 `web/` 成为唯一正式前端
- [ ] C-002 `/api/web/**` 成为唯一正式 Web 接口
- [ ] C-003 绑定、登录、活动浏览、签到、签退全链路可用
- [ ] C-004 管理员展示码、批量签退、解绑审核可用
- [ ] C-005 并发计数稳定
- [ ] C-006 与 `suda_union` 的同步回写正常
- [ ] C-007 小程序与旧微信/二维码正式链路已删除
