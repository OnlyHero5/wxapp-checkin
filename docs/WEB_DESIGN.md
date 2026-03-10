# 手机 Web 动态验证码签到系统设计文档

文档版本: v0.1  
状态: 草案  
更新日期: 2026-03-09  
项目: `wxapp-checkin`

## 1. 设计目标

本设计面向 `wxapp-checkin` 的 `web-only` 新版本，目标如下：

- 用手机浏览器 Web 端替代微信小程序
- 用动态 6 位码输入替代二维码扫码
- 保留现有 `wxapp-checkin/backend`、扩展库表和 `suda_union` 同步主干的可复用部分
- 引入 `学号 + 姓名 + Passkey + 浏览器绑定 + 临时会话 + 管理员审核解绑`
- 最终删除小程序正式逻辑与二维码正式链路

## 2. 总体架构

### 2.1 仓库结构建议

- `web/`: 新手机浏览器前端
- `backend/`: 继续作为唯一业务后端
- `frontend/`: 现有小程序目录，实施阶段仅保留作过渡参考，最终删除
- `docs/`: 新旧文档共存，待实施稳定后以 Web 文档替换旧文档

### 2.2 系统关系

```text
┌──────────────────────────────┐
│ 手机浏览器 Web 前端 (web/)   │
│  normal / staff / review     │
└──────────────┬───────────────┘
               │ HTTPS JSON API
┌──────────────▼───────────────┐
│ Spring Boot 后端 (backend/)  │
│ identity / activity / code   │
│ attendance / review / sync   │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────────────┐   ┌────▼───────────┐
│ wxcheckin_ext  │   │ suda_union     │
│ 扩展域主写库    │   │ 只读事实源+回写 │
└────────────────┘   └────────────────┘
```

### 2.3 前后端职责

前端负责：

- 页面展示
- Passkey 注册与登录调用
- 活动切换与动态码输入
- 管理员动态码展示与批量操作入口
- 前台恢复时刷新关键数据

后端负责：

- 实名校验
- 管理员角色判定
- 浏览器绑定与解绑审核
- 会话签发与失效
- 动态码生成与校验
- 状态流转、防重放、计数与审计
- `suda_union` 同步与回写

## 3. 业务模块设计

### 3.1 前端模块

- `auth-ui`
  - 实名绑定
  - Passkey 注册
  - Passkey 登录
  - 会话恢复
- `activity-ui`
  - 活动列表
  - 活动详情
  - 用户状态展示
- `attendance-ui`
  - 签到码输入
  - 签退码输入
  - 成功/失败结果页
- `staff-ui`
  - 动态签到码展示
  - 动态签退码展示
  - 实时统计
  - 一键全部签退
- `review-ui`
  - 解绑申请
  - 审核列表
  - 审批动作

### 3.2 后端模块

- `identity-service`
  - 实名校验
  - 浏览器绑定
  - Passkey challenge 生成和验证
  - 临时会话签发
- `activity-service`
  - 活动可见性与详情
  - 报名资格判断
- `code-session-service`
  - 动态码生成
  - 时间片与剩余有效时长计算
- `attendance-service`
  - 签到/签退状态机
  - 防重放
  - 计数更新
  - 事件审计
- `bulk-action-service`
  - 一键全部签退
  - 批量审计
  - 批量 outbox 回写
- `unbind-review-service`
  - 提交解绑申请
  - 管理员审核
  - 绑定失效
- `integration-service`
  - legacy pull
  - outbox relay

## 4. 核心流程设计

### 4.1 首次绑定

1. 用户进入 `/login`
2. 若当前浏览器无有效绑定，跳转 `/bind`
3. 用户输入 `student_id + name`
4. 后端只读查询 `suda_union` 校验实名
5. 实名通过后，前端发起 Passkey 注册
6. 后端保存：
   - Web 身份扩展数据
   - 浏览器绑定
   - Passkey 凭据
   - 临时会话
7. 用户进入活动列表

### 4.2 后续登录

1. 用户进入 `/login`
2. 后端基于绑定上下文生成 Passkey challenge
3. 前端执行 WebAuthn 登录
4. 后端验证通过后签发临时会话
5. 用户进入活动列表

### 4.3 管理员展示动态码

1. 管理员进入活动管理页
2. 选择 `checkin` 或 `checkout`
3. 前端请求 `code-session`
4. 后端按 `activity_id + action_type + slot` 生成 6 位码
5. 前端展示码、剩余时间、实时统计
6. 页面恢复到前台时立即重新拉取当前码

### 4.4 普通用户签到/签退

1. 用户进入具体活动的签到页或签退页
2. 输入 6 位动态码
3. 后端校验：
   - 会话有效
   - 浏览器绑定有效
   - 活动存在
   - 报名资格存在
   - 当前状态允许
   - 动态码正确且未过期
   - 当前时间片未重复提交
4. 成功后写：
   - 用户活动状态
   - 事件流水
   - replay guard
   - outbox
   - 统计更新
5. 返回成功结果

### 4.5 一键全部签退

1. 管理员点击“一键全部签退”
2. 后端查询当前活动中“已签到未签退”的用户
3. 统一使用管理员点击时的服务端时间执行批量签退
4. 批量写状态、事件、管理员审计与 outbox
5. 返回影响人数与批次号

### 4.6 解绑审核

1. 用户发起解绑申请
2. 管理员查看待审核列表
3. 管理员批准后：
   - 原浏览器绑定失效
   - 原会话失效
   - 用户允许新浏览器重新绑定
4. 管理员拒绝后，原绑定保持不变

## 5. 前端设计

### 5.1 技术栈建议

- Vite
- React
- TypeScript
- 轻量路由与表单方案
- WebAuthn/Passkey 客户端库可选，但不要绕开浏览器原生 API 语义

### 5.2 页面路由建议

- `/login`
- `/bind`
- `/activities`
- `/activities/:id`
- `/activities/:id/checkin`
- `/activities/:id/checkout`
- `/staff/activities/:id/manage`
- `/staff/unbind-reviews`

### 5.3 移动端交互原则

- 只做手机优先布局
- 输入 6 位码时使用大号数字样式
- 输入框使用 `inputmode="numeric"`
- 明确显示活动标题与当前动作，避免输错活动
- 成功/失败反馈必须短而清晰
- 管理员管理页从后台回到前台时必须立即刷新

### 5.4 兼容性范围

重点支持：

- iPhone Safari
- iPhone Chrome / Edge
- Android Chrome
- Android Edge
- Samsung Internet
- 微信内普通 H5 打开场景

次级支持：

- Firefox Android

不承诺最佳体验：

- 来源不明的 App 内嵌 WebView
- 老旧国产浏览器

详细浏览器矩阵、屏幕基线与真机验证要求见 `docs/WEB_COMPATIBILITY.md`。

## 6. 后端接口设计

本章只给出接口分组与职责边界；逐字段请求/响应契约以 `docs/API_SPEC.md` 为准。

### 6.1 认证与绑定

- `POST /api/web/bind/verify-identity`
- `POST /api/web/passkey/register/options`
- `POST /api/web/passkey/register/complete`
- `POST /api/web/passkey/login/options`
- `POST /api/web/passkey/login/complete`

### 6.2 活动

- `GET /api/web/activities`
- `GET /api/web/activities/{activity_id}`

### 6.3 动态码

- `GET /api/web/activities/{activity_id}/code-session?action_type=checkin|checkout`
- `POST /api/web/activities/{activity_id}/code-consume`

### 6.4 管理员特权

- `POST /api/web/staff/activities/{activity_id}/bulk-checkout`
- `GET /api/web/staff/unbind-reviews`
- `POST /api/web/staff/unbind-reviews/{review_id}/approve`
- `POST /api/web/staff/unbind-reviews/{review_id}/reject`

### 6.5 解绑申请

- `POST /api/web/unbind-reviews`

## 7. 数据模型与迁移设计

### 7.1 可复用表

- `wx_session`
- `wx_activity_projection`
- `wx_user_activity_status`
- `wx_checkin_event`
- `wx_replay_guard`
- `wx_sync_outbox`
- `wx_admin_roster`

### 7.2 语义调整表

#### `wx_user_auth_ext`

第一阶段不强制改名，但从“微信身份扩展表”转成“Web 身份扩展表”。

保留：

- `legacy_user_id`
- `student_id`
- `name`
- `department`
- `club`
- `role_code`
- `permissions_json`
- `registered`

逐步废弃：

- `wx_identity`
- `wx_token`
- `token_ciphertext`
- `token_expires_at`

建议新增：

- `identity_source`
- `bind_status`
- `last_login_at`

#### `wx_checkin_event`

保留事件主语义，但去掉二维码主语义。

建议新增：

- `code_slot`
- `submission_source`
- `operator_type`
- `operator_user_id`
- `batch_id`

### 7.3 新增表

#### `web_passkey_credential`

- `id`
- `user_id`
- `credential_id`
- `public_key_cose`
- `sign_count`
- `transports_json`
- `aaguid`
- `backup_eligible`
- `backup_state`
- `created_at`
- `last_used_at`
- `revoked_at`

#### `web_browser_binding`

- `binding_id`
- `user_id`
- `binding_fingerprint_hash`
- `user_agent_hash`
- `status`
- `created_at`
- `last_seen_at`
- `revoked_at`
- `revoked_reason`
- `approved_unbind_review_id`

#### `web_unbind_review`

- `review_id`
- `user_id`
- `current_binding_id`
- `requested_new_binding_hint`
- `status`
- `submitted_at`
- `reviewed_by`
- `reviewed_at`
- `review_comment`

#### `web_admin_audit_log`

- `id`
- `operator_user_id`
- `action_type`
- `target_type`
- `target_id`
- `payload_json`
- `created_at`

## 8. 动态码算法与校验设计

### 8.1 生成规则

输入：

- `activity_id`
- `action_type`
- `slot = floor(server_time_ms / 10000)`
- `server_secret`

输出：

- 稳定 6 位数字字符串

建议实现：

- 后端使用 HMAC 或等价稳定算法对 `(activity_id, action_type, slot)` 计算摘要
- 取模映射为 `000000` 到 `999999`
- 前端不参与生成

### 8.2 校验规则

- 以后端时间为准
- 默认仅校验当前时间片
- 为吸收边界延迟，可设计为校验“当前 slot + 前一个 slot”，但对外业务口径仍表述为“10 秒内有效”

### 8.3 防重放

- 使用 `wx_replay_guard`
- 唯一键语义改为：
  - `user_id + activity_id + action_type + slot`
- 同一时间片内同一用户重复提交，返回 `duplicate`

## 9. 并发、一致性与同步设计

### 9.1 状态流转

- 使用事务保护 `wx_user_activity_status`
- 状态机：
  - `none -> checked_in`
  - `checked_in -> checked_out`
  - `checked_out` 不可再次签到

### 9.2 统计更新

现有“读出计数再保存”的方式在共享 6 位码下风险更高。

新要求：

- `checkin_count` / `checkout_count` 改为原子 SQL 更新或显式锁定
- 不允许继续使用无保护的“读后改写”

### 9.3 最终一致性

- 主写库仍是 `wxcheckin_ext`
- `wx_sync_outbox` 继续承担回写 `suda_union` 的职责
- 一键全部签退需要支持批量 outbox 事件或批量事件聚合回写

## 10. 安全设计

### 10.1 认证安全

- WebAuthn / Passkey 仅允许在 HTTPS 下工作
- 登录时要求用户验证通过
- 登录后签发短期 `session_token`

### 10.2 代签风险边界

本方案能显著提高代签成本，但不能绝对消除：

- Passkey 能防止“只知道学号姓名就冒名登录”
- 但登录成功后的已解锁手机仍可能被他人接手操作
- 由于业务要求“提交签到/签退时不再二次 Passkey 验证”，这一风险需通过较短会话 TTL、日志审计和异常行为监控来降低

### 10.3 管理员高风险操作

以下动作必须写管理员审计：

- 审批解绑
- 拒绝解绑
- 一键全部签退

## 11. 测试策略

### 11.1 前端测试

新增：

- 绑定流程
- Passkey 注册与登录流程
- 活动可见性
- 6 位码输入页状态与错误反馈
- 管理员展示页前台恢复
- 一键全部签退交互

废弃：

- 小程序配置完整性测试
- 微信 AppID 检查测试
- 扫码流程测试
- 二维码 payload 相关前端测试

### 11.2 后端测试

新增：

- 实名校验
- 浏览器唯一绑定
- 管理员审核解绑
- Passkey 注册与登录
- 动态码生成与过期
- 动态码重复提交防重放
- 一键全部签退
- 活动计数并发正确性
- `suda_union` 报名资格校验
- outbox 回写

废弃或重写：

- 微信登录测试
- 二维码 issue/consume 测试
- 扫码兼容接口测试

## 12. 迁移步骤

### Phase 1

- 新增 Web 文档
- 新增 Web 相关表与字段
- 不删除旧代码

### Phase 2

- 新建 `web/` 前端
- 后端新增 `/api/web/**` 接口
- 实现绑定、Passkey、动态码、批量签退、解绑审核

### Phase 3

- 完成 Web 端联调
- 验证与 `suda_union` 同步
- 验证主流手机浏览器兼容性

### Phase 4

- 下线旧小程序正式入口
- 删除二维码正式接口与扫码正式链路
- 删除小程序正式逻辑和相关测试
- 用 Web 文档替换旧文档

## 13. 待删除清单

前端待删除：

- `frontend/` 小程序正式业务逻辑
- `wx.login`
- `wx.scanCode`
- `wx.request`
- `Page()` / `App()`
- `app.json` / `project.config.json` / `miniprogram_npm`
- 小程序相关测试

后端待删除：

- 微信登录解析主链路
- 二维码 payload 编解码主链路
- 二维码签发正式接口
- 扫码消费正式接口
- 所有“小程序 / 微信 / 二维码扫码”正式文档口径

## 14. 风险与对策

### 风险 1：共享 6 位码并发高

对策：

- 强化状态锁
- 改统计更新为原子 SQL
- 加强防重放与限流

### 风险 2：登录后手机被转交

对策：

- 缩短会话 TTL
- 敏感异常行为审计
- 明确管理员排查能力

### 风险 3：Passkey 兼容性差异

对策：

- 重点支持主流手机浏览器
- 前端做能力探测
- 对不支持环境给出明确提示，而不是隐式失败

## 15. 参考资料

- MDN Web Authentication API  
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API
- MDN PublicKeyCredentialCreationOptions  
  https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions
- web.dev Discoverable credentials deep dive  
  https://web.dev/articles/webauthn-discoverable-credentials
- MDN `inputmode`  
  https://developer.mozilla.org/docs/Web/HTML/Reference/Global_attributes/inputmode
- MDN Page Visibility API  
  https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- Can I Use Passkeys  
  https://caniuse.com/passkeys
