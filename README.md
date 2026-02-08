<div align="center">

# 微信小程序活动签到平台

前端实现：角色分流 + 活动双分组卡片 + 工作人员扫码签到/签退 + 个人积分展示

[![MiniProgram](https://img.shields.io/badge/WeChat-MiniProgram-07C160?style=for-the-badge&logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![TDesign](https://img.shields.io/badge/UI-TDesign-0052D9?style=for-the-badge)](https://tdesign.tencent.com/miniprogram)
[![API Spec](https://img.shields.io/badge/API-Spec-2563EB?style=for-the-badge)](docs/API_SPEC.md)

</div>

## 项目亮点
- 深色“石墨雾”风格 + 活动类型彩色胶囊（路演/竞赛等）
- 活动页按状态分组：`正在进行`（上）/`已完成`（下）
- 两组均按时间倒序（新的在上）
- 已完成活动仅支持“详情”，不支持签到/签退
- 普通用户仅可见“已报名/已参加”活动（不可见未报名未参加活动）
- 角色分流：
  - `normal`：浏览“已报名/已参加”活动 + 我的状态（已报名/已参加）+ 个人积分
  - `staff`：浏览活动 + 签到/签退 + 详情 + 个人信息

## 角色能力矩阵
| 能力 | 普通用户 (`normal`) | 工作人员 (`staff`) |
|------|---------------------|--------------------|
| 浏览活动卡片 | `Yes`（仅已报名/已参加） | `Yes`（全部活动） |
| 查看活动详情 | `Yes`（仅已报名/已参加且 `has_detail=true`） | `Yes`（`has_detail=true`） |
| 发起签到动作 | `No` | `Yes`（仅进行中活动） |
| 发起签退动作 | `No` | `Yes`（仅进行中且 `support_checkout=true`） |
| 已完成活动动作 | 仅详情 | 仅详情 |
| 查看活动总签到人数 | `No` | `Yes`（`checkin_count`） |
| 查看我的状态 | `Yes`（`my_registered` / `my_checked_in`） | 可选 |
| 个人中心积分 | `Yes`（`social_score`、`lecture_score`） | 可选 |

## 页面结构
```text
src/pages/
  index/            # 活动页（双分组卡片）
  activity-detail/  # 活动详情页
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
- `POST /api/staff/activity-action`
- `GET /api/staff/activities/{activity_id}`

关键字段：
- 登录：`role`、`permissions`、`user_profile.*`
- 活动列表：`progress_status`、`support_checkout`、`has_detail`、`checkin_count`、`my_registered`、`my_checked_in`
- 活动动作：`status`、`message`、`checkin_record_id`

## 文档导航
- 需求文档：`docs/REQUIREMENTS.md`
- 功能说明：`docs/FUNCTIONAL_SPEC.md`
- 接口映射：`docs/API_SPEC.md`
- 详细变更：`docs/changes.md`
- 根目录变更摘要：`changes.md`

## 版本说明
- 当前版本包含：活动双分组、已完成仅详情、类型胶囊色彩增强、角色分流与积分展示。
- 发布标签：`v2026.02.04`（后续版本请以最新提交与文档为准）。
