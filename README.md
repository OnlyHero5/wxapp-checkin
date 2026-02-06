<div align="center">

# 微信小程序活动签到平台

前端实现：角色分流 + 活动卡片 + 扫码签到/签退 + 个人积分展示

[![MiniProgram](https://img.shields.io/badge/WeChat-MiniProgram-07C160?style=for-the-badge&logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![TDesign](https://img.shields.io/badge/UI-TDesign-0052D9?style=for-the-badge)](https://tdesign.tencent.com/miniprogram)
[![Role Based](https://img.shields.io/badge/Auth-Role%20Based-111827?style=for-the-badge)](#角色能力矩阵)
[![API Spec](https://img.shields.io/badge/API-Spec-2563EB?style=for-the-badge)](docs/API_SPEC.md)
[![Main](https://img.shields.io/badge/Branch-main-0f172a?style=for-the-badge)](https://github.com/OnlyHero5/wxapp-checkin/tree/main)

</div>

## 项目亮点
- 深色“石墨雾”视觉体系 + TDesign 组件化
- 登录后自动角色分流：普通用户 / 工作人员
- 活动卡片可按角色显示不同信息与动作
- 普通用户显示“社会分/讲座分”，积分来源后端字段
- 文档齐全：需求、功能说明、接口协议、变更日志

## 角色能力矩阵
| 能力 | 普通用户 (`normal`) | 工作人员 (`staff`) |
|------|---------------------|--------------------|
| 浏览活动卡片 | `Yes` | `Yes` |
| 查看活动详情 | `Yes` | `Yes` |
| 发起签到动作 | `No` | `Yes` |
| 发起签退动作 | `No` | `Yes`（`support_checkout=true`） |
| 查看活动总签到人数 | `No` | `Yes`（`checkin_count`） |
| 查看我的签到状态 | `Yes`（`my_checked_in`） | 可选 |
| 个人中心积分 | `Yes`（`social_score`、`lecture_score`） | 可选 |

## 页面结构
```text
src/pages/
  index/            # 活动页（卡片）
  activity-detail/  # 活动详情页
  profile/          # 我的（个人信息/积分）
  register/         # 注册绑定
  records/          # 记录页（历史能力）
  record-detail/    # 记录详情页
```

## 运行方式
1. 用微信开发者工具导入仓库根目录
2. 安装依赖（在 `src/` 下）：

```bash
cd src
npm install
```

3. 微信开发者工具执行 `工具 -> 构建 NPM`
4. 编译并预览

## 配置说明
`src/utils/config.js`:
- `mock`: 是否启用 mock 数据
- `mockUserRole`: `normal` 或 `staff`（用于本地切角色验收）
- `baseUrl`: 后端 API 地址

## 后端必传字段（联调重点）
> 详细协议见 `docs/API_SPEC.md`

### 登录接口 `POST /api/auth/wx-login`
- `session_token`
- `role`
- `permissions`
- `user_profile.student_id`
- `user_profile.name`
- `user_profile.department`
- `user_profile.club`
- `user_profile.avatar_url`
- `user_profile.social_score`
- `user_profile.lecture_score`

### 活动列表 `GET /api/staff/activities`
- `activities[].activity_id`
- `activities[].activity_title`
- `activities[].activity_type`
- `activities[].start_time`
- `activities[].location`
- `activities[].support_checkout`
- `activities[].has_detail`
- `activities[].description`
- `activities[].checkin_count`（工作人员）
- `activities[].my_checked_in`（普通用户）

### 活动动作 `POST /api/staff/activity-action`
- `status`
- `message`
- `checkin_record_id`

## 文档导航
- 需求文档：`docs/REQUIREMENTS.md`
- 功能说明书：`docs/FUNCTIONAL_SPEC.md`
- 后端接口文档：`docs/API_SPEC.md`
- 变更摘要：`changes.md`
- 详细变更：`docs/changes.md`

## 版本说明
- 当前主干包含角色分流 + 活动卡片 + 积分展示版本
- 发布标签：`v2026.02.04`
