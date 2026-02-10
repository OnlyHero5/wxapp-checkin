package com.wxcheckin.backend.api.dto;

/**
 * Record item for compatibility endpoints.
 */
public record RecordItemDto(
    String recordId,
    String time,
    String location,
    String activityTitle,
    String description
) {
}
