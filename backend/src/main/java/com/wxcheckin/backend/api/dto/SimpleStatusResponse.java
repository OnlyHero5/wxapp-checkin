package com.wxcheckin.backend.api.dto;

/**
 * Lightweight response type for compatibility endpoints.
 */
public record SimpleStatusResponse(
    String status,
    String message
) {
}
