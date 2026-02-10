package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Request body for A-01 WeChat login.
 */
public record WxLoginRequest(
    @NotBlank(message = "wx_login_code 不能为空")
    String wxLoginCode
) {
}
