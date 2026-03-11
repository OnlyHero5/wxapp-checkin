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
  private final DynamicCodeService dynamicCodeService;

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
      Clock clock,
      DynamicCodeService dynamicCodeService
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
    this.dynamicCodeService = dynamicCodeService;
  }

  @Transactional
  public ConsumeCheckinResponse consume(ConsumeCheckinRequest request) {
    SessionPrincipal principal = sessionService.requireWebPrincipal(request.sessionToken());
    if (principal.role() != RoleType.NORMAL) {
      throw new BusinessException("forbidden", "仅普通用户可扫码签到/签退");
    }

    ResolvedConsumePayload payload = resolveConsumePayload(request);

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

    return new ConsumeCheckinResponse(
        "success",
        "提交成功",
        payload.actionType().getCode(),
        payload.activityId(),
        activity.getActivityTitle(),
        recordId,
        payload.inGraceWindow(),
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

  private ResolvedConsumePayload resolveConsumePayload(ConsumeCheckinRequest request) {
    String code = normalize(request.code());
    if (!code.isEmpty()) {
      ActionType actionType = ActionType.fromCode(request.actionType());
      if (actionType == null) {
        throw new BusinessException("invalid_param", "action_type 仅支持 checkin/checkout");
      }
      String activityId = normalize(request.activityId());
      if (activityId.isEmpty()) {
        throw new BusinessException("invalid_param", "activity_id 参数缺失");
      }
      DynamicCodeService.ValidatedCode validatedCode = dynamicCodeService.validateCode(activityId, actionType, code);
      return new ResolvedConsumePayload(
          activityId,
          actionType,
          validatedCode.slot(),
          code,
          validatedCode.rawPayload(),
          false
      );
    }

    ParsedQrPayload parsed = qrPayloadCodec.parse(extractPayload(request));
    validateRedundantFields(request, parsed);

    int rotateSeconds = parsedRotateSeconds(parsed.activityId());
    int graceSeconds = parsedGraceSeconds(parsed.activityId());
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

    return new ResolvedConsumePayload(
        parsed.activityId(),
        parsed.actionType(),
        parsed.slot(),
        parsed.nonce(),
        parsed.rawPayload(),
        now > displayExpireAt
    );
  }

  private int parsedRotateSeconds(String activityId) {
    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(activityId)
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));
    return (activity.getRotateSeconds() == null || activity.getRotateSeconds() <= 0)
        ? appProperties.getQr().getDefaultRotateSeconds() : activity.getRotateSeconds();
  }

  private int parsedGraceSeconds(String activityId) {
    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(activityId)
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));
    return (activity.getGraceSeconds() == null || activity.getGraceSeconds() <= 0)
        ? appProperties.getQr().getDefaultGraceSeconds() : activity.getGraceSeconds();
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
