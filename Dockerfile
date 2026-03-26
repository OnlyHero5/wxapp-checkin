# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS web-build
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG ALL_PROXY
ARG NO_PROXY
ENV HTTP_PROXY="${HTTP_PROXY}" \
    HTTPS_PROXY="${HTTPS_PROXY}" \
    ALL_PROXY="${ALL_PROXY}" \
    NO_PROXY="${NO_PROXY}" \
    http_proxy="${HTTP_PROXY}" \
    https_proxy="${HTTPS_PROXY}" \
    all_proxy="${ALL_PROXY}" \
    no_proxy="${NO_PROXY}"
WORKDIR /app/web

# 先安装前端依赖，保证首次构建时自动拉齐 npm 包；
# 后续仅源码变更时可以复用缓存，避免每次都重新下载。
COPY web/package.json web/package-lock.json ./
RUN npm ci

# Web 运行时默认走同源 `/api/web`，因此容器内只需要产出静态资源。
COPY web/ ./
RUN npm run build

FROM rust:1.86-bookworm AS rust-build
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG ALL_PROXY
ARG NO_PROXY
ENV HTTP_PROXY="${HTTP_PROXY}" \
    HTTPS_PROXY="${HTTPS_PROXY}" \
    ALL_PROXY="${ALL_PROXY}" \
    NO_PROXY="${NO_PROXY}" \
    http_proxy="${HTTP_PROXY}" \
    https_proxy="${HTTPS_PROXY}" \
    all_proxy="${ALL_PROXY}" \
    no_proxy="${NO_PROXY}"
WORKDIR /app/backend-rust

# Rust 依赖同样在 build 阶段自动下载；
# 这样 `docker build` 就会把 cargo 依赖和编译产物一次性准备好，
# `docker run` 时只启动 release 二进制，不再现场拉依赖。
COPY backend-rust/Cargo.toml backend-rust/Cargo.lock ./
COPY backend-rust/src ./src
COPY backend-rust/tests ./tests
RUN cargo build --release

FROM debian:bookworm-slim
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG ALL_PROXY
ARG NO_PROXY
ENV HTTP_PROXY="${HTTP_PROXY}" \
    HTTPS_PROXY="${HTTPS_PROXY}" \
    ALL_PROXY="${ALL_PROXY}" \
    NO_PROXY="${NO_PROXY}" \
    http_proxy="${HTTP_PROXY}" \
    https_proxy="${HTTPS_PROXY}" \
    all_proxy="${ALL_PROXY}" \
    no_proxy="${NO_PROXY}"
WORKDIR /srv/wxapp-checkin

# 运行时镜像只保留 nginx、证书和最小 shell 工具。
RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

# 说明：
# - nginx 监听容器内 89 端口，对外保持项目约束的唯一入口；
# - Rust 后端监听容器内 8080，只给 nginx 反代，不对宿主机暴露。
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/start.sh /usr/local/bin/wxapp-start
COPY --from=web-build /app/web/dist /usr/share/nginx/html
COPY --from=rust-build /app/backend-rust/target/release/wxapp-checkin-backend-rust /usr/local/bin/wxapp-checkin-backend-rust

RUN chmod +x /usr/local/bin/wxapp-start /usr/local/bin/wxapp-checkin-backend-rust

EXPOSE 89

CMD ["/usr/local/bin/wxapp-start"]
