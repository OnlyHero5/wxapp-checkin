package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.ActivitySummaryDto;
import com.wxcheckin.backend.api.dto.WebActivityDetailResponse;
import com.wxcheckin.backend.api.dto.WebActivityListResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.TimeFormatter;
import com.wxcheckin.backend.domain.model.ActivityProgressStatus;
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
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;

/**
 * Activity read model APIs (A-03/A-04).
 */
@Service
public class ActivityQueryService {

  private static final int DEFAULT_PAGE = 1;
  private static final int DEFAULT_PAGE_SIZE = 50;
  private static final int MAX_PAGE_SIZE = 200;

  private final SessionService sessionService;
  private final WxActivityProjectionRepository activityRepository;
  private final WxUserActivityStatusRepository statusRepository;
  private final ObjectProvider<LegacySyncService> legacySyncServiceProvider;
  private final TimeFormatter timeFormatter;
  private final ActivityTimeWindowService activityTimeWindowService;
  private final Clock clock;

  public ActivityQueryService(
      SessionService sessionService,
      WxActivityProjectionRepository activityRepository,
      WxUserActivityStatusRepository statusRepository,
      ObjectProvider<LegacySyncService> legacySyncServiceProvider,
      TimeFormatter timeFormatter,
      ActivityTimeWindowService activityTimeWindowService,
      Clock clock
  ) {
    this.sessionService = sessionService;
    this.activityRepository = activityRepository;
    this.statusRepository = statusRepository;
    this.legacySyncServiceProvider = legacySyncServiceProvider;
    this.timeFormatter = timeFormatter;
    this.activityTimeWindowService = activityTimeWindowService;
    this.clock = clock;
  }

  // 注意：这里刻意不加 @Transactional 包住整个方法。
  // 原因：首次进入列表时会先读 status.exists，再触发 REQUIRES_NEW 的 on-demand legacy sync 写入 status。
  // 在 MySQL 默认 RR 隔离级别下，若外层事务已建立快照，后续读取看不到新写入的数据，
  // 会导致“首次改密后列表仍为空（或详情仍 forbidden）”的体验问题。
  public WebActivityListResponse listForWeb(String sessionToken, Integer page, Integer pageSize) {
    SessionPrincipal principal = sessionService.requireWebPrincipal(sessionToken);
    // 普通用户的可见活动依赖 wx_user_activity_status（报名/状态），
    // 但该表通常由“定时 legacy pull”填充。首次登录改密后如果 pull interval 偏大，会出现列表空窗期。
    // 这里在“本地无任何 status”时 best-effort 触发一次按用户即时同步，尽量让用户无需等待定时任务。
    ensureNormalUserStatusesPresent(principal);
    int normalizedPage = normalizePage(page);
    int normalizedPageSize = normalizePageSize(pageSize);
    Pageable pageable = PageRequest.of(normalizedPage - 1, normalizedPageSize);

    // staff 可见全部活动；普通用户仅返回“已报名/已签到/已签退”的活动，避免拉全表。
    Slice<WxActivityProjectionEntity> slice = principal.role() == RoleType.STAFF
        ? activityRepository.findByActiveTrueOrderByStartTimeDesc(pageable)
        : activityRepository.findVisibleForUser(principal.user().getId(), pageable);

    List<WxActivityProjectionEntity> activities = slice.getContent();
    List<String> activityIds = activities.stream().map(WxActivityProjectionEntity::getActivityId).toList();
    Map<String, WxUserActivityStatusEntity> statusMap = activityIds.isEmpty()
        ? Map.of()
        : statusRepository.findByUserIdAndActivityIdIn(principal.user().getId(), activityIds)
            .stream()
            .collect(Collectors.toMap(WxUserActivityStatusEntity::getActivityId, Function.identity(), (a, b) -> b));

    List<ActivitySummaryDto> payload = activities.stream()
        .map(activity -> toSummary(activity, statusMap.get(activity.getActivityId())))
        .toList();

    return new WebActivityListResponse(
        "success",
        "活动列表获取成功",
        payload,
        normalizedPage,
        normalizedPageSize,
        slice.hasNext(),
        Instant.now(clock).toEpochMilli()
    );
  }

  private void ensureNormalUserStatusesPresent(SessionPrincipal principal) {
    if (principal == null || principal.role() != RoleType.NORMAL) {
      return;
    }
    if (principal.user() == null || principal.user().getId() == null) {
      return;
    }
    if (statusRepository.existsByUserId(principal.user().getId())) {
      return;
    }
    Long legacyUserId = principal.user().getLegacyUserId();
    if (legacyUserId == null) {
      return;
    }
    LegacySyncService legacySyncService = legacySyncServiceProvider.getIfAvailable();
    if (legacySyncService == null) {
      return;
    }
    legacySyncService.syncLegacyUserContextOnDemand(legacyUserId);
  }

  // 同 listForWeb：避免把“on-demand sync 写入”与“详情读取/可见性校验”放进同一个事务快照里。
  public WebActivityDetailResponse detailForWeb(String sessionToken, String activityId) {
    SessionPrincipal principal = sessionService.requireWebPrincipal(sessionToken);
    // 同 listForWeb：避免首次登录改密后直接进详情页时因为 status 未同步而被误判“无权查看”。
    ensureNormalUserStatusesPresent(principal);
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

    boolean myRegistered = status != null && Boolean.TRUE.equals(status.getRegistered());
    UserActivityState state = status == null ? UserActivityState.NONE : UserActivityState.fromCode(status.getStatus());
    boolean myCheckedIn = state == UserActivityState.CHECKED_IN;
    boolean myCheckedOut = state == UserActivityState.CHECKED_OUT;

    // 关键：详情页的 `can_checkin/can_checkout` 必须纳入时间窗判断，
    // 否则会出现“显示可签到，但 staff 发码被 outside_activity_time_window 拒绝”的契约不一致。
    boolean withinWindow = activityTimeWindowService.isWithinIssueWindow(activity);
    boolean activityNotCompleted = ActivityProgressStatus.fromCode(activity.getProgressStatus()) != ActivityProgressStatus.COMPLETED;
    boolean canCheckin = withinWindow
        && activityNotCompleted
        && Boolean.TRUE.equals(activity.getSupportCheckin())
        && myRegistered
        && !myCheckedIn
        && !myCheckedOut;
    boolean canCheckout = withinWindow
        && activityNotCompleted
        && Boolean.TRUE.equals(activity.getSupportCheckout())
        && myCheckedIn
        && !myCheckedOut;

    long serverTimeMs = Instant.now(clock).toEpochMilli();
    return new WebActivityDetailResponse(
        "success",
        "活动详情获取成功",
        activity.getActivityId(),
        activity.getActivityTitle(),
        activity.getActivityType(),
        timeFormatter.toDisplay(activity.getStartTime()),
        activity.getLocation(),
        activity.getDescription(),
        activity.getProgressStatus(),
        activity.getSupportCheckout(),
        activity.getSupportCheckin(),
        activity.getHasDetail(),
        safeCount(activity.getRegisteredCount()),
        safeCount(activity.getCheckinCount()),
        safeCount(activity.getCheckoutCount()),
        myRegistered,
        myCheckedIn,
        myCheckedOut,
        canCheckin,
        canCheckout,
        serverTimeMs
    );
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
        activity.getSupportCheckin(),
        activity.getHasDetail(),
        safeCount(activity.getRegisteredCount()),
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

  private int normalizePage(Integer page) {
    if (page == null || page < 1) {
      return DEFAULT_PAGE;
    }
    return page;
  }

  private int normalizePageSize(Integer pageSize) {
    if (pageSize == null || pageSize < 1) {
      return DEFAULT_PAGE_SIZE;
    }
    if (pageSize > MAX_PAGE_SIZE) {
      throw new BusinessException("invalid_param", "page_size 过大，最大允许 " + MAX_PAGE_SIZE);
    }
    return pageSize;
  }

  private String normalize(String text) {
    return text == null ? "" : text.trim();
  }
}
