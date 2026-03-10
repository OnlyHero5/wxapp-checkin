# 手机 Web Only 收尾设计说明

文档版本: v1.0
状态: 已确认，进入实现
更新日期: 2026-03-10
项目: `wxapp-checkin`

## 1. 背景与目标

- 用户已确认本轮验收口径采用“本地开发环境可启动、前后端自动化测试通过、Web 主链路代码完整可联调”，不把真机 Passkey 实测作为本轮阻塞项。
- 当前仓库已经完成 `web/` 的前三分之三：
  - 手机 Web 前端壳层、普通用户页、管理员页已存在
  - `/api/web/activities/**`、动态码、一键全部签退、解绑审核最小后端已存在
- 当前仍缺“最后四分之一”的关键收口：
  - 后端 Web 身份 / Passkey / 浏览器绑定主链路未真实落地
  - 小程序前端 `frontend/` 与旧微信 / 二维码正式接口仍在主干
  - 文档、README、启动说明尚未彻底切到 Web-only

本轮目标是把仓库收口为“Web-only、本地可运行、可验证、可继续演进”的完整项目，而不是继续维持 Web 与小程序双主线并存。

## 2. 方案选择

本轮采用“本地可运行切流方案”：

- 后端补齐 Web 认证、绑定、解绑失效和审计的最小闭环
- 前端继续使用现有 `web/`，改为真实对接新后端认证接口
- 删除 `frontend/` 小程序目录和旧微信 / 二维码正式接口入口
- 文档和启动说明统一切换到 Web-only 口径

不采用“完全生产级 Passkey 验签一次性到位”方案，原因是当前仓库未引入正式 WebAuthn 服务端依赖；若本轮强行追求该目标，会明显放大实现和调试风险，反而不利于按用户确认的验收口径交付完整可运行项目。

## 3. 架构设计

### 3.1 前端

- 正式前端只保留 `web/`
- 继续复用现有路由、活动页、管理员页和共享基础层
- 认证链路统一走：
  - `POST /api/web/bind/verify-identity`
  - `POST /api/web/passkey/register/options`
  - `POST /api/web/passkey/register/complete`
  - `POST /api/web/passkey/login/options`
  - `POST /api/web/passkey/login/complete`
- 继续沿用本地 `session-store` 持久化：
  - `session_token`
  - `role`
  - `permissions`
  - `user_profile`

### 3.2 后端

- 正式业务接口统一收口到 `/api/web/**`
- 在现有 `backend/` 上新增以下 Web 专属持久化模型：
  - `web_passkey_credential`
  - `web_browser_binding`
  - `web_passkey_challenge`
  - `web_admin_audit_log`
- 继续保留并扩展已完成的 `web_unbind_review`
- 复用现有：
  - `LegacyUserLookupService`
  - `SessionService`
  - `WxUserAuthExtRepository`
  - `WxSessionRepository`
  - `WxAdminRosterRepository`
  - `PermissionCatalog`
- 新增 `WebAuthController`、`WebIdentityService`、`PasskeyChallengeService`

### 3.3 WebAuthn 实现边界

- 本轮后端目标是“开发可运行”，不是“生产级完全验签”
- 浏览器端仍使用真实 `navigator.credentials.create/get`
- 后端会：
  - 真实签发 challenge 并做过期校验
  - 保存 credential id、浏览器绑定、challenge 与会话
  - 对请求结构做一致性校验
  - 基于绑定状态控制 `bind_ticket`、`passkey_not_registered`、解绑后失效等产品语义
- 后端暂不做：
  - 完整 attestation / assertion 密码学验签
  - 生产级设备指纹强绑定

这样可以保证本地联调链路、数据库模型、会话流转、解绑审批与删旧切流都真实存在，同时为后续正式安全增强预留清晰落点。

## 4. 数据流设计

### 4.1 首次绑定

1. 前端提交 `student_id + name`
2. 后端实名校验：
   - 学号必须存在于 `suda_union`
   - 姓名必须与实名源一致
   - 若当前浏览器已绑定他人，返回 `binding_conflict`
   - 若当前账号已有其他活跃绑定，返回 `account_bound_elsewhere`
3. 后端签发一次性 `bind_ticket`
4. 前端请求注册 challenge
5. 浏览器生成 attestation
6. 后端完成注册：
   - 保存 credential
   - 创建浏览器绑定
   - 更新 `WxUserAuthExtEntity`
   - 签发 `wx_session`

### 4.2 登录

1. 前端请求登录 challenge
2. 后端基于当前浏览器指纹 / 已存 credential 判定是否已注册
3. 未注册时返回 `passkey_not_registered`
4. 前端执行 assertion
5. 后端校验 challenge 是否匹配且未过期
6. 通过后签发新业务会话

### 4.3 审批解绑

1. 普通用户发起解绑申请
2. staff/review_admin 审批通过
3. 后端执行：
   - 旧浏览器绑定失效
   - 关联用户当前会话全部失效
   - 审计日志写入
4. 用户才能在新浏览器重新绑定

## 5. 删旧边界

### 5.1 必删

- `frontend/` 历史小程序前端目录
- 小程序配置文件：
  - `project.config.json`
  - `project.private.config.json`
- 旧微信登录正式接口：
  - `/api/auth/wx-login`
- 旧二维码正式消费与签发接口：
  - `/api/staff/activities/{id}/qr-session`
  - `/api/checkin/consume`
  - 相关 controller 暴露入口

### 5.2 保留但改语义

- `CheckinConsumeService`
  - 保留为动态码消费主服务
  - 删除对正式 Web 路径的二维码主语义依赖
- `DynamicCodeService`
  - 保留为 Web 动态码主服务
- `SessionService`
  - 保留并扩展为 Web-only 会话服务
- outbox、legacy sync、活动投影、用户状态表
  - 继续作为核心业务基础设施保留

## 6. 测试与验收

本轮完成判定采用以下证据：

- `cd backend && ./mvnw test`
- `cd web && npm test -- --run`
- `cd web && npm run build`
- README / backend README 提供 Web-only 本地启动步骤
- 仓库中不再保留小程序正式前端和旧微信 / 二维码正式接口入口

以下内容不作为本轮阻塞：

- 真机 Passkey 实测
- Playwright 浏览器矩阵补齐
- 生产级 WebAuthn 密码学验签

## 7. 风险与控制

- 风险：后端不做完整 WebAuthn 验签，安全强度低于最终目标
  - 控制：明确写入文档为“开发可运行版本”，并把正式安全增强作为后续待办
- 风险：删旧后旧测试大量失效
  - 控制：同步替换集成测试基线，避免“双链路测试同时维护”
- 风险：解绑审批与会话失效遗漏
  - 控制：补后端集成测试覆盖“审批通过后旧会话失效”
