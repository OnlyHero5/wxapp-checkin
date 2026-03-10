package com.wxcheckin.backend.api.dto;

import java.util.List;

public record WebUnbindReviewListResponse(
    String status,
    String message,
    List<WebUnbindReviewItemDto> items
) {
}
