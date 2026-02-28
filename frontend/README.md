# wxapp-checkin 小程序前端（`frontend/`）说明

本文档只回答三件事：
1. **生产环境怎么“上线/更新”前端**（小程序发布）
2. **前端如何配置后端地址**（`baseUrl` / `mock`）
3. 常见联调问题（真机、NPM 构建、测试）

> 说明：微信小程序前端**没有“服务器进程”**，生产环境的“启动”本质是：后端服务可用 + 小程序发布到线上。

## 1) 生产环境“一键发布/更新”（Release）

### 1.1 前置条件

- 生产后端已可访问：例如 `https://api.example.com`
  - 必须是 **HTTPS**
  - `baseUrl` **不要**包含 `/api`（前端请求代码会自动拼接 `/api/...`）
- 微信公众平台已配置“服务器域名”（request 合法域名）
  - 把 `api.example.com` 加进去（否则线上无法请求）

### 1.2 发布步骤

1. 配置生产 API 地址：修改 `frontend/utils/config.js`
   - `mock: false`
   - `baseUrl: "https://api.example.com"`（换成你的生产域名）
2. 使用微信开发者工具导入项目：仓库目录 `wxapp-checkin/`
3. 依赖构建：`工具 -> 构建 NPM`
4. 点击 `上传`，走微信审核/发布流程

## 2) 配置在哪里改（最常问）

文件：`frontend/utils/config.js`

- `mock`
  - `true`：前端走本地 mock 数据（不请求后端）
  - `false`：请求真实后端
- `baseUrl`
  - 后端根地址，例如 `https://api.example.com`
  - **不要加** `/api`
- `mockUserRole`
  - mock 模式下用于验收页面权限：`"staff"` / `"normal"`

### 推荐配置

- 只看 UI / 不连后端：`mock=true`
- 本地联调（开发者工具 + 真机）：`mock=false`，`baseUrl=http://<局域网IP>:<后端端口>`
- 生产发布：`mock=false`，`baseUrl=https://<生产域名>`

## 3) 本地联调快速开始

1. 启动后端（生产/本地方式见 `backend/README.md`）
2. 设置 `frontend/utils/config.js` 的 `mock=false` 与 `baseUrl`
3. 微信开发者工具编译运行

## 4) 常见问题

### 4.1 真机无法访问 `127.0.0.1`

真机访问小程序时，`baseUrl` 不能是 `127.0.0.1/localhost`，应改为同网段可访问的局域网 IP 或线上 HTTPS 域名。

### 4.2 模拟器启动失败（JSON 解析错误）

如果出现类似 `miniprogram_npm/tdesign-miniprogram/**.json` 的 JSON 解析错误，通常是小程序 NPM 产物损坏：

```bash
cd frontend
npm install
npm run repair:miniprogram-npm
```

然后在微信开发者工具执行：
1. `工具 -> 构建 NPM`
2. `详情 -> 本地设置 -> 清缓存 -> 清除全部缓存`
3. 重新编译

## 5) 前端测试

```bash
cd frontend
npm test
```

