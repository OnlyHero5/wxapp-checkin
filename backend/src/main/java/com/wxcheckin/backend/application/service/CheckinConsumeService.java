package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.WebCodeConsumeResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.ActionType;
import com.wxcheckin.backend.domain.model.ActivityProgressStatus;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.domain.model.UserActivityState;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxCheckinEventEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxReplayGuardEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxCheckinEventRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxReplayGuardRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Web 动态码的签到/签退消费服务。
 *
 * <p>注意：当前仓库的正式产品形态是“手机浏览器 Web + 动态 6 位码”，不再接收二维码扫码 payload。</p>
 */
@Service
public class CheckinConsumeService {

  private final SessionService sessionService;
  private final WxActivityProjectionRepository activityRepository;
  private final WxUserActivityStatusRepository statusRepository;
  private final WxReplayGuardRepository replayGuardRepository;
  private final WxCheckinEventRepository checkinEventRepository;
  private final WxSyncOutboxRepository syncOutboxRepository;
  private final TokenGenerator tokenGenerator;
  private final JsonCodec jsonCodec;
  private final AppProperties appProperties;
  private final Clock clock;
  private final DynamicCodeService dynamicCodeService;
  private final InvalidCodeAttemptLimiter invalidCodeAttemptLimiter;

  public CheckinConsumeService(
      SessionService sessionService,
      WxActivityProjectionRepository activityRepository,
      WxUserActivityStatusRepository statusRepository,
      WxReplayGuardRepository replayGuardRepository,
      WxCheckinEventRepository checkinEventRepository,
      WxSyncOutboxRepository syncOutboxRepository,
      TokenGenerator tokenGenerator,
      JsonCodec jsonCodec,
      AppProperties appProperties,
      Clock clock,
      DynamicCodeService dynamicCodeService,
      InvalidCodeAttemptLimiter invalidCodeAttemptLimiter
  ) {
    this.sessionService = sessionService;
    this.activityRepository = activityRepository;
    this.statusRepository = statusRepository;
    this.replayGuardRepository = replayGuardRepository;
    this.checkinEventRepository = checkinEventRepository;
    this.syncOutboxRepository = syncOutboxRepository;
    this.tokenGenerator = tokenGenerator;
    this.jsonCodec = jsonCodec;
    this.appProperties = appProperties;
    this.clock = clock;
    this.dynamicCodeService = dynamicCodeService;
    this.invalidCodeAttemptLimiter = invalidCodeAttemptLimiter;
  }

  @Transactional
  public WebCodeConsumeResponse consumeWebCode(
      String sessionToken,
      String activityId,
      String actionTypeText,
      String code,
      String clientIp
  ) {
    SessionPrincipal principal = sessionService.requireWebPrincipal(sessionToken);
    if (principal.role() != RoleType.NORMAL) {
      throw new BusinessException("forbidden", "仅普通用户可签到/签退");
    }

    ResolvedConsumePayload payload = resolveConsumePayload(
        activityId,
        actionTypeText,
        code,
        principal.user() == null ? null : principal.user().getId(),
        clientIp
    );

    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(payload.activityId())
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));
    if (ActivityProgressStatus.fromCode(activity.getProgressStatus()) == ActivityProgressStatus.COMPLETED) {
      throw new BusinessException("forbidden", "活动已结束，无法再签到/签退");
    }
    if (payload.actionType() == ActionType.CHECKIN && !Boolean.TRUE.equals(activity.getSupportCheckin())) {
      throw new BusinessException("forbidden", "该活动暂不支持签到");
    }
    if (payload.actionType() == ActionType.CHECKOUT && !Boolean.TRUE.equals(activity.getSupportCheckout())) {
      throw new BusinessException("forbidden", "该活动暂不支持签退");
    }
    long now = Instant.now(clock).toEpochMilli();
    acquireReplayGuard(principal.user(), payload.activityId(), payload.actionType(), payload.slot(), now);

    WxUserActivityStatusEntity status = statusRepository
        .lockByUserIdAndActivityId(principal.user().getId(), payload.activityId())
        .orElseThrow(() -> new BusinessException("forbidden", "你未报名该活动，无法签到/签退"));
    if (!Boolean.TRUE.equals(status.getRegistered())) {
      throw new BusinessException("forbidden", "你未报名该活动，无法签到/签退");
    }

    UserActivityState currentState = UserActivityState.fromCode(status.getStatus());
    UserActivityState nextState = decideNextState(currentState, payload.actionType());
    status.setStatus(nextState.getCode());
    statusRepository.save(status);

    if (payload.actionType() == ActionType.CHECKIN) {
      activityRepository.adjustCounts(activity.getActivityId(), 1, 0);
    } else {
      activityRepository.adjustCounts(activity.getActivityId(), -1, 1);
    }

    String recordId = tokenGenerator.newRecordId();
    WxCheckinEventEntity event = new WxCheckinEventEntity();
    event.setRecordId(recordId);
    event.setUser(principal.user());
    event.setActivityId(payload.activityId());
    event.setActionType(payload.actionType().getCode());
    event.setSlot(payload.slot());
    event.setNonce(payload.nonce());
    event.setInGraceWindow(payload.inGraceWindow());
    event.setSubmittedAt(Instant.ofEpochMilli(now));
    event.setServerTime(now);
    event.setQrPayload(payload.rawPayload());
    checkinEventRepository.save(event);

    Map<String, Object> outboxPayload = new HashMap<>();
    outboxPayload.put("record_id", recordId);
    outboxPayload.put("user_id", principal.user().getId());
    outboxPayload.put("activity_id", payload.activityId());
    outboxPayload.put("action_type", payload.actionType().getCode());
    outboxPayload.put("slot", payload.slot());
    outboxPayload.put("nonce", payload.nonce());
    outboxPayload.put("server_time", now);

    WxSyncOutboxEntity outbox = new WxSyncOutboxEntity();
    outbox.setAggregateType("checkin_event");
    outbox.setAggregateId(recordId);
    outbox.setEventType("CHECKIN_CONSUMED");
    outbox.setPayloadJson(jsonCodec.writeMap(outboxPayload));
    outbox.setStatus("pending");
    outbox.setAvailableAt(Instant.ofEpochMilli(now));
    syncOutboxRepository.save(outbox);

    return new WebCodeConsumeResponse(
        "success",
        "提交成功",
        payload.actionType().getCode(),
        payload.activityId(),
        activity.getActivityTitle(),
        recordId,
        now
    );
  }

  private void acquireReplayGuard(
      com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity user,
      String activityId,
      ActionType actionType,
      long slot,
      long now
  ) {
    WxReplayGuardEntity guard = new WxReplayGuardEntity();
    guard.setUser(user);
    guard.setActivityId(activityId);
    guard.setActionType(actionType.getCode());
    guard.setSlot(slot);
    long ttl = appProperties.getQr().getReplayKeyTtlSeconds();
    guard.setExpiresAt(Instant.ofEpochMilli(now + ttl * 1000L));
    try {
      replayGuardRepository.save(guard);
    } catch (DataIntegrityViolationException ex) {
      throw new BusinessException("duplicate", "当前时段已提交，请勿重复操作");
    }
  }

  private UserActivityState decideNextState(UserActivityState current, ActionType actionType) {
    if (actionType == ActionType.CHECKIN) {
      return switch (current) {
        case NONE -> UserActivityState.CHECKED_IN;
        case CHECKED_IN -> throw new BusinessException("duplicate", "你已签到，请勿重复提交");
        case CHECKED_OUT -> throw new BusinessException("forbidden", "当前状态不允许再次签到");
      };
    }
    return switch (current) {
      case NONE -> throw new BusinessException("forbidden", "请先完成签到再签退");
      case CHECKED_IN -> UserActivityState.CHECKED_OUT;
      case CHECKED_OUT -> throw new BusinessException("duplicate", "你已签退，请勿重复提交");
    };
  }

  private ResolvedConsumePayload resolveConsumePayload(
      String activityId,
      String actionTypeText,
      String code,
      Long userId,
      String clientIp
  ) {
    String normalizedCode = normalize(code);
    if (normalizedCode.isEmpty()) {
      throw new BusinessException("invalid_param", "code 参数缺失");
    }
    ActionType actionType = ActionType.fromCode(actionTypeText);
    if (actionType == null) {
      throw new BusinessException("invalid_param", "action_type 仅支持 checkin/checkout");
    }
    String normalizedActivityId = normalize(activityId);
    if (normalizedActivityId.isEmpty()) {
      throw new BusinessException("invalid_param", "activity_id 参数缺失");
    }

    DynamicCodeService.ValidatedCode validatedCode;
    try {
      validatedCode = dynamicCodeService.validateCode(
          normalizedActivityId,
          actionType,
          normalizedCode
      );
    } catch (BusinessException ex) {
      // 只有“验码失败”才计入限流；其它业务错误（未报名/状态不允许等）不在这里做次数累加。
      if (isCodeValidationFailure(ex)) {
        invalidCodeAttemptLimiter.recordInvalidAttemptOrThrow(userId, normalizedActivityId, clientIp);
      }
      throw ex;
    }

    return new ResolvedConsumePayload(
        normalizedActivityId,
        actionType,
        validatedCode.slot(),
        normalizedCode,
        validatedCode.rawPayload(),
        false
    );
  }

  private boolean isCodeValidationFailure(BusinessException ex) {
    if (ex == null) {
      return false;
    }
    String status = normalize(ex.getStatus()).toLowerCase();
    String code = normalize(ex.getErrorCode()).toLowerCase();
    return "invalid_code".equals(status) || "expired".equals(status) || "invalid_code".equals(code) || "expired".equals(code);
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private record ResolvedConsumePayload(
      String activityId,
      ActionType actionType,
      long slot,
      String nonce,
      String rawPayload,
      boolean inGraceWindow
  ) {}
}
