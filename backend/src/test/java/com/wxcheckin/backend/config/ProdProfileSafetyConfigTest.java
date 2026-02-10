package com.wxcheckin.backend.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("prod")
@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:prodtest;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.data.redis.repositories.enabled=false",
    "spring.task.scheduling.enabled=false"
})
class ProdProfileSafetyConfigTest {

  @Autowired
  private Environment environment;

  @Test
  void shouldDisableSchemaMutationInProdProfile() {
    assertEquals("none", environment.getProperty("spring.jpa.hibernate.ddl-auto"));
    assertEquals("false", environment.getProperty("spring.flyway.enabled"));
  }
}
