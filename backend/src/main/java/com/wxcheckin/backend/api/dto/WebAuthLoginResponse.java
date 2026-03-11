package com.wxcheckin.backend.api.dto;

import java.util.List;

/**
 * Web 端账号密码登录响应。
 *
 * 注意：接口仍沿用“HTTP 200 + JSON status”契约，前端以 status/error_code 判定业务结果。
 */
public record WebAuthLoginResponse(
    String status,
    String message,
    String sessionToken,
    Long sessionExpiresAt,
    String role,
    List<String> permissions,
    Boolean mustChangePassword,
    UserProfileDto userProfile
) {
}

