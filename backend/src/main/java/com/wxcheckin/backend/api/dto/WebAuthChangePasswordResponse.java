package com.wxcheckin.backend.api.dto;

/**
 * Web 端改密响应体。
 */
public record WebAuthChangePasswordResponse(
    String status,
    String message,
    Boolean mustChangePassword
) {
}

