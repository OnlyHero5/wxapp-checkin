package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public record WebPasskeyCredentialBody(
    @NotBlank(message = "client_data_json 不能为空")
    String clientDataJson,
    @NotBlank(message = "attestation_object 不能为空")
    String attestationObject
) {
}
