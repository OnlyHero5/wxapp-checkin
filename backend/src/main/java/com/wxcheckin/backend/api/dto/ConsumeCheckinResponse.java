package com.wxcheckin.backend.api.dto;

/**
 * Response body for A-06 consume API.
 */
public record ConsumeCheckinResponse(
    String status,
    String message,
    String actionType,
    String activityId,
    String activityTitle,
    String checkinRecordId,
    Boolean inGraceWindow,
    Long serverTime
) {
}
