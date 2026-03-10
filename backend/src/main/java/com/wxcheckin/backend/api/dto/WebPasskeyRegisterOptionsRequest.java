package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public record WebPasskeyRegisterOptionsRequest(
    @NotBlank(message = "bind_ticket 不能为空")
    String bindTicket
) {
}
