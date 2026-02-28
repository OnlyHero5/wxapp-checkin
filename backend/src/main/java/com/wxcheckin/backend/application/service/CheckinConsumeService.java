package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.ConsumeCheckinRequest;
import com.wxcheckin.backend.api.dto.ConsumeCheckinResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.ParsedQrPayload;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.application.support.QrNonceSigner;
import com.wxcheckin.backend.application.support.QrPayloadCodec;
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
import com.wxcheckin.backend.infrastructure.persistence.repository.WxQrIssueLogRepository;
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
 * Implements A-06 consume logic.
 */
@Service
public class CheckinConsumeService {

  private final SessionService sessionService;
  private final QrPayloadCodec qrPayloadCodec;
  private final WxActivityProjectionRepository activityRepository;
  private final WxUserActivityStatusRepository statusRepository;
  private final WxReplayGuardRepository replayGuardRepository;
  private final WxCheckinEventRepository checkinEventRepository;
  private final WxQrIssueLogRepository qrIssueLogRepository;
  private final WxSyncOutboxRepository syncOutboxRepository;
  private final TokenGenerator tokenGenerator;
  private final JsonCodec jsonCodec;
  private final QrNonceSigner qrNonceSigner;
  private final AppProperties appProperties;
  private final Clock clock;

  public CheckinConsumeService(
      SessionService sessionService,
      QrPayloadCodec qrPayloadCodec,
      WxActivityProjectionRepository activityRepository,
      WxUserActivityStatusRepository statusRepository,
      WxReplayGuardRepository replayGuardRepository,
      WxCheckinEventRepository checkinEventRepository,
      WxQrIssueLogRepository qrIssueLogRepository,
      WxSyncOutboxRepository syncOutboxRepository,
      TokenGenerator tokenGenerator,
      JsonCodec jsonCodec,
      QrNonceSigner qrNonceSigner,
      AppProperties appProperties,
      Clock clock
  ) {
    this.sessionService = sessionService;
    this.qrPayloadCodec = qrPayloadCodec;
    this.activityRepository = activityRepository;
    this.statusRepository = statusRepository;
    this.replayGuardRepository = replayGuardRepository;
    this.checkinEventRepository = checkinEventRepository;
    this.qrIssueLogRepository = qrIssueLogRepository;
    this.syncOutboxRepository = syncOutboxRepository;
    this.tokenGenerator = tokenGenerator;
    this.jsonCodec = jsonCodec;
    this.qrNonceSigner = qrNonceSigner;
    this.appProperties = appProperties;
    this.clock = clock;
  }

  @Transactional
  public ConsumeCheckinResponse consume(ConsumeCheckinRequest request) {
    SessionPrincipal principal = sessionService.requirePrincipal(request.sessionToken());
    if (principal.role() != RoleType.NORMAL) {
      throw new BusinessException("forbidden", "仅普通用户可扫码签到/签退");
    }

    ParsedQrPayload parsed = qrPayloadCodec.parse(extractPayload(request));
    validateRedundantFields(request, parsed);

    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(parsed.activityId())
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));
    if (ActivityProgressStatus.fromCode(activity.getProgressStatus()) == ActivityProgressStatus.COMPLETED) {
      throw new BusinessException("forbidden", "活动已结束，无法再签到/签退");
    }
    if (parsed.actionType() == ActionType.CHECKOUT && !Boolean.TRUE.equals(activity.getSupportCheckout())) {
      throw new BusinessException("forbidden", "该活动暂不支持签退");
    }

    int rotateSeconds = (activity.getRotateSeconds() == null || activity.getRotateSeconds() <= 0)
        ? appProperties.getQr().getDefaultRotateSeconds() : activity.getRotateSeconds();
    int graceSeconds = (activity.getGraceSeconds() == null || activity.getGraceSeconds() <= 0)
        ? appProperties.getQr().getDefaultGraceSeconds() : activity.getGraceSeconds();

    long now = Instant.now(clock).toEpochMilli();
    long displayStartAt = parsed.slot() * rotateSeconds * 1000L;
    long displayExpireAt = displayStartAt + rotateSeconds * 1000L;
    long acceptExpireAt = displayExpireAt + graceSeconds * 1000L;
    if (now < displayStartAt) {
      throw new BusinessException("invalid_qr", "二维码时间异常，请重新扫码");
    }
    if (now > acceptExpireAt) {
      throw new BusinessException("expired", "二维码已过期，请重新获取");
    }

    if (qrNonceSigner.isSigned(parsed.nonce())) {
      if (!qrNonceSigner.verify(parsed.activityId(), parsed.actionType(), parsed.slot(), parsed.nonce())) {
        throw new BusinessException("invalid_qr", "二维码无法识别，请重新扫码");
      }
    } else {
      if (!appProperties.getQr().isAllowLegacyUnsigned()) {
        throw new BusinessException("invalid_qr", "二维码无法识别，请重新扫码");
      }
      boolean issueExists = qrIssueLogRepository
          .existsByActivityIdAndActionTypeAndSlotAndNonce(
              parsed.activityId(),
              parsed.actionType().getCode(),
              parsed.slot(),
              parsed.nonce()
          );
      if (!issueExists) {
        throw new BusinessException("invalid_qr", "二维码无法识别，请重新扫码");
      }
    }

    acquireReplayGuard(principal.user(), parsed, acceptExpireAt);

    WxUserActivityStatusEntity status = statusRepository
        .lockByUserIdAndActivityId(principal.user().getId(), parsed.activityId())
        .orElseThrow(() -> new BusinessException("forbidden", "你未报名该活动，无法签到/签退"));
    if (!Boolean.TRUE.equals(status.getRegistered())) {
      throw new BusinessException("forbidden", "你未报名该活动，无法签到/签退");
    }

    UserActivityState currentState = UserActivityState.fromCode(status.getStatus());
    UserActivityState nextState = decideNextState(currentState, parsed.actionType());
    status.setStatus(nextState.getCode());
    statusRepository.save(status);

    int checkinCount = activity.getCheckinCount() == null ? 0 : activity.getCheckinCount();
    int checkoutCount = activity.getCheckoutCount() == null ? 0 : activity.getCheckoutCount();
    if (parsed.actionType() == ActionType.CHECKIN) {
      checkinCount += 1;
    } else {
      checkinCount = Math.max(0, checkinCount - 1);
      checkoutCount += 1;
    }
    activity.setCheckinCount(checkinCount);
    activity.setCheckoutCount(checkoutCount);
    activityRepository.save(activity);

    String recordId = tokenGenerator.newRecordId();
    WxCheckinEventEntity event = new WxCheckinEventEntity();
    event.setRecordId(recordId);
    event.setUser(principal.user());
    event.setActivityId(parsed.activityId());
    event.setActionType(parsed.actionType().getCode());
    event.setSlot(parsed.slot());
    event.setNonce(parsed.nonce());
    event.setInGraceWindow(now > displayExpireAt);
    event.setSubmittedAt(Instant.ofEpochMilli(now));
    event.setServerTime(now);
    event.setQrPayload(parsed.rawPayload());
    checkinEventRepository.save(event);

    Map<String, Object> outboxPayload = new HashMap<>();
    outboxPayload.put("record_id", recordId);
    outboxPayload.put("user_id", principal.user().getId());
    outboxPayload.put("activity_id", parsed.activityId());
    outboxPayload.put("action_type", parsed.actionType().getCode());
    outboxPayload.put("slot", parsed.slot());
    outboxPayload.put("nonce", parsed.nonce());
    outboxPayload.put("server_time", now);

    WxSyncOutboxEntity outbox = new WxSyncOutboxEntity();
    outbox.setAggregateType("checkin_event");
    outbox.setAggregateId(recordId);
    outbox.setEventType("CHECKIN_CONSUMED");
    outbox.setPayloadJson(jsonCodec.writeMap(outboxPayload));
    outbox.setStatus("pending");
    outbox.setAvailableAt(Instant.ofEpochMilli(now));
    syncOutboxRepository.save(outbox);

    return new ConsumeCheckinResponse(
        "success",
        "提交成功",
        parsed.actionType().getCode(),
        parsed.activityId(),
        activity.getActivityTitle(),
        recordId,
        now > displayExpireAt,
        now
    );
  }

  private void acquireReplayGuard(
      com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity user,
      ParsedQrPayload parsed,
      long acceptExpireAt
  ) {
    WxReplayGuardEntity guard = new WxReplayGuardEntity();
    guard.setUser(user);
    guard.setActivityId(parsed.activityId());
    guard.setActionType(parsed.actionType().getCode());
    guard.setSlot(parsed.slot());
    long ttl = appProperties.getQr().getReplayKeyTtlSeconds();
    guard.setExpiresAt(Instant.ofEpochMilli(acceptExpireAt + ttl * 1000L));
    try {
      replayGuardRepository.save(guard);
    } catch (DataIntegrityViolationException ex) {
      throw new BusinessException("duplicate", "当前时段已提交，请勿重复扫码");
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

  private void validateRedundantFields(ConsumeCheckinRequest request, ParsedQrPayload parsed) {
    if (request.activityId() != null && !request.activityId().isBlank()
        && !request.activityId().trim().equals(parsed.activityId())) {
      throw new BusinessException("invalid_qr", "二维码数据不一致，请重新扫码");
    }
    if (request.actionType() != null && !request.actionType().isBlank()
        && !request.actionType().trim().equals(parsed.actionType().getCode())) {
      throw new BusinessException("invalid_qr", "二维码数据不一致，请重新扫码");
    }
    if (request.slot() != null && request.slot() != parsed.slot()) {
      throw new BusinessException("invalid_qr", "二维码数据不一致，请重新扫码");
    }
    if (request.nonce() != null && !request.nonce().isBlank()
        && !request.nonce().trim().equals(parsed.nonce())) {
      throw new BusinessException("invalid_qr", "二维码数据不一致，请重新扫码");
    }
  }

  private String extractPayload(ConsumeCheckinRequest request) {
    String direct = normalize(request.qrPayload());
    if (!direct.isEmpty()) {
      return direct;
    }
    String raw = normalize(request.rawResult());
    if (!raw.isEmpty()) {
      return raw;
    }
    String path = normalize(request.path());
    if (!path.isEmpty()) {
      return path;
    }
    throw new BusinessException("invalid_qr", "二维码无法识别，请重新扫码");
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }
}
