# 微信小程序活动二维码签到功能说明书

文档版本: v1.1  
状态: 进行中  
更新日期: 2026-02-06  
项目: wxapp-checkin  
依据: `docs/REQUIREMENTS.md`

## 1. 目的
本文档描述微信小程序“活动二维码签到”在当前版本中的页面行为、角色能力、接口协作方式和异常处理，用于前后端联调。

## 2. 目标与非目标
目标:
- 登录后按角色分流页面能力
- 活动卡片统一展示，工作人员可执行签到/签退动作
- 普通用户在个人中心查看资料与积分（社会分、讲座分）
- 与后端接口字段保持一致，降低联调成本

非目标:
- 活动创建/审批后台
- 权限管理后台 UI
- 后端部署与运维方案

## 3. 角色定义
- `normal`：普通用户
- `staff`：有权限工作人员

角色来源:
- 由后端登录接口返回 `role` + `permissions`

## 4. 页面与功能模块

### 4.1 活动页面（`pages/index`）
共同能力:
- 展示活动卡片列表（标题、类型、时间、地点）
- 详情按钮（`has_detail=true` 时显示）

普通用户:
- 显示“我的签到状态”（`my_checked_in`）
- 不显示签到/签退按钮
- 不显示活动总签到人数

工作人员:
- 显示签到按钮
- `support_checkout=true` 时显示签退按钮
- 显示活动总签到人数（`checkin_count`）
- 扫码后调用动作接口，成功后刷新卡片

### 4.2 活动详情页（`pages/activity-detail`）
- 展示活动完整信息：名称、类型、时间、地点、人数、描述

### 4.3 个人中心页（`pages/profile`）
共同能力:
- 展示姓名、学号、学院/部门、社团/组织、绑定状态

普通用户:
- 展示“社会分”“讲座分”（后端返回）
- 不展示“曾参加活动”卡片

工作人员:
- 可展示历史活动记录模块（如后端返回）

### 4.4 注册绑定页（`pages/register`）
- 录入学号、姓名、学院/部门、社团/组织
- 调用注册接口后写入本地缓存

## 5. 关键流程

### 5.1 登录初始化
1. 前端调用 `POST /api/auth/wx-login`
2. 获取 `session_token`、`role`、`permissions`、`user_profile`
3. 缓存必要字段并进入页面

### 5.2 工作人员签到/签退流程
1. 点击活动卡片按钮（签到或签退）
2. 扫码获取 `qr_token`
3. 调用 `POST /api/staff/activity-action`
4. 成功后提示并刷新活动列表

### 5.3 普通用户浏览流程
1. 拉取活动卡片列表
2. 每张卡片展示“我的签到状态”
3. 可进入活动详情

## 6. API 协作要求（字段级）

### 6.1 登录接口
- `POST /api/auth/wx-login`
- 关键返回:
  - `session_token`
  - `role`
  - `permissions`
  - `user_profile.social_score`
  - `user_profile.lecture_score`

### 6.2 活动列表接口
- `GET /api/staff/activities`
- 关键返回:
  - `activities[].activity_id`
  - `activities[].support_checkout`
  - `activities[].has_detail`
  - `activities[].checkin_count`（工作人员）
  - `activities[].my_checked_in`（普通用户）

### 6.3 工作人员动作接口
- `POST /api/staff/activity-action`
- 关键返回:
  - `status`
  - `message`
  - `checkin_record_id`

### 6.4 详情接口
- `GET /api/staff/activities/{activity_id}`

## 7. 异常处理
- 无网络: 阻止扫码动作并提示
- `invalid_qr`: 提示二维码失效
- `forbidden`: 提示无权限
- 其他异常: 统一提示重试

## 8. 验收要点
- 普通用户“我的”页仅展示积分，不显示“曾参加活动”
- 普通用户活动卡片显示“我的签到状态”，不显示总人数
- 工作人员活动卡片显示签到/签退/详情（按字段控制）
- 积分来源为后端返回字段，不在前端计算

## 9. 更新记录
- 2026-02-04：完成 TDesign 化与深色主题升级。
- 2026-02-06：切换角色分流活动卡片模型，新增普通用户积分与“我的签到状态”展示规则。
