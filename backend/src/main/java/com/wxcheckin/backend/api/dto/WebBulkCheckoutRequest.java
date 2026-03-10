package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotNull;

public record WebBulkCheckoutRequest(
    @NotNull(message = "confirm 不能为空")
    Boolean confirm,
    String reason,
    String sessionToken
) {
}
