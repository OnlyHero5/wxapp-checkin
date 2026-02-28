package com.wxcheckin.backend.config;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class ProductionQrSigningKeySafetyGuardTest {

  @Test
  void shouldRejectBlankSigningKeyInProd() {
    assertThrows(
        IllegalStateException.class,
        () -> ProductionQrSigningKeySafetyGuard.validateProdConfiguration(true, "   ")
    );
  }

  @Test
  void shouldRejectDefaultSigningKeyInProd() {
    assertThrows(
        IllegalStateException.class,
        () -> ProductionQrSigningKeySafetyGuard.validateProdConfiguration(
            true,
            "replace-with-a-strong-server-side-secret"
        )
    );
  }

  @Test
  void shouldAllowCustomSigningKeyInProd() {
    assertDoesNotThrow(
        () -> ProductionQrSigningKeySafetyGuard.validateProdConfiguration(true, "a-very-strong-and-private-key")
    );
  }

  @Test
  void shouldSkipValidationOutsideProd() {
    assertDoesNotThrow(
        () -> ProductionQrSigningKeySafetyGuard.validateProdConfiguration(
            false,
            "replace-with-a-strong-server-side-secret"
        )
    );
  }
}

