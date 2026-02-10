package com.wxcheckin.backend.api.dto;

import java.util.List;

/**
 * Response body for A-02 register binding.
 */
public record RegisterResponse(
    String status,
    String message,
    String role,
    List<String> permissions,
    Boolean adminVerified,
    Boolean isRegistered,
    UserProfileDto userProfile
) {
}
