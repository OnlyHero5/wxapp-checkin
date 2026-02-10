package com.wxcheckin.backend.api.dto;

/**
 * Activity detail payload for A-04 API.
 */
public record ActivityDetailDto(
    String activityId,
    String activityTitle,
    String activityType,
    String startTime,
    String location,
    String description,
    String progressStatus,
    Boolean supportCheckout,
    Boolean hasDetail,
    Integer checkinCount,
    Integer checkoutCount,
    Boolean myRegistered,
    Boolean myCheckedIn,
    Boolean myCheckedOut,
    Integer rotateSeconds,
    Integer graceSeconds,
    Long serverTime
) {
}
