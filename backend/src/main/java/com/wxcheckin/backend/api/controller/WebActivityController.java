package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.ActivityDetailDto;
import com.wxcheckin.backend.api.dto.ActivityDetailResponse;
import com.wxcheckin.backend.api.dto.ActivityListResponse;
import com.wxcheckin.backend.api.dto.WebActivityDetailResponse;
import com.wxcheckin.backend.api.dto.WebActivityListResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.ActivityQueryService;
import com.wxcheckin.backend.domain.model.ActivityProgressStatus;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/web/activities")
public class WebActivityController {

  private static final String BROWSER_BINDING_KEY_HEADER = "X-Browser-Binding-Key";

  private final ActivityQueryService activityQueryService;
  private final SessionTokenExtractor sessionTokenExtractor;
  private final Clock clock;

  public WebActivityController(
      ActivityQueryService activityQueryService,
      SessionTokenExtractor sessionTokenExtractor,
      Clock clock
  ) {
    this.activityQueryService = activityQueryService;
    this.sessionTokenExtractor = sessionTokenExtractor;
    this.clock = clock;
  }

  @GetMapping
  public WebActivityListResponse list(HttpServletRequest request) {
    String token = sessionTokenExtractor.extract(null, request);
    ActivityListResponse response = activityQueryService.listActivities(
        token,
        request.getHeader(BROWSER_BINDING_KEY_HEADER)
    );
    return new WebActivityListResponse(
        response.status(),
        response.message(),
        response.activities(),
        Instant.now(clock).toEpochMilli()
    );
  }

  @GetMapping("/{activityId}")
  public WebActivityDetailResponse detail(
      @PathVariable("activityId") String activityId,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(null, request);
    ActivityDetailResponse response = activityQueryService.detail(
        token,
        request.getHeader(BROWSER_BINDING_KEY_HEADER),
        activityId
    );
    ActivityDetailDto data = response.data();
    return new WebActivityDetailResponse(
        response.status(),
        response.message(),
        data.activityId(),
        data.activityTitle(),
        data.activityType(),
        data.startTime(),
        data.location(),
        data.description(),
        data.progressStatus(),
        data.supportCheckout(),
        data.supportCheckin(),
        data.hasDetail(),
        data.checkinCount(),
        data.checkoutCount(),
        data.myRegistered(),
        data.myCheckedIn(),
        data.myCheckedOut(),
        data.rotateSeconds(),
        data.graceSeconds(),
        resolveCanCheckin(data),
        resolveCanCheckout(data),
        data.serverTime()
    );
  }

  private Boolean resolveCanCheckin(ActivityDetailDto data) {
    return Boolean.TRUE.equals(data.supportCheckin())
        && Boolean.TRUE.equals(data.myRegistered())
        && !Boolean.TRUE.equals(data.myCheckedIn())
        && !Boolean.TRUE.equals(data.myCheckedOut())
        && ActivityProgressStatus.fromCode(data.progressStatus()) != ActivityProgressStatus.COMPLETED;
  }

  private Boolean resolveCanCheckout(ActivityDetailDto data) {
    return Boolean.TRUE.equals(data.supportCheckout())
        && Boolean.TRUE.equals(data.myCheckedIn())
        && !Boolean.TRUE.equals(data.myCheckedOut())
        && ActivityProgressStatus.fromCode(data.progressStatus()) != ActivityProgressStatus.COMPLETED;
  }
}
