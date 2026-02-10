package com.wxcheckin.backend.api.dto;

/**
 * Public user profile object used by login/register responses.
 */
public record UserProfileDto(
    String studentId,
    String name,
    String department,
    String club,
    String avatarUrl,
    Integer socialScore,
    Integer lectureScore
) {
}
