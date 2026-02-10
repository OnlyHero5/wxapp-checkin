package com.wxcheckin.backend.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ProductionDatabaseSafetyGuardTest {

  @Test
  void shouldRejectUsingSudaUnionAsPrimarySchemaInProd() {
    assertThrows(
        IllegalStateException.class,
        () -> ProductionDatabaseSafetyGuard.validateProdConfiguration(
            true,
            "jdbc:mysql://127.0.0.1:3306/suda_union?useSSL=false",
            "jdbc:mysql://127.0.0.1:3306/suda_union?useSSL=false",
            true,
            true
        )
    );
  }

  @Test
  void shouldRejectDisabledSyncInProd() {
    assertThrows(
        IllegalStateException.class,
        () -> ProductionDatabaseSafetyGuard.validateProdConfiguration(
            true,
            "jdbc:mysql://127.0.0.1:3306/wxcheckin_ext?useSSL=false",
            "jdbc:mysql://127.0.0.1:3306/suda_union?useSSL=false",
            false,
            true
        )
    );
  }

  @Test
  void shouldAllowDedicatedSchemasAndEnabledSyncInProd() {
    assertDoesNotThrow(
        () -> ProductionDatabaseSafetyGuard.validateProdConfiguration(
            true,
            "jdbc:mysql://127.0.0.1:3306/wxcheckin_ext?useSSL=false",
            "jdbc:mysql://127.0.0.1:3306/suda_union?useSSL=false",
            true,
            true
        )
    );
  }
}
