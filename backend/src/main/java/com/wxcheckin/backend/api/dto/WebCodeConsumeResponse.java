package com.wxcheckin.backend.api.dto;

public record WebCodeConsumeResponse(
    String status,
    String message,
    String actionType,
    String activityId,
    String activityTitle,
    String recordId,
    Long serverTimeMs
) {
}
