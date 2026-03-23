# syntax=docker/dockerfile:1.7

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace

# Copy wrapper and dependency metadata first to maximize Docker cache hits.
COPY pom.xml mvnw mvnw.cmd ./
COPY .mvn .mvn
RUN chmod +x mvnw

COPY src src
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app

RUN useradd --system --uid 10001 --create-home appuser
RUN apt-get update \
  # 运行时镜像除了健康检查用的 curl，还要具备最小依赖探测能力；
  # 这样容器能在 Spring Boot 启动前，先对数据库和 Redis 做友好预检。
  && apt-get install -y --no-install-recommends curl default-mysql-client redis-tools \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /workspace/target/backend-0.0.1-SNAPSHOT.jar /app/app.jar
COPY scripts/docker-preflight.sh /app/docker-preflight.sh
RUN chmod +x /app/docker-preflight.sh

ENV TZ=UTC
ENV JAVA_OPTS=""

EXPOSE 8080
USER appuser

# 入口顺序固定为“预检 -> Java 主进程”，
# 避免环境错误被 Spring / Flyway / Hibernate 的启动日志淹没。
ENTRYPOINT ["sh", "-c", "/app/docker-preflight.sh && exec java $JAVA_OPTS -jar /app/app.jar"]
