package com.wxcheckin.backend.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record WebPasskeyAssertionResponse(
    @NotBlank(message = "id 不能为空")
    String id,
    @NotBlank(message = "raw_id 不能为空")
    String rawId,
    @NotBlank(message = "type 不能为空")
    String type,
    @Valid
    @NotNull(message = "response 不能为空")
    WebPasskeyAssertionBody response
) {
}
