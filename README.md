<div align="center">

# 微信小程序活动签到平台
### `wxapp-checkin`

面向校园活动场景的签到/签退小程序。<br/>
管理员动态展示二维码，普通用户扫码提交动作，活动状态与人数统计实时回流。

[![WeChat MiniProgram](https://img.shields.io/badge/WeChat-MiniProgram-07C160?style=for-the-badge&logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![TDesign MiniProgram](https://img.shields.io/badge/UI-TDesign-0052D9?style=for-the-badge)](https://tdesign.tencent.com/miniprogram)
[![Role Based Access](https://img.shields.io/badge/Auth-RBAC-0F766E?style=for-the-badge)](docs/FUNCTIONAL_SPEC.md)
[![API Contract](https://img.shields.io/badge/API-Contract-2563EB?style=for-the-badge)](docs/API_SPEC.md)
[![Dynamic QR](https://img.shields.io/badge/QR-10s_Rotation-1D4ED8?style=for-the-badge)](docs/API_SPEC.md)

<p>
  <a href="#快速预览">快速预览</a> ·
  <a href="#角色与可见性">角色与可见性</a> ·
  <a href="#签到签退流程">签到签退流程</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#文档导航">文档导航</a>
</p>

</div>

## 快速预览
- 活动列表双分组：`正在进行`（上）+ `已完成`（下），两组均按时间倒序。
- 已完成活动仅支持“查看详情”，不再允许签到/签退动作。
- 管理员二维码为动态会话：`10 秒换码` + `20 秒宽限提交`（兼顾安全与弱网体验）。
- 普通用户在独立“签到/签退”页面调用摄像头扫码并即时收到成功/失败反馈。
- 普通用户只可见与自己有关的活动：`已报名 / 已签到 / 已签退`，不可见无关活动。
- 管理员可看到全量活动与实时统计字段：`checkin_count` / `checkout_count`。

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

## 签到/签退流程
### 管理员端
1. 在活动页点击“签到”或“签退”动作，跳转 `staff-qr` 页面。
2. 页面展示动态二维码 + 倒计时（剩余秒数可见）。
3. 倒计时归零后自动请求新会话，页面无闪烁切换到新二维码。
4. 统计人数通过活动列表与活动详情接口回流并实时更新。

### 普通用户端
1. 进入 `scan-action` 页面，点击“签到/签退”按钮。
2. 调起摄像头扫码，读取二维码载荷后提交到 `POST /api/checkin/consume`。
3. 成功后显示明确反馈，活动页状态更新为已签到/已签退。
4. 若命中宽限期，后端可通过 `in_grace_window` 返回可接受状态。

## 页面结构
```text
src/pages/
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
| 绑定注册 | `POST /api/register` | `role`, `permissions`, `user_profile` |
| 拉取活动列表 | `GET /api/staff/activities` | `progress_status`, `my_*`, `checkin_count`, `checkout_count` |
| 生成动态码 | `POST /api/staff/activities/{activity_id}/qr-session` | `qr_payload`, `display_expire_at`, `accept_expire_at`, `rotate_seconds`, `grace_seconds` |
| 扫码提交动作 | `POST /api/checkin/consume` | `status`, `message`, `action_type`, `checkin_record_id`, `in_grace_window` |
| 拉取活动详情 | `GET /api/staff/activities/{activity_id}` | `has_detail` 及详情字段 |

> 完整字段与错误码映射见 `docs/API_SPEC.md`。

## 快速开始
### 1. 导入工程
使用微信开发者工具导入仓库根目录：`wxapp-checkin`。

### 2. 安装依赖
```bash
cd src
npm install
```

### 3. 构建并运行
1. 微信开发者工具执行 `工具 -> 构建 NPM`
2. 编译并预览小程序

## 配置说明
文件：`src/utils/config.js`
- `mock`：是否启用 mock 数据
- `mockUserRole`：本地验收角色（`normal` / `staff`）
- `baseUrl`：后端 API 地址（仅 `mock=false` 时生效）

## 联调校验清单
- 普通用户活动列表不出现未报名、未签到、未签退的无关活动。
- 管理员二维码每 `10s` 自动换码，倒计时展示连续无卡顿。
- 普通用户扫码后在 `20s` 宽限期内可正常提交并获得正向反馈。
- 活动页状态与管理员统计人数在动作后可见更新。

## 文档导航
- 需求文档：`docs/REQUIREMENTS.md`
- 功能说明：`docs/FUNCTIONAL_SPEC.md`
- 接口规范：`docs/API_SPEC.md`
- 详细变更：`docs/changes.md`
- 根目录变更摘要：`changes.md`

## 版本信息
- 当前文档覆盖能力：活动可见性收敛、管理员动态二维码、普通用户扫码签到/签退、角色分流与积分展示。
- 历史发布标签：`v2026.02.04`（以最新提交与文档为准）。
