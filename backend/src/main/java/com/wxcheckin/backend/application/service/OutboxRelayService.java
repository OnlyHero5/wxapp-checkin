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

  // 指数退避重试：避免 legacy 短暂不可用时把事件永久标记为 failed，造成长期脏数据。
  private static final int MAX_RETRY_COUNT = 10;
  private static final long BASE_RETRY_DELAY_SECONDS = 2;
  private static final long MAX_RETRY_DELAY_SECONDS = 300;

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
      // 兼容历史数据：旧实现会把事件标记为 failed/skipped 且不再重试。
      events = outboxRepository.findTop100ByStatusInAndAvailableAtLessThanEqualOrderByIdAsc(
          List.of("pending", "failed", "skipped"),
          Instant.now(clock)
      );
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
      String recordId = toString(payload.get("record_id"));
      Long userId = toLong(payload.get("user_id"));
      String activityId = toString(payload.get("activity_id"));
      String actionType = toString(payload.get("action_type"));
      if (userId == null || activityId.isBlank() || actionType.isBlank()) {
        // payload 缺关键字段属于不可恢复错误，直接标记为终态。
        markTerminal(event, "dead");
        return;
      }

      var user = userRepository.findById(userId).orElse(null);
      var activity = activityRepository.findById(activityId).orElse(null);
      if (user == null || user.getLegacyUserId() == null || activity == null || activity.getLegacyActivityId() == null) {
        scheduleRetry(event);
        return;
      }

      String username = resolveLegacyUsername(user.getLegacyUserId());
      if (username.isBlank()) {
        scheduleRetry(event);
        return;
      }

      Integer legacyActivityId = activity.getLegacyActivityId();

      int updated;
      if ("checkin".equalsIgnoreCase(actionType)) {
        updated = jdbcTemplate.update(
            "UPDATE suda_activity_apply SET check_in = 1, check_out = 0 WHERE activity_id = ? AND username = ?",
            legacyActivityId,
            username
        );
      } else if ("checkout".equalsIgnoreCase(actionType)) {
        updated = jdbcTemplate.update(
            "UPDATE suda_activity_apply SET check_in = 1, check_out = 1 WHERE activity_id = ? AND username = ?",
            legacyActivityId,
            username
        );
      } else {
        // action_type 非预期值属于不可恢复错误：不应回写 legacy。
        markTerminal(event, "dead");
        return;
      }

      if (updated == 0) {
        // MySQL/ConnectorJ 的“受影响行数”语义可能返回“实际变更行数”而非“匹配行数”，
        // 因此 UPDATE 0 行不一定代表记录不存在（也可能是值本来就已是目标值）。
        //
        // 为避免“legacy 缺报名行时仍误标 processed”的静默不一致：
        // - 若确认 legacy 存在该报名行：仍视为已同步；
        // - 若确认不存在：事件标记为 dead，要求人工修复数据或排查口径问题。
        if (!legacyApplyRowExists(legacyActivityId, username)) {
          log.warn(
              "Outbox relay dead because legacy apply row missing: id={}, record_id={}, user_id={}, activity_id={}, legacy_activity_id={}, username={}, action_type={}",
              event.getId(),
              recordId,
              userId,
              activityId,
              legacyActivityId,
              username,
              actionType
          );
          markTerminal(event, "dead");
          return;
        }
      }
      markTerminal(event, "processed");
    } catch (DataAccessException ex) {
      log.debug("Outbox relay skipped due to legacy access error: {}", ex.getMessage());
      scheduleRetry(event);
    } catch (Exception ex) {
      log.warn("Outbox relay failed for id={}", event.getId(), ex);
      markTerminal(event, "dead");
    }
  }

  private boolean legacyApplyRowExists(Integer legacyActivityId, String username) {
    if (legacyActivityId == null || username == null || username.isBlank()) {
      return false;
    }
    List<Integer> result = jdbcTemplate.query(
        "SELECT 1 FROM suda_activity_apply WHERE activity_id = ? AND username = ? LIMIT 1",
        (rs, rowNum) -> rs.getInt(1),
        legacyActivityId,
        username
    );
    return !result.isEmpty();
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

  private void markTerminal(WxSyncOutboxEntity event, String status) {
    event.setStatus(status);
    event.setProcessedAt(Instant.now(clock));
    outboxRepository.save(event);
  }

  private void scheduleRetry(WxSyncOutboxEntity event) {
    Integer current = event.getRetryCount();
    int next = (current == null ? 0 : current) + 1;
    if (next > MAX_RETRY_COUNT) {
      event.setRetryCount(next);
      markTerminal(event, "dead");
      return;
    }

    long delaySeconds = computeBackoffSeconds(next);
    Instant now = Instant.now(clock);
    event.setRetryCount(next);
    // 仍然用 pending 表示“可重试”，由 available_at 控制“何时可再次执行”。
    event.setStatus("pending");
    event.setAvailableAt(now.plusSeconds(delaySeconds));
    event.setProcessedAt(now);
    outboxRepository.save(event);
  }

  private long computeBackoffSeconds(int retryCount) {
    // retryCount 从 1 开始：2,4,8,... 秒；上限 300 秒。
    int safeExp = Math.max(0, Math.min(retryCount - 1, 30));
    long delay = BASE_RETRY_DELAY_SECONDS * (1L << safeExp);
    return Math.min(delay, MAX_RETRY_DELAY_SECONDS);
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
