package com.wxcheckin.backend.api.dto;

public record WebUnbindReviewActionResponse(
    String status,
    String message,
    String reviewId,
    String reviewStatus
) {
}
