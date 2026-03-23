# Docker 启动友好日志设计

更新日期：2026-03-23
适用范围：`wxapp-checkin/backend` Docker 启动链路与依赖预检输出

## 1. 目标

优化 `wxapp-checkin` 在 Docker 启动时的可观测性，让环境配置或依赖未就绪的问题在 Spring Boot 正式启动前就被明确暴露出来。

本次设计目标：

- 对关键依赖做容器启动前预检
- 当 `suda_union` 等环境依赖异常时，输出明确、面向人的诊断文案
- 预检日志在视觉上区别于框架日志，统一使用紫色字体
- 关键依赖不满足时直接 `fail fast`，容器退出，不进入应用启动阶段

## 2. 当前现状

当前 `backend` 镜像入口是直接执行：

```sh
java $JAVA_OPTS -jar /app/app.jar
```

这意味着：

- 容器没有独立的启动前预检层
- 环境变量缺失、数据库不可达等问题主要在 Spring / JDBC / Flyway 启动过程中暴露
- `legacy` 库（`suda_union`）采用独立 JDBC 配置，默认不会在最早阶段输出专门的依赖诊断
- 用户看到的日志容易混杂在 Spring Boot、Hibernate、Flyway 等框架输出中，定位成本高

## 3. 方案对比

### 方案 A：容器入口预检脚本（推荐）

- 在 `java -jar` 前增加一个 `preflight` shell 脚本
- 脚本负责检查配置完整性与关键依赖连通性
- 失败时用统一的紫色日志输出原因并直接退出
- 成功后再进入 Java 主进程

优点：

- 失败时序最早，问题不会被框架日志淹没
- 能独立控制日志格式、前缀和颜色
- 容易针对 `suda_union`、扩展库、Redis 分别给出明确文案

缺点：

- 需要调整 Dockerfile 和镜像启动入口
- 需要在镜像内准备最小探测工具

### 方案 B：Spring 启动早期预检

- 在应用启动时增加 `ApplicationRunner` 或类似机制
- 使用应用配置和 JDBC 主动探测依赖

优点：

- 逻辑集中在 Java 代码里
- 能直接复用现有配置绑定能力

缺点：

- 预检输出仍会落入 Spring 启动日志流
- 失败已经发生在框架初始化阶段之后，不够“前置”

### 方案 C：仅依赖 healthcheck

- 把诊断责任主要交给 Docker healthcheck

优点：

- 改动最少

缺点：

- healthcheck 适合机器判断，不适合面向人的明确诊断
- 无法在第一时间给出“`suda_union` 数据库连接问题”这类语义化错误

## 4. 选型结论

采用方案 A：在 `backend` 容器入口增加独立 `preflight` 预检脚本。

选择理由：

- 用户明确要求日志区别于框架日志，并在环境未配好时尽快提示
- 用户明确要求依赖异常时 `fail fast`
- 预检脚本最适合输出统一的紫色自定义日志

## 5. 具体设计

### 5.1 启动链路

新的后端容器启动流程：

1. Docker 启动容器
2. 入口脚本执行 `preflight`
3. `preflight` 依次检查关键配置与依赖连通性
4. 任一检查失败：输出紫色错误日志并退出非 0
5. 全部通过：输出紫色“预检通过”日志
6. 执行原有 `java -jar /app/app.jar`

### 5.2 检查项

预检分为两类：

#### 配置层检查

- 主库相关变量是否齐全：`DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`
- legacy 库相关变量是否齐全：`LEGACY_DB_URL`、`LEGACY_DB_USER`
- Redis 相关变量是否齐全：`REDIS_HOST`、`REDIS_PORT`
- `prod` 场景要求的关键开关是否合理：`LEGACY_SYNC_ENABLED`、`OUTBOX_RELAY_ENABLED`

#### 连通层检查

- 扩展库 `wxcheckin_ext` 是否可达且可完成最小握手
- legacy 库 `suda_union` 是否可达且可完成最小握手
- Redis 是否可建立最小探测连接

其中 legacy 库需要单独命名为：

- `suda_union 数据库连接问题`

避免只输出通用的“数据库连接失败”。

### 5.3 日志规范

预检日志统一：

- 前缀：`[wxcheckin-preflight]`
- 颜色：ANSI 紫色
- 输出层级：`INFO` / `WARN` / `ERROR` 由脚本自行表达，不依赖日志框架

示例文案：

- `"[wxcheckin-preflight] 开始检查 Docker 启动依赖"`
- `"[wxcheckin-preflight] suda_union 数据库连接问题：无法连接 mysql:3306/suda_union"`
- `"[wxcheckin-preflight] Redis 连接问题：无法连接 redis:6379"`
- `"[wxcheckin-preflight] 依赖预检通过，开始启动 Spring Boot"`

### 5.4 失败策略

- 任一关键检查失败，脚本立即退出
- 不再继续进入 Spring Boot 启动
- 容器状态表现为启动失败，方便 `docker compose ps` 和重启策略识别

### 5.5 成功策略

- 所有预检通过后，执行原有 Java 启动命令
- Spring Boot 日志保持现状，不做颜色侵入式改造

## 6. 落地范围

预计涉及文件：

- `backend/Dockerfile`
- `backend/scripts/` 下新增 Docker 启动预检脚本
- 可能新增与脚本相关的测试文件
- 视需要补充 `docker-compose.yml` / 文档中的启动说明

不修改：

- 业务层同步逻辑
- Spring Boot 日志框架配色
- `suda-gs-ams`、`suda_union/` 等其他项目

## 7. 测试与验收

### 7.1 自动化验证

- 预检脚本单测或脚本级回归，覆盖：
  - 缺少 `LEGACY_DB_URL`
  - `LEGACY_DB_URL` 指向不可达地址
  - Redis 不可达
  - 全部通过时返回成功

### 7.2 手工验收

- `docker compose up --build backend` 时，若 legacy 依赖异常，应优先出现紫色自定义错误
- 当 `suda_union` 不可达时，日志应出现 `suda_union 数据库连接问题`
- 当依赖通过时，应出现紫色“预检通过”日志，然后才看到 Spring Boot 正常启动日志

## 8. 风险与回退

主要风险：

- 预检实现依赖镜像内额外工具，若选择不当可能增大镜像复杂度
- 预检项过严时，可能把原本允许延迟恢复的场景提前拦截

控制策略：

- 只校验真正影响启动成功的关键依赖
- 预检输出聚焦“缺配置 / 不可达 / 握手失败”这类高价值信息

回退方式：

- 恢复 Dockerfile 原始入口
- 移除 `preflight` 脚本
- 回到直接 `java -jar` 启动
