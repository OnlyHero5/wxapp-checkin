package com.wxcheckin.backend.api.dto;

/**
 * Activity card payload for A-03 list API.
 */
public record ActivitySummaryDto(
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
    Boolean myCheckedOut
) {
}
