package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.RegisterRequest;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

/**
 * Verifies register payload integrity envelope and blocks replay submissions.
 */
@Service
public class RegisterPayloadIntegrityService {

  private static final String SIGN_ALGORITHM = "HMAC-SHA256";
  private static final String HMAC_ALGORITHM = "HmacSHA256";
  private static final String SIGN_VERSION = "v1";
  private static final String INVALID_SIGNATURE_CODE = "invalid_payload_signature";
  private static final String REPLAY_CODE = "payload_replay";
  private static final String INVALID_SIGNATURE_MESSAGE = "注册请求签名校验失败，请重试";
  private static final String REPLAY_MESSAGE = "注册请求重复提交，请稍后重试";

  private final AppProperties appProperties;
  private final JsonCodec jsonCodec;
  private final ConcurrentHashMap<String, Long> nonceCache = new ConcurrentHashMap<>();
  private final Object nonceLock = new Object();

  public RegisterPayloadIntegrityService(AppProperties appProperties, JsonCodec jsonCodec) {
    this.appProperties = appProperties;
    this.jsonCodec = jsonCodec;
  }

  public void verify(RegisterRequest request) {
    AppProperties.RegisterPayloadProperties props = appProperties.getSecurity().getRegisterPayload();
    if (!props.isEnabled()) {
      return;
    }

    String sessionToken = normalize(request.sessionToken());
    String envelopeBase64 = normalize(request.payloadEncrypted());
    if (sessionToken.isBlank() || envelopeBase64.isBlank()) {
      throw invalidSignature();
    }

    Map<String, Object> envelope = parseEnvelope(envelopeBase64);
    String algorithm = normalize(envelope.get("alg"));
    String nonce = normalize(envelope.get("nonce"));
    String bodyBase64 = normalize(envelope.get("body"));
    String signature = normalize(envelope.get("sig")).toLowerCase();
    long timestamp = toLong(envelope.get("ts"));
    String version = normalizeVersion(envelope.get("v"));

    if (!SIGN_ALGORITHM.equalsIgnoreCase(algorithm)
        || nonce.isBlank()
        || bodyBase64.isBlank()
        || signature.isBlank()
        || timestamp <= 0
        || !SIGN_VERSION.equals(version)) {
      throw invalidSignature();
    }

    long nowMs = Instant.now().toEpochMilli();
    long maxSkewMs = Math.max(5, props.getMaxSkewSeconds()) * 1000;
    if (Math.abs(nowMs - timestamp) > maxSkewMs) {
      throw invalidSignature();
    }

    String signText = "%s.%d.%s.%s".formatted(SIGN_VERSION, timestamp, nonce, bodyBase64);
    String expectedSignature = hmacHex(sessionToken, signText).toLowerCase();
    if (!constantTimeEquals(expectedSignature, signature)) {
      throw invalidSignature();
    }

    Map<String, Object> payload = parseEnvelope(bodyBase64);
    if (!payloadMatchesRequest(payload, request)) {
      throw invalidSignature();
    }

    long nonceExpireAt = nowMs + Math.max(30, props.getNonceTtlSeconds()) * 1000;
    if (!reserveNonce(sessionToken, nonce, nowMs, nonceExpireAt)) {
      throw new BusinessException(REPLAY_CODE, REPLAY_MESSAGE);
    }
  }

  private boolean payloadMatchesRequest(Map<String, Object> payload, RegisterRequest request) {
    if (payload.isEmpty()) {
      return false;
    }
    return normalize(payload.get("student_id")).equals(normalize(request.studentId()))
        && normalize(payload.get("name")).equals(normalize(request.name()))
        && normalize(payload.get("department")).equals(normalize(request.department()))
        && normalize(payload.get("club")).equals(normalize(request.club()));
  }

  private boolean reserveNonce(String sessionToken, String nonce, long nowMs, long expireAtMs) {
    String key = sessionToken + "::" + nonce;
    synchronized (nonceLock) {
      cleanupExpiredNonces(nowMs);
      Long existingExpireAt = nonceCache.get(key);
      if (existingExpireAt != null && existingExpireAt >= nowMs) {
        return false;
      }
      nonceCache.put(key, expireAtMs);
      return true;
    }
  }

  private void cleanupExpiredNonces(long nowMs) {
    nonceCache.entrySet().removeIf((entry) -> entry.getValue() == null || entry.getValue() < nowMs);
  }

  private Map<String, Object> parseEnvelope(String base64Text) {
    try {
      byte[] decoded = Base64.getDecoder().decode(base64Text);
      String json = new String(decoded, StandardCharsets.UTF_8);
      return jsonCodec.readMap(json);
    } catch (IllegalArgumentException ex) {
      throw invalidSignature();
    }
  }

  private String hmacHex(String key, String plainText) {
    try {
      Mac mac = Mac.getInstance(HMAC_ALGORITHM);
      SecretKeySpec keySpec = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM);
      mac.init(keySpec);
      byte[] digest = mac.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
      StringBuilder builder = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        String hex = Integer.toHexString(b & 0xff);
        if (hex.length() == 1) {
          builder.append('0');
        }
        builder.append(hex);
      }
      return builder.toString();
    } catch (Exception ex) {
      throw new IllegalStateException("Cannot verify register payload signature", ex);
    }
  }

  private boolean constantTimeEquals(String left, String right) {
    if (left == null || right == null) {
      return false;
    }
    return MessageDigest.isEqual(
        left.getBytes(StandardCharsets.UTF_8),
        right.getBytes(StandardCharsets.UTF_8)
    );
  }

  private long toLong(Object value) {
    if (value instanceof Number number) {
      return number.longValue();
    }
    String text = normalize(value);
    if (text.isBlank()) {
      return 0;
    }
    try {
      return Long.parseLong(text);
    } catch (NumberFormatException ex) {
      return 0;
    }
  }

  private String normalizeVersion(Object value) {
    if (value instanceof Number number) {
      return "v" + number.longValue();
    }
    String text = normalize(value).toLowerCase();
    if (text.isBlank()) {
      return "";
    }
    if (text.startsWith("v")) {
      return text;
    }
    return "v" + text;
  }

  private String normalize(Object value) {
    return value == null ? "" : value.toString().trim();
  }

  private BusinessException invalidSignature() {
    return new BusinessException(INVALID_SIGNATURE_CODE, INVALID_SIGNATURE_MESSAGE);
  }
}
