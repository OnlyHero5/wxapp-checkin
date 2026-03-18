package com.wxcheckin.backend.api.dto;

/**
 * 管理员名单修正结果响应。
 */
public record WebAttendanceAdjustmentResponse(
    String status,
    String message,
    String activityId,
    Integer affectedCount,
    String batchId,
    Long serverTimeMs
) {
}
