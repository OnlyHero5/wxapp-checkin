package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.ActivityDetailDto;
import com.wxcheckin.backend.api.dto.ActivityDetailResponse;
import com.wxcheckin.backend.api.dto.ActivityListResponse;
import com.wxcheckin.backend.api.dto.ActivitySummaryDto;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.TimeFormatter;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.domain.model.UserActivityState;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Activity read model APIs (A-03/A-04).
 */
@Service
public class ActivityQueryService {

  private final SessionService sessionService;
  private final WxActivityProjectionRepository activityRepository;
  private final WxUserActivityStatusRepository statusRepository;
  private final TimeFormatter timeFormatter;
  private final Clock clock;

  public ActivityQueryService(
      SessionService sessionService,
      WxActivityProjectionRepository activityRepository,
      WxUserActivityStatusRepository statusRepository,
      TimeFormatter timeFormatter,
      Clock clock
  ) {
    this.sessionService = sessionService;
    this.activityRepository = activityRepository;
    this.statusRepository = statusRepository;
    this.timeFormatter = timeFormatter;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public ActivityListResponse listActivities(String sessionToken) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken);
    List<WxActivityProjectionEntity> activities = activityRepository.findByActiveTrueOrderByStartTimeDesc();

    Map<String, WxUserActivityStatusEntity> statusMap = statusRepository.findByUserId(principal.user().getId())
        .stream()
        .collect(Collectors.toMap(WxUserActivityStatusEntity::getActivityId, Function.identity(), (a, b) -> b));

    List<ActivitySummaryDto> visible = activities.stream()
        .filter(activity -> isVisibleForRole(principal.role(), statusMap.get(activity.getActivityId())))
        .map(activity -> toSummary(activity, statusMap.get(activity.getActivityId())))
        .toList();

    return new ActivityListResponse("success", "活动列表获取成功", visible);
  }

  @Transactional(readOnly = true)
  public ActivityDetailResponse detail(String sessionToken, String activityId) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken);
    String normalizedActivityId = normalize(activityId);
    if (normalizedActivityId.isEmpty()) {
      throw new BusinessException("invalid_param", "activity_id 参数缺失");
    }

    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(normalizedActivityId)
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));

    Optional<WxUserActivityStatusEntity> statusOptional =
        statusRepository.findByUserIdAndActivityId(principal.user().getId(), normalizedActivityId);
    WxUserActivityStatusEntity status = statusOptional.orElse(null);
    if (!isVisibleForRole(principal.role(), status)) {
      throw new BusinessException("forbidden", "你无权查看该活动详情");
    }

    ActivityDetailDto dto = new ActivityDetailDto(
        activity.getActivityId(),
        activity.getActivityTitle(),
        activity.getActivityType(),
        timeFormatter.toDisplay(activity.getStartTime()),
        activity.getLocation(),
        activity.getDescription(),
        activity.getProgressStatus(),
        activity.getSupportCheckout(),
        activity.getHasDetail(),
        safeCount(activity.getCheckinCount()),
        safeCount(activity.getCheckoutCount()),
        status != null && Boolean.TRUE.equals(status.getRegistered()),
        status != null && UserActivityState.fromCode(status.getStatus()) == UserActivityState.CHECKED_IN,
        status != null && UserActivityState.fromCode(status.getStatus()) == UserActivityState.CHECKED_OUT,
        activity.getRotateSeconds(),
        activity.getGraceSeconds(),
        Instant.now(clock).toEpochMilli()
    );

    return new ActivityDetailResponse("success", "活动详情获取成功", dto);
  }

  private ActivitySummaryDto toSummary(WxActivityProjectionEntity activity, WxUserActivityStatusEntity status) {
    UserActivityState state = status == null ? UserActivityState.NONE : UserActivityState.fromCode(status.getStatus());
    boolean registered = status != null && Boolean.TRUE.equals(status.getRegistered());
    return new ActivitySummaryDto(
        activity.getActivityId(),
        activity.getActivityTitle(),
        activity.getActivityType(),
        timeFormatter.toDisplay(activity.getStartTime()),
        activity.getLocation(),
        activity.getDescription(),
        activity.getProgressStatus(),
        activity.getSupportCheckout(),
        activity.getHasDetail(),
        safeCount(activity.getCheckinCount()),
        safeCount(activity.getCheckoutCount()),
        registered,
        state == UserActivityState.CHECKED_IN,
        state == UserActivityState.CHECKED_OUT
    );
  }

  private boolean isVisibleForRole(RoleType role, WxUserActivityStatusEntity status) {
    if (role == RoleType.STAFF) {
      return true;
    }
    if (status == null) {
      return false;
    }
    return Boolean.TRUE.equals(status.getRegistered()) || UserActivityState.fromCode(status.getStatus()) != UserActivityState.NONE;
  }

  private Integer safeCount(Integer value) {
    return value == null ? 0 : value;
  }

  private String normalize(String text) {
    return text == null ? "" : text.trim();
  }
}
