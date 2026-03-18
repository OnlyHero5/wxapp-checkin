package com.wxcheckin.backend.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * 管理员参会名单状态修正请求。
 *
 * <p>单个修改和批量修改统一走这一个请求体，
 * 这样统计、审计和 legacy 回写就不会分叉成两套写口径。</p>
 */
public record WebAttendanceAdjustmentRequest(
    @NotEmpty(message = "user_ids 不能为空")
    List<Long> userIds,
    @NotNull(message = "patch 不能为空")
    @Valid
    WebAttendanceAdjustmentPatchDto patch,
    String reason,
    String sessionToken
) {
}
