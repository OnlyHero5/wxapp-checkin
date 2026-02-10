package com.wxcheckin.backend.config;

import java.time.Clock;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Lightweight infrastructure bean configuration.
 */
@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class AppConfiguration {

  @Bean
  public Clock clock() {
    return Clock.systemUTC();
  }

  @Bean
  public RestClient restClient(RestClient.Builder builder) {
    return builder.build();
  }
}
