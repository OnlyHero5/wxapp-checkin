package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public record StaffActivityActionRequest(
    @NotBlank(message = "session_token 不能为空")
    String sessionToken,
    @NotBlank(message = "activity_id 不能为空")
    String activityId,
    @NotBlank(message = "action_type 不能为空")
    String actionType,
    String qrToken
) {
}
