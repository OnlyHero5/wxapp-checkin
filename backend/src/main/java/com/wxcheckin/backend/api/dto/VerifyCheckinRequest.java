package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyCheckinRequest(
    @NotBlank(message = "session_token 不能为空")
    String sessionToken,
    String qrToken,
    String studentId,
    String name
) {
}
