package com.wxcheckin.backend.config;

import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

@Configuration
public class LegacyJdbcTemplateConfiguration {

  private static final Logger log = LoggerFactory.getLogger(LegacyJdbcTemplateConfiguration.class);

  @Bean(name = "legacyJdbcTemplate")
  public JdbcTemplate legacyJdbcTemplate(DataSource primaryDataSource, AppProperties appProperties) {
    AppProperties.LegacyDatasourceProperties legacyDatasource = appProperties.getLegacy().getDatasource();
    if (isBlank(legacyDatasource.getUrl())) {
      log.info("Cross-system JDBC uses primary datasource (LEGACY_DB_URL is empty).");
      return new JdbcTemplate(primaryDataSource);
    }

    DriverManagerDataSource dedicatedDataSource = new DriverManagerDataSource();
    dedicatedDataSource.setDriverClassName(legacyDatasource.getDriverClassName());
    dedicatedDataSource.setUrl(legacyDatasource.getUrl());
    dedicatedDataSource.setUsername(legacyDatasource.getUsername());
    dedicatedDataSource.setPassword(legacyDatasource.getPassword());
    log.info("Cross-system JDBC uses dedicated datasource: {}", safeUrl(legacyDatasource.getUrl()));
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
