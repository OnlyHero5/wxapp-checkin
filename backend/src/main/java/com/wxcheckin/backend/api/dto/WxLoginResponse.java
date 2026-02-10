package com.wxcheckin.backend.api.dto;

import java.util.List;

/**
 * Response body for A-01 WeChat login.
 */
public record WxLoginResponse(
    String status,
    String message,
    String sessionToken,
    String wxIdentity,
    String role,
    List<String> permissions,
    Boolean isRegistered,
    UserProfileDto userProfile
) {
}
