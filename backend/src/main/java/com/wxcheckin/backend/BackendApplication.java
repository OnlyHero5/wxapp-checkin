package com.wxcheckin.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Backend entrypoint for the WeChat check-in platform.
 *
 * <p>The service is intentionally implemented as a modular monolith so that
 * business rules stay transactional while still being open for extension via
 * clear module boundaries and outbox-based integration points.</p>
 */
@EnableScheduling
@SpringBootApplication
public class BackendApplication {

  public static void main(String[] args) {
    SpringApplication.run(BackendApplication.class, args);
  }

}
