package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.ActivityRosterItemDto;
import com.wxcheckin.backend.api.dto.WebActivityRosterResponse;
import com.wxcheckin.backend.api.dto.WebAttendanceAdjustmentResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.application.support.TimeFormatter;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.domain.model.ActionType;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.domain.model.UserActivityState;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebAdminAuditLogEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxCheckinEventEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebAdminAuditLogRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxCheckinEventRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * staff 参会名单查询与状态修正服务。
 *
 * <p>这层统一负责两件事：
 * 1. 把当前三态模型翻译成名单页需要的“签到 / 签退”双状态
 * 2. 把管理员的单个 / 批量修正收敛到一套状态机、统计、审计和 legacy 回写口径
 *
 * <p>注意：名单修正不是普通用户动态码消费，因此不能简单复用 `CheckinConsumeService`：
 * - 它允许撤销签到 / 撤销签退
 * - 它允许一次改多个用户
 * - 它需要 snapshot 型 outbox，而不是只表达“发生了一次 checkin/checkout”
 */
@Service
public class StaffAttendanceAdminService {

  private final SessionService sessionService;
  private final WxActivityProjectionRepository activityRepository;
  private final WxUserActivityStatusRepository statusRepository;
  private final WxCheckinEventRepository checkinEventRepository;
  private final WxSyncOutboxRepository syncOutboxRepository;
  private final WebAdminAuditLogRepository adminAuditLogRepository;
  private final TokenGenerator tokenGenerator;
  private final JsonCodec jsonCodec;
  private final TimeFormatter timeFormatter;
  private final Clock clock;

  public StaffAttendanceAdminService(
      SessionService sessionService,
      WxActivityProjectionRepository activityRepository,
      WxUserActivityStatusRepository statusRepository,
      WxCheckinEventRepository checkinEventRepository,
      WxSyncOutboxRepository syncOutboxRepository,
      WebAdminAuditLogRepository adminAuditLogRepository,
      TokenGenerator tokenGenerator,
      JsonCodec jsonCodec,
      TimeFormatter timeFormatter,
      Clock clock
  ) {
    this.sessionService = sessionService;
    this.activityRepository = activityRepository;
    this.statusRepository = statusRepository;
    this.checkinEventRepository = checkinEventRepository;
    this.syncOutboxRepository = syncOutboxRepository;
    this.adminAuditLogRepository = adminAuditLogRepository;
    this.tokenGenerator = tokenGenerator;
    this.jsonCodec = jsonCodec;
    this.timeFormatter = timeFormatter;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public WebActivityRosterResponse getActivityRoster(String sessionToken, String activityId) {
    SessionPrincipal principal = requireStaffPrincipal(sessionToken);
    String normalizedActivityId = normalizeActivityId(activityId);
    WxActivityProjectionEntity activity = findActivity(normalizedActivityId);
    List<WxUserActivityStatusEntity> statuses = statusRepository.findRegisteredByActivityIdOrderByStudentId(normalizedActivityId);

    // 名单页需要同时显示当前状态对应的时间，但只应展示“当前仍有效”的时间字段。
    // 例如状态已回到 none，就不应继续显示历史签到时间误导管理员。
    Map<Long, LatestEventTimes> latestEventTimes = collectLatestEventTimes(
        normalizedActivityId,
        statuses.stream().map(status -> status.getUser().getId()).toList()
    );

    List<ActivityRosterItemDto> items = statuses.stream()
        .map(status -> toRosterItem(status, latestEventTimes.get(status.getUser().getId())))
        .toList();

    return new WebActivityRosterResponse(
        "success",
        "参会名单获取成功",
        activity.getActivityId(),
        activity.getActivityTitle(),
        activity.getActivityType(),
        timeFormatter.toDisplay(activity.getStartTime()),
        activity.getLocation(),
        activity.getDescription(),
        safeCount(activity.getRegisteredCount()),
        safeCount(activity.getCheckinCount()),
        safeCount(activity.getCheckoutCount()),
        items,
        Instant.now(clock).toEpochMilli()
    );
  }

  @Transactional
  public WebAttendanceAdjustmentResponse adjustAttendanceStates(
      String sessionToken,
      String activityId,
      List<Long> userIds,
      Boolean checkedIn,
      Boolean checkedOut,
      String reason
  ) {
    SessionPrincipal principal = requireStaffPrincipal(sessionToken);
    String normalizedActivityId = normalizeActivityId(activityId);
    validatePatch(checkedIn, checkedOut);
    List<Long> normalizedUserIds = normalizeUserIds(userIds);
    WxActivityProjectionEntity activity = findActivity(normalizedActivityId);

    List<WxUserActivityStatusEntity> targets = statusRepository.lockRegisteredByActivityIdAndUserIds(
        normalizedActivityId,
        normalizedUserIds
    );
    if (targets.size() != normalizedUserIds.size()) {
      throw new BusinessException("invalid_param", "目标成员不存在、未报名或不属于当前活动");
    }

    long now = Instant.now(clock).toEpochMilli();
    String batchId = "adj_" + tokenGenerator.newNonce();
    int affectedCount = 0;
    int checkinDelta = 0;
    int checkoutDelta = 0;
    List<Map<String, Object>> adjustmentItems = new ArrayList<>();
    List<WxCheckinEventEntity> positiveEvents = new ArrayList<>();
    List<WxSyncOutboxEntity> outboxes = new ArrayList<>();

    for (WxUserActivityStatusEntity target : targets) {
      UserActivityState currentState = UserActivityState.fromCode(target.getStatus());
      UserActivityState nextState = resolveNextState(currentState, checkedIn, checkedOut);

      if (currentState == nextState) {
        continue;
      }

      target.setStatus(nextState.getCode());
      affectedCount += 1;

      ProjectionDelta delta = resolveProjectionDelta(currentState, nextState);
      checkinDelta += delta.checkinDelta();
      checkoutDelta += delta.checkoutDelta();

      adjustmentItems.add(buildAuditItem(target.getUser(), currentState, nextState));
      appendPositiveEvents(target.getUser(), normalizedActivityId, currentState, nextState, batchId, now, positiveEvents);
      outboxes.add(buildSnapshotOutbox(target.getUser(), normalizedActivityId, nextState, batchId, now));
    }

    statusRepository.saveAll(targets);
    if (checkinDelta != 0 || checkoutDelta != 0) {
      activityRepository.adjustCounts(normalizedActivityId, checkinDelta, checkoutDelta);
    }
    if (!positiveEvents.isEmpty()) {
      checkinEventRepository.saveAll(positiveEvents);
    }
    if (!outboxes.isEmpty()) {
      syncOutboxRepository.saveAll(outboxes);
    }
    adminAuditLogRepository.save(buildAuditLog(principal.user(), normalizedActivityId, batchId, normalizeReason(reason), affectedCount, adjustmentItems, now));

    return new WebAttendanceAdjustmentResponse(
        "success",
        affectedCount > 0 ? "名单状态修正完成" : "当前无需修正状态",
        activity.getActivityId(),
        affectedCount,
        batchId,
        now
    );
  }

  private SessionPrincipal requireStaffPrincipal(String sessionToken) {
    SessionPrincipal principal = sessionService.requireWebPrincipal(sessionToken);
    if (principal.role() != RoleType.STAFF) {
      throw new BusinessException("forbidden", "仅工作人员可查看或修正参会名单");
    }
    return principal;
  }

  private String normalizeActivityId(String activityId) {
    String normalizedActivityId = activityId == null ? "" : activityId.trim();
    if (normalizedActivityId.isEmpty()) {
      throw new BusinessException("invalid_param", "activity_id 参数缺失");
    }
    return normalizedActivityId;
  }

  private List<Long> normalizeUserIds(List<Long> userIds) {
    if (userIds == null || userIds.isEmpty()) {
      throw new BusinessException("invalid_param", "user_ids 不能为空");
    }
    Set<Long> normalized = new LinkedHashSet<>();
    for (Long userId : userIds) {
      if (userId == null || userId <= 0) {
        throw new BusinessException("invalid_param", "user_ids 包含非法成员");
      }
      normalized.add(userId);
    }
    return List.copyOf(normalized);
  }

  private void validatePatch(Boolean checkedIn, Boolean checkedOut) {
    if (checkedIn == null && checkedOut == null) {
      throw new BusinessException("invalid_param", "patch 至少要包含一个状态位");
    }
  }

  private WxActivityProjectionEntity findActivity(String activityId) {
    return activityRepository.findByActivityIdAndActiveTrue(activityId)
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));
  }

  private ActivityRosterItemDto toRosterItem(
      WxUserActivityStatusEntity status,
      LatestEventTimes latestEventTimes
  ) {
    UserActivityState state = UserActivityState.fromCode(status.getStatus());
    VisibleTimes visibleTimes = resolveVisibleTimes(state, latestEventTimes);
    return new ActivityRosterItemDto(
        status.getUser().getId(),
        status.getUser().getStudentId(),
        status.getUser().getName(),
        state == UserActivityState.CHECKED_IN || state == UserActivityState.CHECKED_OUT,
        state == UserActivityState.CHECKED_OUT,
        visibleTimes.checkinTime(),
        visibleTimes.checkoutTime()
    );
  }

  private Map<Long, LatestEventTimes> collectLatestEventTimes(String activityId, List<Long> userIds) {
    if (userIds.isEmpty()) {
      return Map.of();
    }
    List<WxCheckinEventEntity> events = checkinEventRepository.findByActivityIdAndUserIdInOrderBySubmittedAtDesc(activityId, userIds);
    Map<Long, LatestEventTimes> result = new HashMap<>();
    for (WxCheckinEventEntity event : events) {
      Long userId = event.getUser() == null ? null : event.getUser().getId();
      if (userId == null) {
        continue;
      }
      LatestEventTimes current = result.getOrDefault(userId, new LatestEventTimes("", ""));
      if (ActionType.CHECKIN.getCode().equalsIgnoreCase(event.getActionType()) && current.checkinTime().isEmpty()) {
        result.put(userId, new LatestEventTimes(timeFormatter.toDisplay(event.getSubmittedAt()), current.checkoutTime()));
        continue;
      }
      if (ActionType.CHECKOUT.getCode().equalsIgnoreCase(event.getActionType()) && current.checkoutTime().isEmpty()) {
        result.put(userId, new LatestEventTimes(current.checkinTime(), timeFormatter.toDisplay(event.getSubmittedAt())));
      }
    }
    return result;
  }

  private VisibleTimes resolveVisibleTimes(UserActivityState state, LatestEventTimes latestEventTimes) {
    LatestEventTimes safeTimes = latestEventTimes == null ? new LatestEventTimes("", "") : latestEventTimes;
    if (state == UserActivityState.NONE) {
      return new VisibleTimes("", "");
    }
    if (state == UserActivityState.CHECKED_IN) {
      return new VisibleTimes(safeTimes.checkinTime(), "");
    }
    return new VisibleTimes(safeTimes.checkinTime(), safeTimes.checkoutTime());
  }

  private UserActivityState resolveNextState(
      UserActivityState currentState,
      Boolean checkedIn,
      Boolean checkedOut
  ) {
    // “签到设为未签”优先级最高，因为业务明确要求它必须同时清掉签退。
    if (Boolean.FALSE.equals(checkedIn)) {
      return UserActivityState.NONE;
    }
    // “签退设为已签退”也要优先收敛，因为它隐含“已签到”。
    if (Boolean.TRUE.equals(checkedOut)) {
      return UserActivityState.CHECKED_OUT;
    }
    if (Boolean.TRUE.equals(checkedIn)) {
      return UserActivityState.CHECKED_IN;
    }
    // 只显式撤销签退时，如果之前已在活动内，则回到 checked_in；否则保持 none。
    if (Boolean.FALSE.equals(checkedOut)) {
      return currentState == UserActivityState.NONE ? UserActivityState.NONE : UserActivityState.CHECKED_IN;
    }
    throw new BusinessException("invalid_param", "patch 组合非法");
  }

  private ProjectionDelta resolveProjectionDelta(UserActivityState currentState, UserActivityState nextState) {
    if (currentState == nextState) {
      return new ProjectionDelta(0, 0);
    }
    return switch (currentState) {
      case NONE -> switch (nextState) {
        case CHECKED_IN -> new ProjectionDelta(1, 0);
        case CHECKED_OUT -> new ProjectionDelta(0, 1);
        case NONE -> new ProjectionDelta(0, 0);
      };
      case CHECKED_IN -> switch (nextState) {
        case NONE -> new ProjectionDelta(-1, 0);
        case CHECKED_OUT -> new ProjectionDelta(-1, 1);
        case CHECKED_IN -> new ProjectionDelta(0, 0);
      };
      case CHECKED_OUT -> switch (nextState) {
        case NONE -> new ProjectionDelta(0, -1);
        case CHECKED_IN -> new ProjectionDelta(1, -1);
        case CHECKED_OUT -> new ProjectionDelta(0, 0);
      };
    };
  }

  private Map<String, Object> buildAuditItem(
      WxUserAuthExtEntity user,
      UserActivityState currentState,
      UserActivityState nextState
  ) {
    Map<String, Object> item = new HashMap<>();
    item.put("user_id", user.getId());
    item.put("student_id", user.getStudentId());
    item.put("name", user.getName());
    item.put("before_state", currentState.getCode());
    item.put("after_state", nextState.getCode());
    return item;
  }

  private WxSyncOutboxEntity buildSnapshotOutbox(
      WxUserAuthExtEntity user,
      String activityId,
      UserActivityState nextState,
      String batchId,
      long now
  ) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("batch_id", batchId);
    payload.put("user_id", user.getId());
    payload.put("activity_id", activityId);
    payload.put("check_in", nextState == UserActivityState.NONE ? 0 : 1);
    payload.put("check_out", nextState == UserActivityState.CHECKED_OUT ? 1 : 0);
    payload.put("server_time", now);

    WxSyncOutboxEntity outbox = new WxSyncOutboxEntity();
    outbox.setAggregateType("attendance_adjustment");
    outbox.setAggregateId("adj_" + tokenGenerator.newNonce());
    outbox.setEventType("ATTENDANCE_STATUS_ADJUSTED");
    outbox.setPayloadJson(jsonCodec.writeMap(payload));
    outbox.setStatus("pending");
    outbox.setAvailableAt(Instant.ofEpochMilli(now));
    return outbox;
  }

  private void appendPositiveEvents(
      WxUserAuthExtEntity user,
      String activityId,
      UserActivityState currentState,
      UserActivityState nextState,
      String batchId,
      long now,
      List<WxCheckinEventEntity> events
  ) {
    if (currentState == UserActivityState.NONE && nextState == UserActivityState.CHECKED_IN) {
      events.add(buildEvent(user, activityId, ActionType.CHECKIN, batchId, now));
      return;
    }
    if (currentState == UserActivityState.NONE && nextState == UserActivityState.CHECKED_OUT) {
      // 管理员直接补到“已签退”时，要同时补一条签到时间和签退时间，否则详情页无法展示成对时间。
      events.add(buildEvent(user, activityId, ActionType.CHECKIN, batchId, now));
      events.add(buildEvent(user, activityId, ActionType.CHECKOUT, batchId, now));
      return;
    }
    if (currentState == UserActivityState.CHECKED_IN && nextState == UserActivityState.CHECKED_OUT) {
      events.add(buildEvent(user, activityId, ActionType.CHECKOUT, batchId, now));
    }
  }

  private WxCheckinEventEntity buildEvent(
      WxUserAuthExtEntity user,
      String activityId,
      ActionType actionType,
      String batchId,
      long now
  ) {
    WxCheckinEventEntity event = new WxCheckinEventEntity();
    event.setRecordId(tokenGenerator.newRecordId());
    event.setUser(user);
    event.setActivityId(activityId);
    event.setActionType(actionType.getCode());
    event.setSlot(now / 1000L);
    event.setNonce("admin:" + batchId);
    event.setInGraceWindow(false);
    event.setSubmittedAt(Instant.ofEpochMilli(now));
    event.setServerTime(now);
    event.setQrPayload("admin-adjustment:" + batchId + ":" + actionType.getCode());
    return event;
  }

  private WebAdminAuditLogEntity buildAuditLog(
      WxUserAuthExtEntity operator,
      String activityId,
      String batchId,
      String reason,
      int affectedCount,
      List<Map<String, Object>> adjustmentItems,
      long now
  ) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("activity_id", activityId);
    payload.put("batch_id", batchId);
    payload.put("reason", reason);
    payload.put("affected_count", affectedCount);
    payload.put("items", adjustmentItems);
    payload.put("server_time_ms", now);

    WebAdminAuditLogEntity audit = new WebAdminAuditLogEntity();
    audit.setAuditId("audit_" + tokenGenerator.newNonce());
    audit.setOperatorUser(operator);
    audit.setActionType("attendance_adjustment");
    audit.setTargetType("activity");
    audit.setTargetId(activityId);
    audit.setPayloadJson(jsonCodec.writeMap(payload));
    return audit;
  }

  private Integer safeCount(Integer value) {
    return value == null ? 0 : value;
  }

  private String normalizeReason(String reason) {
    return reason == null ? "" : reason.trim();
  }

  private record LatestEventTimes(String checkinTime, String checkoutTime) {
  }

  private record VisibleTimes(String checkinTime, String checkoutTime) {
  }

  private record ProjectionDelta(int checkinDelta, int checkoutDelta) {
  }
}
