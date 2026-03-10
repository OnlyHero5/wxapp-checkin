package com.wxcheckin.backend.api.dto;

import java.util.Map;

public record WebPasskeyRegisterOptionsResponse(
    String status,
    String message,
    String requestId,
    Long challengeExpiresAt,
    Map<String, Object> publicKeyOptions,
    String rpId,
    String rpName,
    String userHandle
) {
}
