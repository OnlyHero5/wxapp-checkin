package com.wxcheckin.backend.application.support;

import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.ParsedQrPayload;
import com.wxcheckin.backend.domain.model.ActionType;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Encodes and parses QR payload strings.
 *
 * <p>Contract payload shape: {@code wxcheckin:v1:<activity_id>:<action_type>:<slot>:<nonce>}.</p>
 */
@Component
public class QrPayloadCodec {
  private static final Pattern ACTIVITY_PATTERN = Pattern.compile("^[0-9A-Za-z:_\\-]{1,64}$");
  private static final Pattern NONCE_PATTERN = Pattern.compile("^[0-9A-Za-z_\\-=]{8,128}$");

  public String encode(String activityId, ActionType actionType, long slot, String nonce) {
    return "wxcheckin:v1:%s:%s:%d:%s".formatted(activityId, actionType.getCode(), slot, nonce);
  }

  public ParsedQrPayload parse(String payload) {
    String text = payload == null ? "" : payload.trim();
    String[] parts = text.split(":");
    if (parts.length != 6) {
      throw new BusinessException("invalid_qr", "二维码无法识别，请重新扫码");
    }
    if (!"wxcheckin".equals(parts[0]) || !"v1".equals(parts[1])) {
      throw new BusinessException("invalid_qr", "二维码无法识别，请重新扫码");
    }

    String activityId = parts[2];
    ActionType actionType = ActionType.fromCode(parts[3]);
    long slot;
    try {
      slot = Long.parseLong(parts[4]);
    } catch (NumberFormatException ex) {
      throw new BusinessException("invalid_qr", "二维码时间异常，请重新扫码");
    }
    String nonce = parts[5];

    if (!ACTIVITY_PATTERN.matcher(activityId).matches() || actionType == null || slot < 0
        || !NONCE_PATTERN.matcher(nonce).matches()) {
      throw new BusinessException("invalid_qr", "二维码无法识别，请重新扫码");
    }
    return new ParsedQrPayload(text, activityId, actionType, slot, nonce);
  }
}
