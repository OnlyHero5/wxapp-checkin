package com.wxcheckin.backend.application.support;

import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.ActionType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Produces and verifies a signed nonce carried inside the QR payload.
 *
 * <p>We keep the overall QR payload shape unchanged:
 * {@code wxcheckin:v1:<activity_id>:<action_type>:<slot>:<nonce>}.
 *
 * <p>To avoid breaking existing parsing contracts, we embed the signature inside the nonce:
 * nonce = randomPart(16B base64url, 22 chars) + sigPart(HMAC-SHA256, 32B base64url, 43 chars).
 *
 * <p>This makes the QR payload tamper-evident without requiring {@code wx_qr_issue_log} for validation.
 */
@Component
public class QrNonceSigner {

  static final int RANDOM_PART_LEN = 22;
  static final int SIG_PART_LEN = 43;
  static final int SIGNED_NONCE_LEN = RANDOM_PART_LEN + SIG_PART_LEN;

  private final SecretKeySpec keySpec;

  @Autowired
  public QrNonceSigner(AppProperties appProperties) {
    this(appProperties.getQr().getSigningKey());
  }

  // Visible for tests
  QrNonceSigner(String signingKey) {
    String key = signingKey == null ? "" : signingKey;
    this.keySpec = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
  }

  public boolean isSigned(String nonce) {
    return nonce != null && nonce.trim().length() == SIGNED_NONCE_LEN;
  }

  /**
   * @param randomPart should be a base64url string of length 22 (TokenGenerator.newNonce()).
   */
  public String sign(String activityId, ActionType actionType, long slot, String randomPart) {
    String act = normalize(activityId);
    if (act.isEmpty() || actionType == null) {
      throw new IllegalArgumentException("activityId/actionType required");
    }
    String rnd = normalize(randomPart);
    if (rnd.length() != RANDOM_PART_LEN) {
      throw new IllegalArgumentException("randomPart must be 22 chars (base64url of 16 bytes)");
    }
    String sig = computeSig(act, actionType, slot, rnd);
    return rnd + sig;
  }

  public boolean verify(String activityId, ActionType actionType, long slot, String nonce) {
    if (!isSigned(nonce)) {
      return false;
    }
    String act = normalize(activityId);
    if (act.isEmpty() || actionType == null) {
      return false;
    }
    String text = nonce.trim();
    String rnd = text.substring(0, RANDOM_PART_LEN);
    String sig = text.substring(RANDOM_PART_LEN);
    String expected = computeSig(act, actionType, slot, rnd);
    return MessageDigest.isEqual(
        expected.getBytes(StandardCharsets.UTF_8),
        sig.getBytes(StandardCharsets.UTF_8)
    );
  }

  private String computeSig(String activityId, ActionType actionType, long slot, String randomPart) {
    // Stable, explicit canonical form to prevent ambiguity.
    String msg = "wxcheckin:v1|%s|%s|%d|%s".formatted(activityId, actionType.getCode(), slot, randomPart);
    byte[] digest = hmacSha256(msg.getBytes(StandardCharsets.UTF_8));
    return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
  }

  private byte[] hmacSha256(byte[] message) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(keySpec);
      return mac.doFinal(message);
    } catch (Exception ex) {
      // Should never happen in a normal JRE; treat as fatal misconfiguration.
      throw new IllegalStateException("HMAC initialization failed", ex);
    }
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }
}
