package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;

public record WebBindVerifyRequest(
    @NotBlank(message = "student_id 不能为空")
    String studentId,
    @NotBlank(message = "name 不能为空")
    String name
) {
}
