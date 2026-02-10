package com.wxcheckin.backend.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Production safety checks for dual-schema deployment.
 */
@Component
public class ProductionDatabaseSafetyGuard {

  private static final String SUDA_SCHEMA = "suda_union";

  private final Environment environment;
  private final AppProperties appProperties;
  private final String primaryDatasourceUrl;

  public ProductionDatabaseSafetyGuard(
      Environment environment,
      AppProperties appProperties,
      @Value("${spring.datasource.url:}") String primaryDatasourceUrl
  ) {
    this.environment = environment;
    this.appProperties = appProperties;
    this.primaryDatasourceUrl = primaryDatasourceUrl;
  }

  @PostConstruct
  public void validateOnStartup() {
    boolean prodProfile = Arrays.stream(environment.getActiveProfiles())
        .anyMatch("prod"::equalsIgnoreCase);
    validateProdConfiguration(
        prodProfile,
        primaryDatasourceUrl,
        appProperties.getLegacy().getDatasource().getUrl(),
        appProperties.getSync().getLegacy().isEnabled(),
        appProperties.getSync().getOutbox().isEnabled()
    );
  }

  static void validateProdConfiguration(
      boolean prodProfile,
      String primaryDatasourceUrl,
      String legacyDatasourceUrl,
      boolean legacySyncEnabled,
      boolean outboxRelayEnabled
  ) {
    if (!prodProfile) {
      return;
    }
    if (containsSchema(primaryDatasourceUrl, SUDA_SCHEMA)) {
      throw new IllegalStateException("生产环境禁止将主数据源指向 suda_union；请使用独立扩展库。");
    }
    if (isBlank(legacyDatasourceUrl)) {
      throw new IllegalStateException("生产环境必须配置 LEGACY_DB_URL 指向 suda_union。");
    }
    if (!containsSchema(legacyDatasourceUrl, SUDA_SCHEMA)) {
      throw new IllegalStateException("LEGACY_DB_URL 必须指向 suda_union 库。");
    }
    if (!legacySyncEnabled || !outboxRelayEnabled) {
      throw new IllegalStateException("生产环境必须开启双向同步（LEGACY_SYNC_ENABLED=true, OUTBOX_RELAY_ENABLED=true）。");
    }
  }

  private static boolean containsSchema(String jdbcUrl, String schema) {
    if (isBlank(jdbcUrl)) {
      return false;
    }
    String normalized = jdbcUrl.toLowerCase(Locale.ROOT);
    String marker = "/" + schema.toLowerCase(Locale.ROOT);
    int index = normalized.indexOf(marker);
    if (index < 0) {
      return false;
    }
    int after = index + marker.length();
    return after >= normalized.length() || normalized.charAt(after) == '?';
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
