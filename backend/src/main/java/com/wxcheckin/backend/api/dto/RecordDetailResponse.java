package com.wxcheckin.backend.api.dto;

public record RecordDetailResponse(
    String status,
    String message,
    String recordId,
    String time,
    String location,
    String activityTitle,
    String description,
    String actionType
) {
}
