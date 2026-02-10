package com.wxcheckin.backend.api.dto;

/**
 * Response body for A-05 QR ticket issuance.
 */
public record CreateQrSessionResponse(
    String status,
    String message,
    String activityId,
    String actionType,
    String qrPayload,
    Long slot,
    String nonce,
    Integer rotateSeconds,
    Integer graceSeconds,
    Long displayExpireAt,
    Long acceptExpireAt,
    Long serverTime
) {
}
