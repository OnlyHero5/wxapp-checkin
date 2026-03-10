package com.wxcheckin.backend.api.dto;

public record WebUnbindReviewCreateResponse(
    String status,
    String message,
    String reviewId,
    String reviewStatus,
    Long submittedAt
) {
}
