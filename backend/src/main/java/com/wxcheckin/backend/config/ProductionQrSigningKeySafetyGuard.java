package com.wxcheckin.backend.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Production safety checks for QR signing configuration.
 */
@Component
public class ProductionQrSigningKeySafetyGuard {

  static final String DEFAULT_PLACEHOLDER = "replace-with-a-strong-server-side-secret";

  private final Environment environment;
  private final AppProperties appProperties;

  public ProductionQrSigningKeySafetyGuard(Environment environment, AppProperties appProperties) {
    this.environment = environment;
    this.appProperties = appProperties;
  }

  @PostConstruct
  public void validateOnStartup() {
    boolean prodProfile = Arrays.stream(environment.getActiveProfiles())
        .anyMatch("prod"::equalsIgnoreCase);
    validateProdConfiguration(prodProfile, appProperties.getQr().getSigningKey());
  }

  static void validateProdConfiguration(boolean prodProfile, String signingKey) {
    if (!prodProfile) {
      return;
    }
    if (isBlank(signingKey)) {
      throw new IllegalStateException("生产环境必须配置 QR_SIGNING_KEY（app.qr.signing-key），用于二维码验签。");
    }
    if (DEFAULT_PLACEHOLDER.equals(signingKey.trim())) {
      throw new IllegalStateException("生产环境禁止使用默认 QR_SIGNING_KEY 占位符；请设置强随机密钥。");
    }
  }

  private static boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}

