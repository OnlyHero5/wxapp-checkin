package com.wxcheckin.backend.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request body for A-02 register binding.
 */
public record RegisterRequest(
    @NotBlank(message = "session_token 不能为空")
    String sessionToken,

    @NotBlank(message = "student_id 不能为空")
    @Pattern(regexp = "^[0-9A-Za-z_-]{4,32}$", message = "student_id 格式非法")
    String studentId,

    @NotBlank(message = "name 不能为空")
    @Size(min = 1, max = 64, message = "name 长度需在 1~64")
    String name,

    @Size(max = 128, message = "department 长度不能超过 128")
    String department,

    @Size(max = 128, message = "club 长度不能超过 128")
    String club,

    String payloadEncrypted
) {
}
