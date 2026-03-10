package com.wxcheckin.backend.api.dto;

public record WebUnbindReviewItemDto(
    String reviewId,
    String status,
    String userName,
    String studentId,
    String reason,
    String requestedNewBindingHint,
    String reviewComment,
    String reviewerName,
    String submittedAt
) {
}
