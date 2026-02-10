package com.wxcheckin.backend.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Shared error envelope returned for business or validation failures.
 */
public record ErrorResponse(
    String status,
    String message,
    @JsonProperty("error_code") String errorCode
) {
}
