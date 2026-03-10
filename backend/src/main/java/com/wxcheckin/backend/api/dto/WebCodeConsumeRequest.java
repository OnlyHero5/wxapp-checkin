package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public record WebCodeConsumeRequest(
    String sessionToken,
    @NotBlank(message = "action_type 不能为空")
    String actionType,
    @NotBlank(message = "code 不能为空")
    String code
) {
}
