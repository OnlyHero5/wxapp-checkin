package com.wxcheckin.backend.api.dto;

import java.util.List;

/**
 * Response body for A-03 activity list.
 */
public record ActivityListResponse(
    String status,
    String message,
    List<ActivitySummaryDto> activities
) {
}
