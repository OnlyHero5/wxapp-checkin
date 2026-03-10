package com.wxcheckin.backend.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record WebPasskeyRegisterCompleteRequest(
    @NotBlank(message = "request_id 不能为空")
    String requestId,
    @NotBlank(message = "bind_ticket 不能为空")
    String bindTicket,
    @Valid
    @NotNull(message = "attestation_response 不能为空")
    WebPasskeyAttestationResponse attestationResponse
) {
}
