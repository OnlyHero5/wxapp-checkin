package com.wxcheckin.backend.api.dto;

import java.util.List;

public record WebAuthSessionResponse(
    String status,
    String message,
    String sessionToken,
    Long sessionExpiresAt,
    String role,
    List<String> permissions,
    Boolean registered,
    UserProfileDto userProfile
) {
}
