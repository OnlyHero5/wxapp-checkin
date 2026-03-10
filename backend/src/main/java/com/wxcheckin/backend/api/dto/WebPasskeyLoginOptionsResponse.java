package com.wxcheckin.backend.api.dto;

import java.util.Map;

public record WebPasskeyLoginOptionsResponse(
    String status,
    String message,
    String requestId,
    Long challengeExpiresAt,
    Map<String, Object> publicKeyOptions,
    String rpId
) {
}
