package com.wxcheckin.backend.config;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * 生产环境 Flyway 迁移策略（仅在 prod profile 生效）。
 *
 * <p>核心目标：
 * <ul>
 *   <li>新库（无表）：直接 migrate，从 V1 开始建表；</li>
 *   <li>老库（有表但无 flyway_schema_history）：自动推断 baseline 版本 → baseline → migrate；</li>
 *   <li>老库（已有 flyway_schema_history）：按 Flyway 默认逻辑 migrate。</li>
 * </ul>
 *
 * <p>为什么需要“推断 baseline”：
 * <ul>
 *   <li>历史上 prod profile 关闭了 Flyway，生产库可能通过手工 SQL 初始化，缺少 schema history；</li>
 *   <li>若直接开启 Flyway，遇到“非空 schema + 无历史”会拒绝启动；</li>
 *   <li>盲目 baseline 到 1 会导致后续 ALTER 迁移重复执行而失败（例如重复加列）。</li>
 * </ul>
 *
 * <p>注意：
 * <ul>
 *   <li>该策略只作用于扩展库（spring.datasource），不会对 legacy suda_union 做任何 schema 变更；</li>
 *   <li>当检测到 schema 处于“人工改库导致的不一致状态”时，会 fail-fast，要求运维先修复。</li>
 * </ul>
 */
@Configuration
@Profile("prod")
public class ProdFlywayMigrationStrategy {

  private static final Logger log = LoggerFactory.getLogger(ProdFlywayMigrationStrategy.class);

  private static final String HISTORY_TABLE = "flyway_schema_history";
  private static final String BASELINE_TABLE = "wx_user_auth_ext";
  // 维护约束：
  // 1. 这里必须和 `db/migration_prod` 的最新版本保持一致；
  // 2. 一旦 prod baseline 推断落后于真实 schema，baseline 后再 migrate 就会重复执行已存在的 ALTER。
  private static final int LATEST_VERSION = 12;

  private final DataSource dataSource;
  private final String baselineOverride;

  public ProdFlywayMigrationStrategy(
      DataSource dataSource,
      @Value("${WXAPP_FLYWAY_BASELINE_OVERRIDE:}") String baselineOverride
  ) {
    this.dataSource = dataSource;
    this.baselineOverride = baselineOverride;
  }

  @Bean
  public FlywayMigrationStrategy flywayMigrationStrategy() {
    return flyway -> {
      try (Connection connection = dataSource.getConnection()) {
        String schema = connection.getCatalog();
        if (isBlank(schema)) {
          // MySQL 通常会返回 catalog=数据库名；若为空，说明 JDBC URL 可能异常，直接交给 Flyway 报错更清晰。
          log.info("Flyway migrate without baseline inference (schema is blank).");
          flyway.migrate();
          return;
        }

        if (isSchemaEmpty(connection, schema)) {
          log.info("Flyway migrate (empty schema): {}", schema);
          flyway.migrate();
          return;
        }

        if (!tableExists(connection, schema, BASELINE_TABLE)) {
          throw new IllegalStateException(
              "检测到扩展库 schema 非空，但缺少核心表 " + BASELINE_TABLE
                  + "；请确认 DB_NAME 指向 wxcheckin_ext（或清理该库后再启动）。schema=" + schema);
        }

        if (tableExists(connection, schema, HISTORY_TABLE)) {
          log.info("Flyway migrate (schema history exists): {}", schema);
          flyway.migrate();
          return;
        }

        int inferred = inferBaselineVersion(connection, schema);
        int baselineVersion = inferred;
        if (!isBlank(baselineOverride)) {
          baselineVersion = parseOverride(baselineOverride);
          log.warn("Flyway baseline override enabled: {} (inferred={})", baselineVersion, inferred);
        }

        validateBaselineVersion(connection, schema, baselineVersion);

        log.info("Flyway baseline then migrate: schema={}, baselineVersion={}", schema, baselineVersion);
        Flyway baselineFlyway = Flyway.configure()
            .configuration(flyway.getConfiguration())
            .baselineOnMigrate(false)
            .baselineVersion(MigrationVersion.fromVersion(String.valueOf(baselineVersion)))
            .baselineDescription("wxapp-checkin auto baseline")
            .load();
        baselineFlyway.baseline();
        baselineFlyway.migrate();
      } catch (SQLException e) {
        throw new IllegalStateException("Flyway migration failed due to SQL error.", e);
      }
    };
  }

  private int inferBaselineVersion(Connection connection, String schema) throws SQLException {
    // 推断原则：从高到低检查“明确且稳定”的 schema 特征，命中即视为至少达到了该版本。
    // V12 增加了 wx_activity_projection.registered_count。
    // 这列会被 Hibernate 实体直接读取；若 prod baseline 仍停在 11，就会让 fresh schema 在启动后立即报 Unknown column。
    if (columnExists(connection, schema, "wx_activity_projection", "registered_count")) {
      return 12;
    }
    if (columnExists(connection, schema, "wx_sync_outbox", "retry_count")) {
      return 11;
    }
    if (indexExists(connection, schema, "wx_user_auth_ext", "idx_wx_user_auth_ext_legacy_user_id")) {
      return 10;
    }
    if (columnExists(connection, schema, "wx_user_auth_ext", "password_hash")) {
      return 9;
    }
    if (columnExists(connection, schema, "web_passkey_credential", "credential_public_key")) {
      return 8;
    }
    if (tableExists(connection, schema, "web_admin_audit_log")) {
      return 7;
    }
    if (tableExists(connection, schema, "web_unbind_review")) {
      return 6;
    }
    if (indexExists(connection, schema, "wx_qr_issue_log", "idx_wx_qr_issue_log_accept_expire_at")) {
      return 5;
    }
    if (columnExists(connection, schema, "wx_activity_projection", "end_time")) {
      return 4;
    }
    if (columnExists(connection, schema, "wx_activity_projection", "support_checkin")) {
      return 3;
    }
    if (tableExists(connection, schema, "wx_sync_outbox")) {
      return 2;
    }
    return 1;
  }

  private void validateBaselineVersion(Connection connection, String schema, int baselineVersion) throws SQLException {
    if (baselineVersion < 1 || baselineVersion > LATEST_VERSION) {
      throw new IllegalStateException(
          "Invalid baseline version: " + baselineVersion + " (expected 1.." + LATEST_VERSION + ").");
    }

    // 一致性校验：避免出现“后续版本特征存在，但前置表/列缺失”的非单调状态（通常是人工改库导致）。
    requireTable(connection, schema, "wx_user_auth_ext", baselineVersion);
    requireTable(connection, schema, "wx_activity_projection", baselineVersion);

    if (baselineVersion >= 2) {
      requireTable(connection, schema, "wx_sync_outbox", baselineVersion);
    }
    if (baselineVersion >= 3) {
      requireColumn(connection, schema, "wx_activity_projection", "support_checkin", baselineVersion);
    }
    if (baselineVersion >= 4) {
      requireColumn(connection, schema, "wx_activity_projection", "end_time", baselineVersion);
    }
    if (baselineVersion >= 5) {
      requireIndex(connection, schema, "wx_qr_issue_log", "idx_wx_qr_issue_log_accept_expire_at", baselineVersion);
    }
    if (baselineVersion >= 6) {
      requireTable(connection, schema, "web_unbind_review", baselineVersion);
    }
    if (baselineVersion >= 7) {
      requireTable(connection, schema, "web_admin_audit_log", baselineVersion);
    }
    if (baselineVersion >= 8) {
      requireColumn(connection, schema, "web_passkey_credential", "credential_public_key", baselineVersion);
    }
    if (baselineVersion >= 9) {
      requireColumn(connection, schema, "wx_user_auth_ext", "password_hash", baselineVersion);
    }
    if (baselineVersion >= 10) {
      requireIndex(connection, schema, "wx_user_auth_ext", "idx_wx_user_auth_ext_legacy_user_id", baselineVersion);
    }
    if (baselineVersion >= 11) {
      requireColumn(connection, schema, "wx_sync_outbox", "retry_count", baselineVersion);
    }
    if (baselineVersion >= 12) {
      requireColumn(connection, schema, "wx_activity_projection", "registered_count", baselineVersion);
    }
  }

  private void requireTable(Connection connection, String schema, String table, int baselineVersion)
      throws SQLException {
    if (!tableExists(connection, schema, table)) {
      throw inconsistentSchema(schema, "missing table: " + table, baselineVersion);
    }
  }

  private void requireColumn(Connection connection, String schema, String table, String column, int baselineVersion)
      throws SQLException {
    if (!columnExists(connection, schema, table, column)) {
      throw inconsistentSchema(schema, "missing column: " + table + "." + column, baselineVersion);
    }
  }

  private void requireIndex(Connection connection, String schema, String table, String index, int baselineVersion)
      throws SQLException {
    if (!indexExists(connection, schema, table, index)) {
      throw inconsistentSchema(schema, "missing index: " + table + "." + index, baselineVersion);
    }
  }

  private IllegalStateException inconsistentSchema(String schema, String detail, int baselineVersion) {
    return new IllegalStateException(
        "检测到扩展库 schema 与推断 baseline 版本不一致（" + detail + "）。"
            + "这通常表示该库经过人工改动或部分脚本执行。"
            + "请先修复/备份后重建，或设置 WXAPP_FLYWAY_BASELINE_OVERRIDE 强制 baseline。"
            + " schema=" + schema + ", baselineVersion=" + baselineVersion);
  }

  private boolean isSchemaEmpty(Connection connection, String schema) throws SQLException {
    String sql = """
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
        """;
    long count = queryCount(connection, sql, schema);
    return count == 0;
  }

  private boolean tableExists(Connection connection, String schema, String table) throws SQLException {
    String sql = """
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_name = ?
        """;
    return queryCount(connection, sql, schema, table) > 0;
  }

  private boolean columnExists(Connection connection, String schema, String table, String column) throws SQLException {
    String sql = """
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = ?
          AND table_name = ?
          AND column_name = ?
        """;
    return queryCount(connection, sql, schema, table, column) > 0;
  }

  private boolean indexExists(Connection connection, String schema, String table, String index) throws SQLException {
    String sql = """
        SELECT COUNT(*)
        FROM information_schema.statistics
        WHERE table_schema = ?
          AND table_name = ?
          AND index_name = ?
        """;
    return queryCount(connection, sql, schema, table, index) > 0;
  }

  private long queryCount(Connection connection, String sql, String... args) throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement(sql)) {
      for (int i = 0; i < args.length; i++) {
        statement.setString(i + 1, args[i]);
      }
      try (ResultSet rs = statement.executeQuery()) {
        if (!rs.next()) {
          return 0;
        }
        return rs.getLong(1);
      }
    }
  }

  private int parseOverride(String value) {
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException e) {
      throw new IllegalStateException("WXAPP_FLYWAY_BASELINE_OVERRIDE must be an integer.", e);
    }
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
