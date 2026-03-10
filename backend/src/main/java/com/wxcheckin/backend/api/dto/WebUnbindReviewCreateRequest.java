package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public record WebUnbindReviewCreateRequest(
    String sessionToken,
    @NotBlank(message = "reason 不能为空")
    String reason,
    String requestedNewBindingHint
) {
}
