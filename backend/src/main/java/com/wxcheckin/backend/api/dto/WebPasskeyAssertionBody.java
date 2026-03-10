package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public record WebPasskeyAssertionBody(
    @NotBlank(message = "client_data_json 不能为空")
    String clientDataJson,
    @NotBlank(message = "authenticator_data 不能为空")
    String authenticatorData,
    @NotBlank(message = "signature 不能为空")
    String signature,
    String userHandle
) {
}
