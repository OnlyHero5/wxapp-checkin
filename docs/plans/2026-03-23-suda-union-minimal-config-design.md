# suda_union 最小配置口径设计

更新日期：2026-03-23
适用范围：`wxapp-checkin` 根 `docker-compose.yml` 的默认启动口径、legacy `suda_union` 配置与 Docker 启动提示

## 1. 目标

将当前 `wxapp-checkin` 的 Docker 启动体验收敛为：

- 前后端与内部依赖默认开箱即用
- 除 `suda_union` 的地址、账号、密码外，用户无需再理解或填写其他 legacy 配置
- 默认不填写这 3 个值时，系统自动进入“单项目演示状态”
- 演示状态必须明确提示“非生产在线状态”
- 若 3 个值填写不完整或外部 `suda_union` 不可达，启动前要明确提示并失败

## 2. 当前现状

当前仓库的 legacy 配置口径仍以完整 JDBC 为中心：

- `docker/compose.env` 暴露 `LEGACY_DB_URL`
- `docker/compose.override.env.example` 也鼓励直接覆盖 `LEGACY_DB_URL`
- `application-prod.yml` 优先从 `LEGACY_DB_URL` 读取 legacy 数据源
- 这会让使用者直接接触 JDBC URL、编码参数、库名等实现细节

虽然仓库已经能一键演示，但配置体验仍然偏“开发者内部口径”，不符合“只填 3 个值就够”的目标。

## 3. 方案对比

### 方案 A：引入 `SUDA_UNION_DB_*` 三变量，并由后端内部拼接 legacy JDBC（推荐）

- 对外只暴露：
  - `SUDA_UNION_DB_HOST`
  - `SUDA_UNION_DB_USER`
  - `SUDA_UNION_DB_PASSWORD`
- 后端内部自动拼接：
  - 库名固定 `suda_union`
  - 端口固定 `3306`
  - JDBC 参数固定为当前 prod 口径
- 未填写时，自动回退到 compose 内 demo `suda_union`

优点：

- 配置体验最简单
- 用户不必理解 `LEGACY_DB_URL`
- 预检脚本可以更容易地做“演示模式 / 在线模式 / 配置不完整”三态判断

缺点：

- 需要同时改 compose、Spring 配置和预检脚本

### 方案 B：仍保留 `LEGACY_DB_URL`，但在 compose 层根据 `SUDA_UNION_DB_HOST` 拼接

优点：

- 后端配置改动较少

缺点：

- compose 字符串拼装可读性差
- 空值 / 回退逻辑分散在 compose 层，不利于维护

### 方案 C：继续保留 `LEGACY_DB_URL` 对外暴露，仅优化文档

优点：

- 改动最小

缺点：

- 用户仍然要面对完整 JDBC URL
- 无法真正满足“只配 3 个值”的体验目标

## 4. 选型结论

采用方案 A。

理由：

- 用户明确要求只配置 `suda_union` 的地址、账号、密码
- 默认不应再要求填写 `LEGACY_DB_URL`
- 演示状态与在线状态需要有清晰的模式提示

## 5. 具体设计

### 5.1 新的配置口径

对外只保留以下 legacy 接入项：

- `SUDA_UNION_DB_HOST`
- `SUDA_UNION_DB_USER`
- `SUDA_UNION_DB_PASSWORD`

内部固定规则：

- schema 固定为 `suda_union`
- port 固定为 `3306`
- JDBC 参数沿用现有 prod 参数：
  - `useUnicode=true`
  - `characterEncoding=UTF-8`
  - `serverTimezone=UTC`
  - `allowPublicKeyRetrieval=true`
  - `useSSL=false`

### 5.2 默认演示模式

当上述 3 个值都未填写时：

- 不阻止容器启动
- legacy 自动回退到 compose 内 demo `suda_union`
- 启动前通过紫色预检日志明确输出：

`未填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD，当前是单项目演示状态，非生产在线状态`

设计目的：

- 继续保持“克隆仓库后能直接启动”的演示体验
- 同时避免使用者误把演示状态当成真实在线部署

### 5.3 外部 `suda_union` 在线模式

当 3 个值都已填写时：

- 认为用户正在接入外部 `suda_union`
- 预检脚本按外部 `suda_union` 口径检查连通性
- 若连通性失败，直接 `fail fast`
- 启动前通过紫色日志明确提示当前正在按“外部 `suda_union` 模式”运行

### 5.4 配置不完整保护

当 3 个值只填写了一部分时：

- 直接 `fail fast`
- 输出紫色提示：

`suda_union 外部配置不完整：请同时填写 SUDA_UNION_DB_HOST / SUDA_UNION_DB_USER / SUDA_UNION_DB_PASSWORD`

原因：

- 防止系统在“半在线半演示”的状态下启动
- 避免使用者误判连的是线上库还是 demo 库

### 5.5 Spring 配置回退规则

`application-prod.yml` 的 legacy 数据源读取顺序调整为：

1. 若存在兼容性口径 `LEGACY_DB_URL` / `LEGACY_DB_USER` / `LEGACY_DB_PASSWORD`，优先使用
2. 否则若存在 `SUDA_UNION_DB_HOST` / `SUDA_UNION_DB_USER` / `SUDA_UNION_DB_PASSWORD`，自动拼接 `suda_union` JDBC
3. 若上述都未填写，则回退到内部 demo 口径：
   - host 复用 `DB_HOST`
   - username 复用 `DB_USER`
   - password 复用 `DB_PASSWORD`

说明：

- 对外文档不再主推 `LEGACY_DB_*`
- 但保留兼容读取，避免已有部署因变量名升级直接失效

## 6. 落地范围

预计修改文件：

- `docker/compose.env`
- `docker/compose.override.env.example`
- `backend/src/main/resources/application-prod.yml`
- `backend/scripts/docker-preflight.sh`
- `backend/scripts/test-docker-preflight.sh`
- `backend/README.md`

不修改：

- 根 `docker-compose.yml` 的服务编排结构
- `mysql` 初始化脚本
- 前端运行逻辑

## 7. 验收口径

### 7.1 演示模式

条件：

- `docker/compose.override.env` 不填写 `SUDA_UNION_DB_*`

期望：

- `docker compose up --build` 可成功启动
- 预检日志出现紫色演示提示
- 文案明确写出“单项目演示状态，非生产在线状态”

### 7.2 外部在线模式

条件：

- `docker/compose.override.env` 填写完整的 3 个 `SUDA_UNION_DB_*`

期望：

- 预检日志出现紫色“外部 `suda_union` 模式”提示
- 若数据库可达，正常启动
- 若数据库不可达，直接输出 `suda_union 数据库连接问题` 并退出

### 7.3 配置不完整

条件：

- 只填写部分 `SUDA_UNION_DB_*`

期望：

- 启动前直接失败
- 输出紫色配置不完整提示

## 8. 风险与回退

主要风险：

- 老部署可能仍然只配置了 `LEGACY_DB_URL`
- 若不保留兼容回退，会引入隐式破坏

控制策略：

- 后端仍保留对 `LEGACY_DB_*` 的兼容读取
- 文档与示例文件切换为 `SUDA_UNION_DB_*` 主口径

回退方式：

- 恢复 `docker/compose.env` 与 `compose.override.env.example` 中的 `LEGACY_DB_*`
- 恢复 `application-prod.yml` 旧回退逻辑
- 恢复预检脚本对 `LEGACY_DB_URL` 的强依赖模式
