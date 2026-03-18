package com.wxcheckin.backend.api.dto;

/**
 * 管理员参会名单页的单行成员数据。
 *
 * <p>前端虽然展示成“签到 / 签退”两个状态位，
 * 但它们仍然由后端三态模型推导而来，不直接暴露数据库内部字段。</p>
 */
public record ActivityRosterItemDto(
    Long userId,
    String studentId,
    String name,
    Boolean checkedIn,
    Boolean checkedOut,
    String checkinTime,
    String checkoutTime
) {
}
