package com.wxcheckin.backend.api.dto;

public record WebBindVerifyResponse(
    String status,
    String message,
    String bindTicket,
    Long bindTicketExpireAt,
    String roleHint,
    UserProfileDto userProfile
) {
}
