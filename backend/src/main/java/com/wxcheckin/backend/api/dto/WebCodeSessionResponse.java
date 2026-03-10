package com.wxcheckin.backend.api.dto;

public record WebCodeSessionResponse(
    String status,
    String message,
    String activityId,
    String actionType,
    String code,
    Long slot,
    Long expiresAt,
    Long expiresInMs,
    Long serverTimeMs,
    Integer checkinCount,
    Integer checkoutCount
) {
}
