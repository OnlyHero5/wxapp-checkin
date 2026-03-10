package com.wxcheckin.backend.api.dto;

public record WebBulkCheckoutResponse(
    String status,
    String message,
    String activityId,
    Integer affectedCount,
    String batchId,
    Long serverTimeMs
) {
}
