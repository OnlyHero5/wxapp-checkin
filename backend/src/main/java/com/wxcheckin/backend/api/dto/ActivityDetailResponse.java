package com.wxcheckin.backend.api.dto;

/**
 * Response body for A-04 activity detail.
 */
public record ActivityDetailResponse(
    String status,
    String message,
    ActivityDetailDto data
) {
}
