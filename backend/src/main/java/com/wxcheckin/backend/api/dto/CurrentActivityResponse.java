package com.wxcheckin.backend.api.dto;

public record CurrentActivityResponse(
    String status,
    String message,
    ActivitySummaryDto activity
) {
}
