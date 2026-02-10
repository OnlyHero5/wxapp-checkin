package com.wxcheckin.backend.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.legacy.datasource.url=jdbc:h2:mem:legacydb;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "app.legacy.datasource.username=sa",
    "app.legacy.datasource.password=",
    "app.legacy.datasource.driver-class-name=org.h2.Driver"
})
class LegacyJdbcTemplateConfigTest {

  @Autowired
  @Qualifier("legacyJdbcTemplate")
  private JdbcTemplate legacyJdbcTemplate;

  @Test
  void shouldCreateDedicatedLegacyJdbcTemplateWhenConfigured() {
    Integer value = legacyJdbcTemplate.queryForObject("SELECT 1", Integer.class);
    assertEquals(1, value);
  }
}
