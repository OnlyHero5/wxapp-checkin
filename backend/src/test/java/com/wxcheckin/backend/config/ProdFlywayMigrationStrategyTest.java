package com.wxcheckin.backend.config;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

class ProdFlywayMigrationStrategyTest {

  @Test
  void shouldKeepProdFlywayStrategyAlignedWithRegisteredCountVersion() throws Exception {
    Path strategySource = Path.of(
        "src", "main", "java", "com", "wxcheckin", "backend", "config", "ProdFlywayMigrationStrategy.java");
    String source = Files.readString(strategySource, StandardCharsets.UTF_8);

    // 这里直接约束源码文本，是因为当前策略内部依赖 MySQL information_schema 细节；
    // 用 H2 模拟时会把失败原因扭曲成方言兼容问题，反而覆盖不到我们要守住的 prod 版本语义。
    assertTrue(source.contains("LATEST_VERSION = 12"), "prod Flyway 最新版本必须升级到 12。");
    assertTrue(source.contains("\"wx_activity_projection\", \"registered_count\""),
        "prod baseline 推断/校验必须识别 registered_count 所在的 V12。");
    assertTrue(source.contains("return 12;"), "prod baseline 推断必须能返回 12。");
  }

  @Test
  void shouldKeepProdSchemaResourcesAlignedForRegisteredCount() throws Exception {
    // 这条断言用来防回归：prod 迁移目录和 compose 首次启动 SQL 必须同时覆盖 registered_count。
    // 只修其中一处会让“新库初始化”和“已有库补迁移”再次出现版本错位。
    Path prodMigration = Path.of(
        "src", "main", "resources", "db", "migration_prod", "V12__add_registered_count_to_activity_projection.sql");
    Path bootstrapSchema = Path.of("scripts", "bootstrap-prod-schema.sql");

    assertTrue(Files.exists(prodMigration), "prod 迁移目录缺少 V12 registered_count 迁移。");

    String prodMigrationSql = Files.readString(prodMigration, StandardCharsets.UTF_8);
    String bootstrapSchemaSql = Files.readString(bootstrapSchema, StandardCharsets.UTF_8);

    assertTrue(prodMigrationSql.contains("registered_count"), "prod V12 迁移必须显式新增 registered_count。");
    assertTrue(bootstrapSchemaSql.contains("registered_count"), "compose 初始化 SQL 必须包含 registered_count。");
  }
}
