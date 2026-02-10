package com.wxcheckin.backend.application.support;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.domain.model.ActionType;
import org.junit.jupiter.api.Test;

class QrPayloadCodecTest {

  private final QrPayloadCodec codec = new QrPayloadCodec();

  @Test
  void shouldEncodeAndParsePayload() {
    String payload = codec.encode("act_demo_001", ActionType.CHECKIN, 101L, "nonceTokenA1");
    var parsed = codec.parse(payload);
    assertEquals("act_demo_001", parsed.activityId());
    assertEquals(ActionType.CHECKIN, parsed.actionType());
    assertEquals(101L, parsed.slot());
    assertEquals("nonceTokenA1", parsed.nonce());
  }

  @Test
  void shouldRejectInvalidPayload() {
    BusinessException ex = assertThrows(BusinessException.class, () -> codec.parse("bad-payload"));
    assertEquals("invalid_qr", ex.getStatus());
  }
}
