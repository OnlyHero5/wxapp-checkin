package com.wxcheckin.backend.api.dto;

public record WebActivityDetailResponse(
    String status,
    String message,
    String activityId,
    String activityTitle,
    String activityType,
    String startTime,
    String location,
    String description,
    String progressStatus,
    Boolean supportCheckout,
    Boolean supportCheckin,
    Boolean hasDetail,
    Integer registeredCount,
    Integer checkinCount,
    Integer checkoutCount,
    Boolean myRegistered,
    Boolean myCheckedIn,
    Boolean myCheckedOut,
    String myCheckinTime,
    String myCheckoutTime,
    Boolean canCheckin,
    Boolean canCheckout,
    Long serverTimeMs
) {
}
