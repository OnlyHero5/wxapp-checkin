package com.wxcheckin.backend.api.dto;

public record WebUnbindReviewActionRequest(
    String sessionToken,
    String reviewComment
) {
}
