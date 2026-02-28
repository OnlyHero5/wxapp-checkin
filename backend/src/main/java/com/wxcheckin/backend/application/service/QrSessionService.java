package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.CreateQrSessionResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.QrNonceSigner;
import com.wxcheckin.backend.application.support.QrPayloadCodec;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.ActionType;
import com.wxcheckin.backend.domain.model.ActivityProgressStatus;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxQrIssueLogEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxQrIssueLogRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implements A-05 staff QR ticket issuance.
 */
@Service
public class QrSessionService {

  private final SessionService sessionService;
  private final WxActivityProjectionRepository activityRepository;
  private final WxQrIssueLogRepository qrIssueLogRepository;
  private final TokenGenerator tokenGenerator;
  private final QrPayloadCodec qrPayloadCodec;
  private final QrNonceSigner qrNonceSigner;
  private final AppProperties appProperties;
  private final Clock clock;
  private final JdbcTemplate legacyJdbcTemplate;

  public QrSessionService(
      SessionService sessionService,
      WxActivityProjectionRepository activityRepository,
      WxQrIssueLogRepository qrIssueLogRepository,
      TokenGenerator tokenGenerator,
      QrPayloadCodec qrPayloadCodec,
      QrNonceSigner qrNonceSigner,
      AppProperties appProperties,
      Clock clock,
      @Qualifier("legacyJdbcTemplate") JdbcTemplate legacyJdbcTemplate
  ) {
    this.sessionService = sessionService;
    this.activityRepository = activityRepository;
    this.qrIssueLogRepository = qrIssueLogRepository;
    this.tokenGenerator = tokenGenerator;
    this.qrPayloadCodec = qrPayloadCodec;
    this.qrNonceSigner = qrNonceSigner;
    this.appProperties = appProperties;
    this.clock = clock;
    this.legacyJdbcTemplate = legacyJdbcTemplate;
  }

  @Transactional
  public CreateQrSessionResponse issue(
      String sessionToken,
      String activityId,
      String actionTypeText,
      Integer rotateSecondsOverride,
      Integer graceSecondsOverride
  ) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken);
    if (principal.role() != RoleType.STAFF) {
      throw new BusinessException("forbidden", "仅工作人员可获取二维码配置");
    }

    String normalizedActivityId = normalize(activityId);
    if (normalizedActivityId.isEmpty()) {
      throw new BusinessException("invalid_param", "activity_id 参数缺失");
    }

    ActionType actionType = ActionType.fromCode(actionTypeText);
    if (actionType == null) {
      throw new BusinessException("invalid_param", "action_type 仅支持 checkin/checkout");
    }

    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(normalizedActivityId)
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));

    if (ActivityProgressStatus.fromCode(activity.getProgressStatus()) == ActivityProgressStatus.COMPLETED) {
      throw new BusinessException("forbidden", "活动已结束，无法生成二维码");
    }
    if (actionType == ActionType.CHECKOUT && !Boolean.TRUE.equals(activity.getSupportCheckout())) {
      throw new BusinessException("forbidden", "该活动暂不支持签退二维码");
    }

    ensureWithinIssueWindow(activity);

    int rotateSeconds = resolveSeconds(
        rotateSecondsOverride,
        activity.getRotateSeconds(),
        appProperties.getQr().getDefaultRotateSeconds()
    );
    int graceSeconds = resolveSeconds(
        graceSecondsOverride,
        activity.getGraceSeconds(),
        appProperties.getQr().getDefaultGraceSeconds()
    );

    boolean overrideApplied = false;
    if (rotateSecondsOverride != null && rotateSecondsOverride > 0
        && !rotateSecondsOverride.equals(activity.getRotateSeconds())) {
      activity.setRotateSeconds(rotateSeconds);
      overrideApplied = true;
    }
    if (graceSecondsOverride != null && graceSecondsOverride > 0
        && !graceSecondsOverride.equals(activity.getGraceSeconds())) {
      activity.setGraceSeconds(graceSeconds);
      overrideApplied = true;
    }
    if (overrideApplied) {
      activityRepository.save(activity);
    }

    long serverTime = Instant.now(clock).toEpochMilli();
    long slot = serverTime / (rotateSeconds * 1000L);
    long displayStartAt = slot * rotateSeconds * 1000L;
    long displayExpireAt = displayStartAt + rotateSeconds * 1000L;
    long acceptExpireAt = displayExpireAt + graceSeconds * 1000L;

    String randomPart = tokenGenerator.newNonce();
    String nonce = qrNonceSigner.sign(normalizedActivityId, actionType, slot, randomPart);
    String qrPayload = qrPayloadCodec.encode(normalizedActivityId, actionType, slot, nonce);

    if (appProperties.getQr().isIssueLogEnabled()) {
      WxQrIssueLogEntity log = new WxQrIssueLogEntity();
      log.setActivityId(normalizedActivityId);
      log.setActionType(actionType.getCode());
      log.setSlot(slot);
      log.setNonce(nonce);
      log.setQrPayload(qrPayload);
      log.setDisplayExpireAt(displayExpireAt);
      log.setAcceptExpireAt(acceptExpireAt);
      log.setIssuedByUser(principal.user());
      qrIssueLogRepository.save(log);
    }

    return new CreateQrSessionResponse(
        "success",
        "二维码签发成功",
        normalizedActivityId,
        actionType.getCode(),
        qrPayload,
        slot,
        nonce,
        rotateSeconds,
        graceSeconds,
        displayExpireAt,
        acceptExpireAt,
        serverTime
    );
  }

  private int resolveSeconds(Integer overrideValue, Integer activityValue, int defaultValue) {
    if (overrideValue != null && overrideValue > 0) {
      return overrideValue;
    }
    if (activityValue != null && activityValue > 0) {
      return activityValue;
    }
    return defaultValue;
  }

  private String normalize(String text) {
    return text == null ? "" : text.trim();
  }

  private void ensureWithinIssueWindow(WxActivityProjectionEntity activity) {
    Instant startTime = activity.getStartTime();
    Instant endTime = activity.getEndTime();
    Integer legacyActivityId = activity.getLegacyActivityId();
    boolean looksPlaceholder = legacyActivityId != null && startTime != null && startTime.equals(endTime);
    if (legacyActivityId != null && (looksPlaceholder || startTime == null || endTime == null || endTime.isBefore(startTime))) {
      LegacyTime legacyTime = queryLegacyTime(legacyActivityId);
      if (legacyTime != null) {
        startTime = legacyTime.startTime;
        endTime = legacyTime.endTime;
        activity.setStartTime(startTime);
        activity.setEndTime(endTime);
        activityRepository.save(activity);
      }
    }
    if (startTime == null || endTime == null || endTime.isBefore(startTime)) {
      throw new BusinessException("failed", "活动时间信息异常，无法生成二维码", "activity_time_invalid");
    }

    Instant now = Instant.now(clock);
    Instant allowedFrom = startTime.minus(Duration.ofMinutes(30));
    Instant allowedUntil = endTime.plus(Duration.ofMinutes(30));
    if (now.isBefore(allowedFrom) || now.isAfter(allowedUntil)) {
      throw new BusinessException(
          "forbidden",
          "仅可在活动开始前30分钟到结束后30分钟内生成二维码",
          "outside_activity_time_window"
      );
    }
  }

  private LegacyTime queryLegacyTime(Integer legacyActivityId) {
    try {
      List<LegacyTime> result = legacyJdbcTemplate.query(
          "SELECT activity_stime, activity_etime FROM suda_activity WHERE id = ? LIMIT 1",
          (rs, rowNum) -> {
            Instant start = rs.getTimestamp("activity_stime").toInstant();
            Instant end = rs.getTimestamp("activity_etime").toInstant();
            return new LegacyTime(start, end);
          },
          legacyActivityId
      );
      return result.stream().findFirst().orElse(null);
    } catch (DataAccessException | NullPointerException ex) {
      return null;
    }
  }

  private record LegacyTime(Instant startTime, Instant endTime) {}
}
