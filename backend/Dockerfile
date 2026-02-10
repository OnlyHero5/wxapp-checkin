# syntax=docker/dockerfile:1.7

FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace

# Copy wrapper and dependency metadata first to maximize Docker cache hits.
COPY pom.xml mvnw mvnw.cmd ./
COPY .mvn .mvn
RUN chmod +x mvnw
RUN ./mvnw -q -DskipTests dependency:go-offline

COPY src src
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app

RUN useradd --system --uid 10001 --create-home appuser
COPY --from=build /workspace/target/backend-0.0.1-SNAPSHOT.jar /app/app.jar

ENV TZ=UTC
ENV JAVA_OPTS=""

EXPOSE 8080
USER appuser

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
