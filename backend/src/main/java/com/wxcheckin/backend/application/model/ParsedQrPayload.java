package com.wxcheckin.backend.application.model;

import com.wxcheckin.backend.domain.model.ActionType;

/**
 * Parsed QR payload fields after syntax validation.
 */
public record ParsedQrPayload(
    String rawPayload,
    String activityId,
    ActionType actionType,
    long slot,
    String nonce
) {
}
