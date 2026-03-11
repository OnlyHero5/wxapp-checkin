package com.wxcheckin.backend.api.dto;

import java.util.List;

public record WebActivityListResponse(
    String status,
    String message,
    List<ActivitySummaryDto> activities,
    Integer page,
    Integer pageSize,
    Boolean hasMore,
    Long serverTimeMs
) {
}
