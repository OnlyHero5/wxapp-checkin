package com.wxcheckin.backend.application.support;

import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Component;

/**
 * Cryptographically strong token/nonce generator.
 */
@Component
public class TokenGenerator {
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  public String newSessionToken() {
    return "sess_" + randomUrlSafe(32);
  }

  public String newNonce() {
    return randomUrlSafe(16);
  }

  public String newRecordId() {
    return "rec_" + randomUrlSafe(18);
  }

  private String randomUrlSafe(int bytes) {
    byte[] seed = new byte[bytes];
    SECURE_RANDOM.nextBytes(seed);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(seed);
  }
}
