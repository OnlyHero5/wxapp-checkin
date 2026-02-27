package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Relays pending outbox events to legacy tables.
 */
@Service
@ConditionalOnProperty(name = "app.sync.scheduler-enabled", havingValue = "true", matchIfMissing = true)
public class OutboxRelayService {
  private static final Logger log = LoggerFactory.getLogger(OutboxRelayService.class);

  private final AppProperties appProperties;
  private final WxSyncOutboxRepository outboxRepository;
  private final WxUserAuthExtRepository userRepository;
  private final WxActivityProjectionRepository activityRepository;
  private final JdbcTemplate jdbcTemplate;
  private final JsonCodec jsonCodec;
  private final Clock clock;

  public OutboxRelayService(
      AppProperties appProperties,
      WxSyncOutboxRepository outboxRepository,
      WxUserAuthExtRepository userRepository,
      WxActivityProjectionRepository activityRepository,
      @Qualifier("legacyJdbcTemplate") JdbcTemplate jdbcTemplate,
      JsonCodec jsonCodec,
      Clock clock
  ) {
    this.appProperties = appProperties;
    this.outboxRepository = outboxRepository;
    this.userRepository = userRepository;
    this.activityRepository = activityRepository;
    this.jdbcTemplate = jdbcTemplate;
    this.jsonCodec = jsonCodec;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${app.sync.outbox.relay-interval-ms:10000}")
  @Transactional
  public void relayToLegacy() {
    if (!appProperties.getSync().getOutbox().isEnabled()) {
      return;
    }
    List<WxSyncOutboxEntity> events;
    try {
      events = outboxRepository
          .findTop100ByStatusAndAvailableAtLessThanEqualOrderByIdAsc("pending", Instant.now(clock));
    } catch (DataAccessException ex) {
      log.debug("Outbox relay skipped due to extension DB access error: {}", ex.getMessage());
      return;
    }
    for (WxSyncOutboxEntity event : events) {
      relayOne(event);
    }
  }

  private void relayOne(WxSyncOutboxEntity event) {
    try {
      Map<String, Object> payload = jsonCodec.readMap(event.getPayloadJson());
      Long userId = toLong(payload.get("user_id"));
      String activityId = toString(payload.get("activity_id"));
      String actionType = toString(payload.get("action_type"));
      if (userId == null || activityId.isBlank() || actionType.isBlank()) {
        mark(event, "failed");
        return;
      }

      var user = userRepository.findById(userId).orElse(null);
      var activity = activityRepository.findById(activityId).orElse(null);
      if (user == null || user.getLegacyUserId() == null || activity == null || activity.getLegacyActivityId() == null) {
        mark(event, "skipped");
        return;
      }

      String username = resolveLegacyUsername(user.getLegacyUserId());
      if (username.isBlank()) {
        mark(event, "skipped");
        return;
      }

      if ("checkin".equalsIgnoreCase(actionType)) {
        jdbcTemplate.update(
            "UPDATE suda_activity_apply SET check_in = b'1', check_out = b'0' WHERE activity_id = ? AND username = ?",
            activity.getLegacyActivityId(),
            username
        );
      } else {
        jdbcTemplate.update(
            "UPDATE suda_activity_apply SET check_in = b'1', check_out = b'1' WHERE activity_id = ? AND username = ?",
            activity.getLegacyActivityId(),
            username
        );
      }
      mark(event, "processed");
    } catch (DataAccessException ex) {
      log.debug("Outbox relay skipped due to legacy access error: {}", ex.getMessage());
      mark(event, "failed");
    } catch (Exception ex) {
      log.warn("Outbox relay failed for id={}", event.getId(), ex);
      mark(event, "failed");
    }
  }

  private String resolveLegacyUsername(Long legacyUserId) {
    try {
      List<String> result = jdbcTemplate.query(
          "SELECT username FROM suda_user WHERE id = ? LIMIT 1",
          (rs, rowNum) -> rs.getString("username"),
          legacyUserId
      );
      return result.stream().findFirst().orElse("");
    } catch (DataAccessException ex) {
      return "";
    }
  }

  private void mark(WxSyncOutboxEntity event, String status) {
    event.setStatus(status);
    event.setProcessedAt(Instant.now(clock));
    outboxRepository.save(event);
  }

  private Long toLong(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof Number number) {
      return number.longValue();
    }
    try {
      return Long.parseLong(String.valueOf(value));
    } catch (NumberFormatException ex) {
      return null;
    }
  }

  private String toString(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }
}
