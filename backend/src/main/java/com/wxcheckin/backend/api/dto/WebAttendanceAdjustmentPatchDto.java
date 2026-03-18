package com.wxcheckin.backend.api.dto;

/**
 * 管理员手工修正的目标状态补丁。
 *
 * <p>字段允许为 null，表示“本次请求未显式指定该维度”，
 * 最终状态由服务端统一收敛，避免前端各自实现状态机。</p>
 */
public record WebAttendanceAdjustmentPatchDto(
    Boolean checkedIn,
    Boolean checkedOut
) {
}
