<div align="center">

# 微信小程序活动签到平台

前端实现：角色分流 + 活动双分组卡片 + 管理员动态二维码签到/签退 + 普通用户扫码提交 + 个人积分展示

[![MiniProgram](https://img.shields.io/badge/WeChat-MiniProgram-07C160?style=for-the-badge&logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![TDesign](https://img.shields.io/badge/UI-TDesign-0052D9?style=for-the-badge)](https://tdesign.tencent.com/miniprogram)
[![API Spec](https://img.shields.io/badge/API-Spec-2563EB?style=for-the-badge)](docs/API_SPEC.md)

</div>

## 项目亮点
- 深色“石墨雾”风格 + 活动类型彩色胶囊（路演/竞赛等）
- 活动页按状态分组：`正在进行`（上）/`已完成`（下）
- 两组均按时间倒序（新的在上）
- 已完成活动仅支持“详情”，不支持签到/签退
- 管理员签到/签退码动态轮换（10 秒换码 + 20 秒宽限提交）
- 普通用户独立“签到/签退”页，摄像头扫码后立即反馈
- 普通用户仅可见“已报名/已签到/已签退”活动（不可见未报名未参加活动）
- 角色分流：
  - `normal`：浏览“已报名/已签到/已签退”活动 + 我的状态（已报名/已签到/已签退）+ 个人积分
  - `staff`：浏览活动 + 生成签到码/签退码 + 详情 + 个人信息

## 角色能力矩阵
| 能力 | 普通用户 (`normal`) | 工作人员 (`staff`) |
|------|---------------------|--------------------|
| 浏览活动卡片 | `Yes`（仅已报名/已签到/已签退） | `Yes`（全部活动） |
| 查看活动详情 | `Yes`（仅已报名/已签到/已签退且 `has_detail=true`） | `Yes`（`has_detail=true`） |
| 生成签到二维码 | `No` | `Yes`（仅进行中活动） |
| 生成签退二维码 | `No` | `Yes`（仅进行中且 `support_checkout=true`） |
| 扫码提交签到/签退 | `Yes`（摄像头扫码） | `No` |
| 已完成活动动作 | 仅详情 | 仅详情 |
| 查看活动总签到人数 | `No` | `Yes`（`checkin_count` / `checkout_count`） |
| 查看我的状态 | `Yes`（`my_registered` / `my_checked_in` / `my_checked_out`） | 可选 |
| 个人中心积分 | `Yes`（`social_score`、`lecture_score`） | 可选 |

## 页面结构
```text
src/pages/
  index/            # 活动页（双分组卡片）
  activity-detail/  # 活动详情页
  scan-action/      # 普通用户“签到/签退”扫码页
  staff-qr/         # 管理员动态二维码展示页（倒计时自动换码）
  profile/          # 我的（个人信息/积分）
  register/         # 注册绑定
```

## 运行方式
1. 用微信开发者工具导入仓库根目录
2. 安装依赖（在 `src/` 下）:

```bash
cd src
npm install
```

3. 微信开发者工具执行：`工具 -> 构建 NPM`
4. 编译并预览

## 配置说明
文件：`src/utils/config.js`
- `mock`: 是否启用 mock 数据
- `mockUserRole`: `normal` 或 `staff`（本地验收角色）
- `baseUrl`: 后端 API 地址（`mock=false` 时生效）

## 联调重点
> 完整接口与页面映射见 `docs/API_SPEC.md`（建议后端先读此文档）。

主链路必需接口：
- `POST /api/auth/wx-login`
- `POST /api/register`
- `GET /api/staff/activities`
- `POST /api/staff/activities/{activity_id}/qr-session`
- `POST /api/checkin/consume`
- `GET /api/staff/activities/{activity_id}`

关键字段：
- 登录：`role`、`permissions`、`user_profile.*`
- 活动列表：`progress_status`、`support_checkout`、`has_detail`、`checkin_count`、`checkout_count`、`my_registered`、`my_checked_in`、`my_checked_out`
- 动态二维码：`qr_payload`、`display_expire_at`、`accept_expire_at`、`rotate_seconds`、`grace_seconds`
- 扫码提交：`status`、`message`、`action_type`、`checkin_record_id`、`in_grace_window`

## 文档导航
- 需求文档：`docs/REQUIREMENTS.md`
- 功能说明：`docs/FUNCTIONAL_SPEC.md`
- 接口映射：`docs/API_SPEC.md`
- 详细变更：`docs/changes.md`
- 根目录变更摘要：`changes.md`

## 版本说明
- 当前版本包含：活动双分组、已完成仅详情、管理员动态二维码、普通用户扫码提交、角色分流与积分展示。
- 发布标签：`v2026.02.04`（后续版本请以最新提交与文档为准）。
