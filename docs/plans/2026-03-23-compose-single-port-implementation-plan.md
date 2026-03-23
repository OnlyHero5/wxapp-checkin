# Compose Single Port Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `wxapp-checkin` 根 Docker Compose 的宿主机暴露口收口为单一 `89` 端口，并同步校验脚本与部署文档。

**Architecture:** 保持现有 `mysql + redis + backend + web` 四服务编排不变，仅移除 `backend` 的宿主机映射、把 `web` 映射改为 `89:80`。容器内部继续依赖 Compose 默认 bridge 网络，由 `web` 容器内的 Nginx 转发 `/api/web/**` 到 `backend:8080`。

**Tech Stack:** Docker Compose、Nginx、Bash、Markdown

---

### Task 1: 补充设计与实施文档

**Files:**
- Create: `docs/plans/2026-03-23-compose-single-port-design.md`
- Create: `docs/plans/2026-03-23-compose-single-port-implementation-plan.md`

**Step 1: 写入设计确认稿**

- 记录目标、现状、可选方案、推荐方案、风险与验收口径。

**Step 2: 写入实施计划**

- 记录要修改的文件、静态验证方式与提交策略。

**Step 3: 提交文档**

Run:

```bash
git add docs/plans/2026-03-23-compose-single-port-design.md docs/plans/2026-03-23-compose-single-port-implementation-plan.md
git commit -m "docs: 记录 compose 单端口收口方案"
```

Expected:

- 设计与计划文档进入版本库
- `git status --short` 重新为空

### Task 2: 收敛根 Compose 暴露端口

**Files:**
- Modify: `docker-compose.yml`

**Step 1: 修改端口映射**

- 删除 `backend` 的宿主机端口映射
- 把 `web` 的宿主机映射改为 `89:80`
- 在配置处补充中文注释，明确“外部只留 89，后端只走容器内网”

**Step 2: 静态渲染配置确认**

Run:

```bash
docker compose config
```

Expected:

- 配置可正常渲染
- 只出现 `published: "89"`
- 不出现 `published: "8080"` 或 `published: "8088"`

### Task 3: 更新静态校验脚本

**Files:**
- Modify: `scripts/verify-docker-compose.sh`

**Step 1: 调整端口校验逻辑**

- 保留 mysql / redis 不暴露宿主机端口的约束
- 新增“默认只允许暴露 89”检查
- 新增“web 必须绑定 89”检查

**Step 2: 执行静态校验脚本**

Run:

```bash
./scripts/verify-docker-compose.sh
```

Expected:

- 输出 `docker compose 静态校验通过`

### Task 4: 更新说明文档

**Files:**
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`

**Step 1: 更新端口说明**

- 把外部访问入口改成 `http://127.0.0.1:89/`
- 明确 `backend` 不再直接暴露宿主机端口

**Step 2: 更新验收命令**

- 把宿主机健康检查改为 `curl -I http://127.0.0.1:89/`
- 如需验证后端健康，改为容器内 `curl http://127.0.0.1:8080/actuator/health`

### Task 5: 最终验证与提交

**Files:**
- Modify: `docker-compose.yml`
- Modify: `scripts/verify-docker-compose.sh`
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`

**Step 1: 运行最终静态验证**

Run:

```bash
docker compose config >/dev/null
./scripts/verify-docker-compose.sh
git status --short
```

Expected:

- Compose 配置渲染成功
- 校验脚本通过
- 除本次改动外无额外脏文件

**Step 2: 提交实现**

Run:

```bash
git add docker-compose.yml scripts/verify-docker-compose.sh README.md docs/DEPLOYMENT.md
git commit -m "fix(deploy): 收口 compose 对外暴露端口"
```

Expected:

- 改动提交完成
- `git status --short` 为空
