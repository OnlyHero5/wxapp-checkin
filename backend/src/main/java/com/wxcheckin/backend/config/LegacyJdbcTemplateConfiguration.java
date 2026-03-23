package com.wxcheckin.backend.config;

import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

@Configuration
public class LegacyJdbcTemplateConfiguration {

  private static final Logger log = LoggerFactory.getLogger(LegacyJdbcTemplateConfiguration.class);

  @Bean(name = "legacyJdbcTemplate")
  public JdbcTemplate legacyJdbcTemplate(
      DataSource primaryDataSource,
      AppProperties appProperties,
      @Value("${DB_HOST:127.0.0.1}") String fallbackLegacyHost,
      @Value("${DB_PORT:3306}") String fallbackLegacyPort
  ) {
    AppProperties.LegacyDatasourceProperties legacyDatasource = appProperties.getLegacy().getDatasource();
    String resolvedLegacyUrl = legacyDatasource.resolveJdbcUrl(fallbackLegacyHost, fallbackLegacyPort);

    // 非 prod 场景仍允许 legacy URL 为空并回退到主数据源；
    // 只有 prod profile 才会通过 application-prod.yml 把 legacy 地址补齐。
    if (isBlank(resolvedLegacyUrl)) {
      log.info("Cross-system JDBC uses primary datasource (legacy dedicated datasource is not configured).");
      return new JdbcTemplate(primaryDataSource);
    }

    DriverManagerDataSource dedicatedDataSource = new DriverManagerDataSource();
    dedicatedDataSource.setDriverClassName(legacyDatasource.getDriverClassName());
    dedicatedDataSource.setUrl(resolvedLegacyUrl);
    dedicatedDataSource.setUsername(legacyDatasource.getUsername());
    dedicatedDataSource.setPassword(legacyDatasource.getPassword());
    log.info("Cross-system JDBC uses dedicated datasource: {}", safeUrl(resolvedLegacyUrl));
    return new JdbcTemplate(dedicatedDataSource);
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }

  private String safeUrl(String jdbcUrl) {
    int queryIndex = jdbcUrl.indexOf('?');
    return queryIndex >= 0 ? jdbcUrl.substring(0, queryIndex) : jdbcUrl;
  }
}
