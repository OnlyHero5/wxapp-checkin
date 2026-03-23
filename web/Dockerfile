# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS build
WORKDIR /app

# 先复制依赖描述文件，避免每次源码变动都重新安装依赖。
COPY package.json package-lock.json ./
RUN npm ci

# 前端在 compose 口径下默认走根路径 `/` 和同源 `/api/web`。
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Nginx 负责两件事：
# - 直接托管 Vite 构建产物；
# - 把 `/api/web/**` 反代到 backend 容器，保证浏览器同源访问。
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist ./
