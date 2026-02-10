package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for A-06 checkin/checkout consume.
 */
public record ConsumeCheckinRequest(
    @NotBlank(message = "session_token 不能为空")
    String sessionToken,
    String qrPayload,
    String scanType,
    String rawResult,
    String path,
    String activityId,
    String actionType,
    Long slot,
    String nonce
) {
}
