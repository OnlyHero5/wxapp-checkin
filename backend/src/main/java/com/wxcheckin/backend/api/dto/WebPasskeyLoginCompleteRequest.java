package com.wxcheckin.backend.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record WebPasskeyLoginCompleteRequest(
    @NotBlank(message = "request_id 不能为空")
    String requestId,
    @Valid
    @NotNull(message = "assertion_response 不能为空")
    WebPasskeyAssertionResponse assertionResponse
) {
}
