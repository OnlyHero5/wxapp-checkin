package com.wxcheckin.backend.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class LegacyDatasourcePropertiesTest {

  @Test
  void shouldKeepExplicitLegacyJdbcUrlWhenConfigured() {
    AppProperties.LegacyDatasourceProperties properties = new AppProperties.LegacyDatasourceProperties();
    properties.setUrl("jdbc:mysql://legacy-db:4406/suda_union?useSSL=false");
    properties.setHost("legacy-db:3499");

    assertEquals(
        "jdbc:mysql://legacy-db:4406/suda_union?useSSL=false",
        properties.resolveJdbcUrl("mysql", "3306")
    );
  }

  @Test
  void shouldBuildLegacyJdbcUrlFromExternalHostThatIncludesPort() {
    AppProperties.LegacyDatasourceProperties properties = new AppProperties.LegacyDatasourceProperties();
    properties.setHost("legacy-db:3499");

    assertEquals(
        "jdbc:mysql://legacy-db:3499/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false",
        properties.resolveJdbcUrl("mysql", "3306")
    );
  }

  @Test
  void shouldBuildLegacyJdbcUrlFromExternalHostUsingDefaultMysqlPort() {
    AppProperties.LegacyDatasourceProperties properties = new AppProperties.LegacyDatasourceProperties();
    properties.setHost("legacy-db");

    assertEquals(
        "jdbc:mysql://legacy-db:3306/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false",
        properties.resolveJdbcUrl("mysql", "3307")
    );
  }

  @Test
  void shouldBuildLegacyJdbcUrlFromPrimaryDatabaseAddressInDemoMode() {
    AppProperties.LegacyDatasourceProperties properties = new AppProperties.LegacyDatasourceProperties();

    assertEquals(
        "jdbc:mysql://mysql:3307/suda_union?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false",
        properties.resolveJdbcUrl("mysql", "3307")
    );
  }
}
