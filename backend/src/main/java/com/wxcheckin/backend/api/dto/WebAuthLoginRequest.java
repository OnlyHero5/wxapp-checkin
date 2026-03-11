package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Web 端账号密码登录请求体。
 *
 * 账号口径统一为学号 student_id。
 */
public record WebAuthLoginRequest(
    @NotBlank(message = "student_id 不能为空")
    String studentId,
    @NotBlank(message = "password 不能为空")
    String password
) {
}

