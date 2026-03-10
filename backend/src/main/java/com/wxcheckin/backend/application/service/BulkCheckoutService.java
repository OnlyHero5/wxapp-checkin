package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.WebBulkCheckoutResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.domain.model.UserActivityState;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxCheckinEventEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxCheckinEventRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BulkCheckoutService {

  private final SessionService sessionService;
  private final WxActivityProjectionRepository activityRepository;
  private final WxUserActivityStatusRepository statusRepository;
  private final WxCheckinEventRepository checkinEventRepository;
  private final WxSyncOutboxRepository syncOutboxRepository;
  private final TokenGenerator tokenGenerator;
  private final JsonCodec jsonCodec;
  private final Clock clock;

  public BulkCheckoutService(
      SessionService sessionService,
      WxActivityProjectionRepository activityRepository,
      WxUserActivityStatusRepository statusRepository,
      WxCheckinEventRepository checkinEventRepository,
      WxSyncOutboxRepository syncOutboxRepository,
      TokenGenerator tokenGenerator,
      JsonCodec jsonCodec,
      Clock clock
  ) {
    this.sessionService = sessionService;
    this.activityRepository = activityRepository;
    this.statusRepository = statusRepository;
    this.checkinEventRepository = checkinEventRepository;
    this.syncOutboxRepository = syncOutboxRepository;
    this.tokenGenerator = tokenGenerator;
    this.jsonCodec = jsonCodec;
    this.clock = clock;
  }

  @Transactional
  public WebBulkCheckoutResponse bulkCheckout(
      String sessionToken,
      String browserBindingKey,
      String activityId,
      Boolean confirm,
      String reason
  ) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken, browserBindingKey);
    if (principal.role() != RoleType.STAFF) {
      throw new BusinessException("forbidden", "仅工作人员可执行批量签退");
    }
    if (!Boolean.TRUE.equals(confirm)) {
      throw new BusinessException("invalid_param", "批量签退必须显式确认");
    }
    String normalizedActivityId = normalize(activityId);
    if (normalizedActivityId.isEmpty()) {
      throw new BusinessException("invalid_param", "activity_id 参数缺失");
    }
    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(normalizedActivityId)
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));

    List<WxUserActivityStatusEntity> targets = statusRepository.lockByActivityIdAndStatus(
        normalizedActivityId,
        UserActivityState.CHECKED_IN.getCode()
    );
    long now = Instant.now(clock).toEpochMilli();
    String batchId = "batch_" + tokenGenerator.newNonce();
    int affectedCount = 0;

    // 批量签退不是单纯改状态，还要补事件与 outbox，
    // 否则本地投影和 legacy 同步会出现“人数变了，但历史流水没记”的断层。
    for (WxUserActivityStatusEntity target : targets) {
      if (target.getUser() == null) {
        continue;
      }
      target.setStatus(UserActivityState.CHECKED_OUT.getCode());
      affectedCount += 1;

      String recordId = tokenGenerator.newRecordId();
      WxCheckinEventEntity event = new WxCheckinEventEntity();
      event.setRecordId(recordId);
      event.setUser(target.getUser());
      event.setActivityId(normalizedActivityId);
      event.setActionType("checkout");
      event.setSlot(now / 1000L);
      event.setNonce("bulk:" + batchId);
      event.setInGraceWindow(false);
      event.setSubmittedAt(Instant.ofEpochMilli(now));
      event.setServerTime(now);
      event.setQrPayload("bulk-checkout:" + batchId);
      checkinEventRepository.save(event);

      Map<String, Object> outboxPayload = new HashMap<>();
      outboxPayload.put("record_id", recordId);
      outboxPayload.put("user_id", target.getUser().getId());
      outboxPayload.put("activity_id", normalizedActivityId);
      outboxPayload.put("action_type", "checkout");
      outboxPayload.put("slot", now / 1000L);
      outboxPayload.put("nonce", "bulk:" + batchId);
      outboxPayload.put("server_time", now);

      WxSyncOutboxEntity outbox = new WxSyncOutboxEntity();
      outbox.setAggregateType("checkin_event");
      outbox.setAggregateId(recordId);
      outbox.setEventType("CHECKIN_CONSUMED");
      outbox.setPayloadJson(jsonCodec.writeMap(outboxPayload));
      outbox.setStatus("pending");
      outbox.setAvailableAt(Instant.ofEpochMilli(now));
      syncOutboxRepository.save(outbox);
    }

    statusRepository.saveAll(targets);
    if (affectedCount > 0) {
      // 这里改走数据库原子增减，避免继续沿用读后写统计导致计数丢失。
      activityRepository.adjustCounts(normalizedActivityId, -affectedCount, affectedCount);
    }

    return new WebBulkCheckoutResponse(
        "success",
        affectedCount > 0 ? "批量签退完成" : "当前无需批量签退",
        activity.getActivityId(),
        affectedCount,
        batchId,
        now
    );
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }
}
