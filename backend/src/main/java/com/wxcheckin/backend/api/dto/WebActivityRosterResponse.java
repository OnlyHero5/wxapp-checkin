package com.wxcheckin.backend.api.dto;

import java.util.List;

/**
 * staff 参会名单页读取接口响应。
 *
 * <p>这里把活动摘要与名单一起返回，是为了让移动端在一个请求里同时拿到顶部摘要和列表内容，
 * 避免页面首屏要额外串两个接口才能渲染。</p>
 */
public record WebActivityRosterResponse(
    String status,
    String message,
    String activityId,
    String activityTitle,
    String activityType,
    String startTime,
    String location,
    String description,
    Integer registeredCount,
    Integer checkinCount,
    Integer checkoutCount,
    List<ActivityRosterItemDto> items,
    Long serverTimeMs
) {
}
