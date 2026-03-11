package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Web 端改密请求体。
 *
 * 该接口既用于“首次登录强制改密”，也可作为后续的常规改密入口（如需）。
 */
public record WebAuthChangePasswordRequest(
    @NotBlank(message = "old_password 不能为空")
    String oldPassword,
    @NotBlank(message = "new_password 不能为空")
    String newPassword
) {
}

