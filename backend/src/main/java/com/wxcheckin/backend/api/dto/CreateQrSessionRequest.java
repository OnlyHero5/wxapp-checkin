package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Request body for A-05 QR session issuance.
 */
public record CreateQrSessionRequest(
    @NotBlank(message = "session_token 不能为空")
    String sessionToken,

    @NotBlank(message = "action_type 不能为空")
    @Pattern(regexp = "^(checkin|checkout)$", message = "action_type 仅支持 checkin/checkout")
    String actionType,

    Integer rotateSeconds,
    Integer graceSeconds
) {
}
