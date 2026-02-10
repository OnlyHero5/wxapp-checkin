package com.wxcheckin.backend.api.dto;

import java.util.List;

public record RecordListResponse(
    String status,
    String message,
    List<RecordItemDto> records
) {
}
