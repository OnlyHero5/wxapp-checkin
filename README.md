<div align="center">

# 微信小程序活动签到平台
### `wxapp-checkin`

面向校园活动场景的签到/签退小程序。<br/>
管理员动态展示二维码，普通用户扫码提交动作，活动状态与人数统计实时回流。

[![WeChat MiniProgram](https://img.shields.io/badge/WeChat-MiniProgram-07C160?style=for-the-badge&logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![TDesign MiniProgram](https://img.shields.io/badge/UI-TDesign-0052D9?style=for-the-badge)](https://tdesign.tencent.com/miniprogram)
[![Java 17](https://img.shields.io/badge/Java-17-ff7f50?style=for-the-badge&logo=openjdk&logoColor=white)](backend/pom.xml)
[![Spring Boot 3.5](https://img.shields.io/badge/Spring_Boot-3.5-6db33f?style=for-the-badge&logo=springboot&logoColor=white)](backend/pom.xml)
[![MySQL 8](https://img.shields.io/badge/MySQL-8-4479a1?style=for-the-badge&logo=mysql&logoColor=white)](backend/docker-compose.yml)
[![Redis 7](https://img.shields.io/badge/Redis-7-dc382d?style=for-the-badge&logo=redis&logoColor=white)](backend/docker-compose.yml)
[![Role Based Access](https://img.shields.io/badge/Auth-RBAC-0F766E?style=for-the-badge)](docs/FUNCTIONAL_SPEC.md)
[![API Contract](https://img.shields.io/badge/API-Contract-2563EB?style=for-the-badge)](docs/API_SPEC.md)
[![Dynamic QR](https://img.shields.io/badge/QR-10s_Rotation-1D4ED8?style=for-the-badge)](docs/API_SPEC.md)
[![Docs](https://img.shields.io/badge/Docs-Chinese-0ea5e9?style=for-the-badge)](docs/REQUIREMENTS.md)

<p>
  <a href="#快速预览">快速预览</a> ·
  <a href="#系统架构">系统架构</a> ·
  <a href="#仓库结构">仓库结构</a> ·
  <a href="#角色与可见性">角色与可见性</a> ·
  <a href="#签到签退流程">签到签退流程</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#文档导航">文档导航</a>
</p>

</div>

## 快速预览
- 当前仓库是前后端一体化工程：`frontend/`（微信小程序）+ `backend/`（Java Spring Boot）。
- 活动列表双分组：`正在进行`（上）+ `已完成`（下），两组均按时间倒序。
- 已完成活动仅支持“查看详情”，不再允许签到/签退动作。
- 管理员二维码由后端接口签发：`10 秒展示窗口` + `20 秒提交宽限`（前端仅展示与刷新；默认 `mock=true`，可切换到真实后端）。
- 注册绑定时后端会用 `学号+姓名` 查询管理员名册，命中后返回 `staff` 角色并直接进入管理员页面。
- 会话失效时（`forbidden + error_code=session_expired`）前端会清理本地登录态并跳转登录页自动重登。
- 普通用户在独立“签到/签退”页面调用摄像头扫码并即时收到成功/失败反馈。
- 普通用户只可见与自己有关的活动：`已报名 / 已签到 / 已签退`，不可见无关活动。
- 管理员可看到全量活动与实时统计字段：`checkin_count` / `checkout_count`。

> 仓库状态说明：后端代码已正式纳入本仓库并持续维护，默认与前端同仓协作。

## 系统架构
```text
┌────────────────────────────┐
│ 微信小程序前端 (frontend/)  │
│  pages + utils + tests     │
└──────────────┬─────────────┘
               │ HTTPS JSON API
┌──────────────▼─────────────┐
│ Spring Boot 后端 (backend/) │
│  A-01~A-06 + 兼容接口       │
└───────┬──────────┬─────────┘
        │          │
     MySQL 8     Redis 7
```

## 仓库结构
| 目录 | 说明 | 技术栈 |
|------|------|--------|
| `frontend/` | 微信小程序前端，含页面逻辑与 Node 测试脚本 | WeChat MiniProgram + TDesign |
| `backend/` | 业务后端、数据库迁移、测试与部署脚本 | Java 17 + Spring Boot + Flyway |
| `docs/` | 需求、功能、接口与变更文档（中文） | Markdown |
| `changes.md` | 根目录变更摘要 | Markdown |

## 角色与可见性
| 能力 | 普通用户 (`normal`) | 工作人员 (`staff`) |
|------|---------------------|--------------------|
| 浏览活动卡片 | `Yes`（仅已报名/已签到/已签退） | `Yes`（全部活动） |
| 查看活动详情 | `Yes`（且 `has_detail=true`） | `Yes`（`has_detail=true`） |
| 生成签到二维码 | `No` | `Yes`（仅进行中活动） |
| 生成签退二维码 | `No` | `Yes`（仅进行中且 `support_checkout=true`） |
| 扫码提交签到/签退 | `Yes` | `No` |
| 已完成活动动作 | 仅详情 | 仅详情 |
| 查看总签到/签退人数 | `No` | `Yes` |
| 查看个人状态 | `Yes`（`my_registered/my_checked_in/my_checked_out`） | 可选 |
| 查看个人积分 | `Yes`（`social_score/lecture_score`） | 可选 |

角色判定规则:
- 首次登录后若未注册，用户先进入绑定流程。
- 绑定提交 `student_id + name` 后，后端查询管理员名册：
  - 命中 -> 返回 `staff` + 管理员权限，前端跳转活动页。
  - 未命中 -> 返回 `normal`，前端跳转“我的”页。

## 签到/签退流程
### 管理员端
1. 在活动页点击“签到”或“签退”动作，跳转 `staff-qr` 页面。
2. 页面展示动态二维码 + 倒计时（剩余秒数可见）。
3. 倒计时归零后前端请求后端签发新票据，页面无闪烁切换到新二维码。
4. 统计人数通过活动列表与活动详情接口回流并实时更新。

### 普通用户端
1. 进入 `scan-action` 页面，点击“签到/签退”按钮。
2. 调起摄像头扫码，读取二维码载荷后提交到 `POST /api/checkin/consume`。
3. 成功后显示明确反馈，活动页状态更新为已签到/已签退。
4. 若命中宽限期，后端可通过 `in_grace_window` 返回可接受状态。

## 页面结构
```text
backend/             # Java Spring Boot 后端服务
  src/main/...
frontend/            # 微信小程序前端
frontend/pages/
  index/            # 活动页（双分组卡片）
  activity-detail/  # 活动详情页
  scan-action/      # 普通用户“签到/签退”扫码页
  staff-qr/         # 管理员动态二维码页（倒计时自动换码）
  profile/          # 我的（个人信息/积分）
  register/         # 注册绑定
```

## API 对接最小闭环
| 目的 | 接口 | 关键返回字段 |
|------|------|--------------|
| 登录建会话 | `POST /api/auth/wx-login` | `role`, `permissions`, `user_profile` |
| 绑定注册 | `POST /api/register` | `role`, `permissions`, `admin_verified`, `user_profile` |
| 拉取活动列表 | `GET /api/staff/activities` | `progress_status`, `my_*`, `checkin_count`, `checkout_count` |
| 获取二维码票据 | `POST /api/staff/activities/{activity_id}/qr-session` | `qr_payload`, `display_expire_at`, `accept_expire_at`, `server_time` |
| 扫码提交动作 | `POST /api/checkin/consume` | `status`, `message`, `action_type`, `checkin_record_id`, `in_grace_window` |
| 拉取活动详情 | `GET /api/staff/activities/{activity_id}` | `has_detail` 及详情字段 |
| 会话失效处理 | A-02~A-06 | `status=forbidden`, `error_code=session_expired`（前端跳 `pages/login` 重登） |

> 完整字段与错误码映射见 `docs/API_SPEC.md`。

## 快速开始
### 1. 导入工程
使用微信开发者工具导入仓库根目录：`wxapp-checkin`。

### 2. 启动后端（可选但推荐）
```bash
cd backend
docker compose up -d mysql redis
./scripts/start-dev.sh
```

Windows PowerShell:
```powershell
cd backend
docker compose up -d mysql redis
.\scripts\start-dev.ps1
```

### 3. 安装前端依赖
```bash
cd frontend
npm install
```

### 4. 构建并运行小程序
1. 微信开发者工具执行 `工具 -> 构建 NPM`
2. 编译并预览小程序

### 5. 运行测试
后端测试：
```bash
cd backend
./scripts/run-tests.sh
```

前端测试（Node 脚本）：
```bash
cd frontend
npm test
```

## 配置说明
文件：`frontend/utils/config.js`
- `mock`：是否启用 mock 数据
- `mockUserRole`：本地验收角色（`normal` / `staff`）
- `baseUrl`：后端 API 地址（仅 `mock=false` 时生效）

当前默认值（与代码一致）:
- `mock = true`
- `baseUrl = https://api.example.com`

说明:
- 当前仓库已包含独立后端目录：`backend/`（Java Spring Boot）。
- 若需对接真实后端，请将 `mock` 改为 `false` 并配置真实 `baseUrl`。

## 联调校验清单
- 普通用户活动列表不出现未报名、未签到、未签退的无关活动。
- 管理员二维码每 `10s` 由前端触发后端换码请求，倒计时展示连续无卡顿。
- 普通用户扫码后在 `20s` 宽限期内可正常提交并获得正向反馈。
- 活动页状态与管理员统计人数在动作后可见更新。

## 文档导航
- 需求文档：`docs/REQUIREMENTS.md`
- 功能说明：`docs/FUNCTIONAL_SPEC.md`
- 接口规范：`docs/API_SPEC.md`
- 详细变更：`docs/changes.md`
- 根目录变更摘要：`changes.md`

## 版本信息
- 当前文档覆盖能力：前后端一体化、二维码后端签发、普通用户扫码签到/签退、角色分流与积分展示、`suda_union` 主库与扩展库双向同步。
- 最新发布标签：`v2026.02.10`（2026-02-10）。
- 历史发布标签：`v2026.02.07`、`v2026.02.04`。
