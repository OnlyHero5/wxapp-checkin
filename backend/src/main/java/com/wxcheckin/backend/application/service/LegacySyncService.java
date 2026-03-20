package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.ActivityProgressStatus;
import com.wxcheckin.backend.domain.model.UserActivityState;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pull-style synchronization from legacy schema to new projection tables.
 *
 * <p>This is intentionally best-effort and guarded by feature flags so deployment
 * can start without coupling startup health to legacy DB readiness.</p>
 */
@Service
@ConditionalOnProperty(name = "app.sync.scheduler-enabled", havingValue = "true", matchIfMissing = true)
public class LegacySyncService {
  private static final Logger log = LoggerFactory.getLogger(LegacySyncService.class);

  private final AppProperties appProperties;
  private final OutboxRelayService outboxRelayService;
  private final JdbcTemplate jdbcTemplate;
  private final WxActivityProjectionRepository activityRepository;
  private final WxUserAuthExtRepository userRepository;
  private final WxUserActivityStatusRepository statusRepository;

  public LegacySyncService(
      AppProperties appProperties,
      OutboxRelayService outboxRelayService,
      @Qualifier("legacyJdbcTemplate") JdbcTemplate jdbcTemplate,
      WxActivityProjectionRepository activityRepository,
      WxUserAuthExtRepository userRepository,
      WxUserActivityStatusRepository statusRepository
  ) {
    this.appProperties = appProperties;
    this.outboxRelayService = outboxRelayService;
    this.jdbcTemplate = jdbcTemplate;
    this.activityRepository = activityRepository;
    this.userRepository = userRepository;
    this.statusRepository = statusRepository;
  }

  @Scheduled(fixedDelayString = "${app.sync.legacy.pull-interval-ms:60000}")
  @Transactional
  public void syncFromLegacy() {
    if (!appProperties.getSync().getLegacy().isEnabled()) {
      return;
    }
    // 先 push(outbox) 再 pull(legacy)：
    // 避免出现“本地已写 checked_out，但 legacy 尚未落地时 pull 把状态回退为 checked_in”的一致性窗口。
    // 该问题在联调报告 2026-03-11（WX-SYNC-001）中有可复现证据。
    try {
      outboxRelayService.relayToLegacy();
    } catch (Exception ex) {
      // outbox relay 本身是 best-effort：失败时不应阻断 pull，但需要避免把异常放大成调度器告警。
      log.debug("Pre-pull outbox relay skipped: {}", ex.getMessage());
    }
    syncLegacyActivities();
    syncLegacyUserActivityStatus();
  }

  /**
   * 按用户即时同步（best-effort）。
   *
   * <p>用途：解决普通用户首次登录改密后的“活动列表空窗期”。
   * 该场景下用户会立即请求活动列表，但定时 pull 可能尚未跑到，导致 wx_user_activity_status 为空，
   * 从而活动列表返回空数组。</p>
   *
   * <p>策略：
   * - 只同步该 legacyUserId 相关的报名/状态（wx_user_activity_status）
   * - 并补齐其关联活动的投影（wx_activity_projection），避免 status 有了但活动投影缺失导致仍不可见</p>
   *
   * <p>注意：该方法必须可在 readOnly 事务内被调用，因此使用 REQUIRES_NEW 开启独立事务。</p>
   */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void syncLegacyUserContextOnDemand(Long legacyUserId) {
    if (!appProperties.getSync().getLegacy().isEnabled()) {
      return;
    }
    if (legacyUserId == null) {
      return;
    }

    WxUserAuthExtEntity user = userRepository.findByLegacyUserId(legacyUserId).orElse(null);
    if (user == null) {
      return;
    }

    final String sql = """
        SELECT
          aa.activity_id AS legacy_activity_id,
          aa.state AS apply_state,
          aa.check_in AS check_in,
          aa.check_out AS check_out
        FROM suda_activity_apply aa
        JOIN suda_user u ON u.username = aa.username
        WHERE u.id = ?
        """;

    try {
      List<LegacyApplyRow> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
        LegacyApplyRow row = new LegacyApplyRow();
        row.legacyUserId = legacyUserId;
        row.legacyActivityId = rs.getInt("legacy_activity_id");
        row.applyState = rs.getInt("apply_state");
        row.checkIn = toBoolean(rs.getObject("check_in"));
        row.checkOut = toBoolean(rs.getObject("check_out"));
        return row;
      }, legacyUserId);

      if (rows.isEmpty()) {
        return;
      }

      List<Integer> legacyActivityIds = rows.stream()
          .map(row -> row.legacyActivityId)
          .distinct()
          .toList();

      syncLegacyActivitiesByIds(legacyActivityIds);
      upsertUserStatus(user, rows);
    } catch (DataAccessException ex) {
      log.debug("On-demand legacy user sync skipped: {}", ex.getMessage());
    }
  }

  private void syncLegacyActivities() {
    // 说明：
    // 1) checkin_count / checkout_count 是给 Web 管理端展示用的统计值。
    // 2) 这里用 0/1 而不是 MySQL 专用的 b'1'/b'0' 字面量，便于在 H2(MySQL mode) 下跑集成测试。
    final String sql = """
        SELECT
          a.id,
          a.name,
	          a.description,
	          a.location,
	          a.activity_stime,
	          a.activity_etime,
	          a.type,
	          a.state,
	          -- registered_count 表示“报名成功/候补成功”的人数（即应到人数，具备签到/签退资格）。
	          COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS registered_count,
	          -- 关键口径：checkin_count 表示“已签到未签退”，否则会被 pull 周期性覆盖出不可能状态。
	          COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS checkin_count,
	          COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS checkout_count
	        FROM suda_activity a
	        LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
	        GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
	        """;

    try {
      List<LegacyActivityRow> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
        LegacyActivityRow row = new LegacyActivityRow();
        row.id = rs.getInt("id");
        row.name = rs.getString("name");
	        row.description = rs.getString("description");
	        row.location = rs.getString("location");
	        Timestamp start = rs.getTimestamp("activity_stime");
	        row.startTime = start == null ? Instant.now() : start.toInstant();
	        Timestamp end = rs.getTimestamp("activity_etime");
	        row.endTime = end == null ? row.startTime : end.toInstant();
	        row.type = rs.getInt("type");
	        row.state = rs.getInt("state");
	        row.registeredCount = rs.getInt("registered_count");
	        row.checkinCount = rs.getInt("checkin_count");
	        row.checkoutCount = rs.getInt("checkout_count");
	        return row;
	      });

      for (LegacyActivityRow row : rows) {
        String activityId = "legacy_act_" + row.id;
        WxActivityProjectionEntity entity = activityRepository.findById(activityId)
            .orElseGet(WxActivityProjectionEntity::new);
        entity.setActivityId(activityId);
        entity.setLegacyActivityId(row.id);
        entity.setActivityTitle(row.name);
	        entity.setActivityType(row.type == 1 ? "讲座" : "活动");
	        entity.setDescription(row.description);
	        entity.setLocation(row.location);
	        entity.setStartTime(row.startTime);
	        entity.setEndTime(row.endTime);
	        entity.setProgressStatus(row.state >= 4
	            ? ActivityProgressStatus.COMPLETED.getCode()
	            : ActivityProgressStatus.ONGOING.getCode());
        entity.setSupportCheckout(true);
        entity.setHasDetail(true);
        entity.setRegisteredCount(Math.max(0, row.registeredCount));
        entity.setCheckinCount(Math.max(0, row.checkinCount));
        entity.setCheckoutCount(Math.max(0, row.checkoutCount));
        entity.setActive(true);
        activityRepository.save(entity);
      }
    } catch (DataAccessException ex) {
      log.debug("Legacy activity sync skipped: {}", ex.getMessage());
    }
  }

  private void syncLegacyActivitiesByIds(List<Integer> legacyActivityIds) {
    if (legacyActivityIds == null || legacyActivityIds.isEmpty()) {
      return;
    }

    String placeholders = legacyActivityIds.stream().map(id -> "?").reduce((a, b) -> a + "," + b).orElse("");
    final String sql = """
        SELECT
          a.id,
          a.name,
          a.description,
          a.location,
          a.activity_stime,
          a.activity_etime,
          a.type,
          a.state,
          COALESCE(SUM(CASE WHEN aa.state IN (0, 2) THEN 1 ELSE 0 END), 0) AS registered_count,
          COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 0 THEN 1 ELSE 0 END), 0) AS checkin_count,
          COALESCE(SUM(CASE WHEN aa.check_in = 1 AND aa.check_out = 1 THEN 1 ELSE 0 END), 0) AS checkout_count
        FROM suda_activity a
        LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
        WHERE a.id IN (%s)
        GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.activity_etime, a.type, a.state
        """.formatted(placeholders);

    try {
      Object[] params = legacyActivityIds.toArray();
      List<LegacyActivityRow> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
        LegacyActivityRow row = new LegacyActivityRow();
        row.id = rs.getInt("id");
        row.name = rs.getString("name");
        row.description = rs.getString("description");
        row.location = rs.getString("location");
        Timestamp start = rs.getTimestamp("activity_stime");
        row.startTime = start == null ? Instant.now() : start.toInstant();
        Timestamp end = rs.getTimestamp("activity_etime");
        row.endTime = end == null ? row.startTime : end.toInstant();
        row.type = rs.getInt("type");
        row.state = rs.getInt("state");
        row.registeredCount = rs.getInt("registered_count");
        row.checkinCount = rs.getInt("checkin_count");
        row.checkoutCount = rs.getInt("checkout_count");
        return row;
      }, params);

      upsertActivities(rows);
    } catch (DataAccessException ex) {
      log.debug("On-demand legacy activity sync skipped: {}", ex.getMessage());
    }
  }

  private void upsertActivities(List<LegacyActivityRow> rows) {
    if (rows == null || rows.isEmpty()) {
      return;
    }
    for (LegacyActivityRow row : rows) {
      String activityId = "legacy_act_" + row.id;
      WxActivityProjectionEntity entity = activityRepository.findById(activityId)
          .orElseGet(WxActivityProjectionEntity::new);
      entity.setActivityId(activityId);
      entity.setLegacyActivityId(row.id);
      entity.setActivityTitle(row.name);
      entity.setActivityType(row.type == 1 ? "讲座" : "活动");
      entity.setDescription(row.description);
      entity.setLocation(row.location);
      entity.setStartTime(row.startTime);
      entity.setEndTime(row.endTime);
      entity.setProgressStatus(row.state >= 4
          ? ActivityProgressStatus.COMPLETED.getCode()
          : ActivityProgressStatus.ONGOING.getCode());
      entity.setSupportCheckout(true);
      entity.setHasDetail(true);
      entity.setRegisteredCount(Math.max(0, row.registeredCount));
      entity.setCheckinCount(Math.max(0, row.checkinCount));
      entity.setCheckoutCount(Math.max(0, row.checkoutCount));
      entity.setActive(true);
      activityRepository.save(entity);
    }
  }

  private void syncLegacyUserActivityStatus() {
    final String sql = """
        SELECT
          u.id AS legacy_user_id,
          aa.activity_id AS legacy_activity_id,
          aa.state AS apply_state,
          aa.check_in AS check_in,
          aa.check_out AS check_out
        FROM suda_activity_apply aa
        JOIN suda_user u ON u.username = aa.username
        """;

    try {
      List<LegacyApplyRow> rows = jdbcTemplate.query(sql, (rs, rowNum) -> {
        LegacyApplyRow row = new LegacyApplyRow();
        row.legacyUserId = rs.getLong("legacy_user_id");
        row.legacyActivityId = rs.getInt("legacy_activity_id");
        row.applyState = rs.getInt("apply_state");
        row.checkIn = toBoolean(rs.getObject("check_in"));
        row.checkOut = toBoolean(rs.getObject("check_out"));
        return row;
      });

      for (LegacyApplyRow row : rows) {
        WxUserAuthExtEntity user = userRepository.findByLegacyUserId(row.legacyUserId).orElse(null);
        if (user == null) {
          continue;
        }
        upsertUserStatus(user, List.of(row));
      }
    } catch (DataAccessException ex) {
      log.debug("Legacy user-status sync skipped: {}", ex.getMessage());
    }
  }

  private void upsertUserStatus(WxUserAuthExtEntity user, List<LegacyApplyRow> rows) {
    if (user == null || user.getId() == null || rows == null || rows.isEmpty()) {
      return;
    }
    for (LegacyApplyRow row : rows) {
      var activityOpt = activityRepository.findByLegacyActivityId(row.legacyActivityId);
      if (activityOpt.isEmpty()) {
        continue;
      }

      var activity = activityOpt.get();
      WxUserActivityStatusEntity status = statusRepository
          .findByUserIdAndActivityId(user.getId(), activity.getActivityId())
          .orElseGet(WxUserActivityStatusEntity::new);
      applyLegacyStatus(status, user, activity.getActivityId(), row);
      try {
        statusRepository.save(status);
      } catch (DataIntegrityViolationException ex) {
        // on-demand sync 与定时 pull 可能并发写同一 `(user, activity)` 状态行。
        // 如果当前事务在“先查后插”窗口里撞上唯一键，不应让整轮同步回滚；
        // 这里退回到“重读现有行并补写字段”，保证同步幂等收敛。
        WxUserActivityStatusEntity existingStatus = statusRepository
            .findByUserIdAndActivityId(user.getId(), activity.getActivityId())
            .orElseThrow(() -> ex);
        applyLegacyStatus(existingStatus, user, activity.getActivityId(), row);
        statusRepository.save(existingStatus);
      }
    }
  }

  private void applyLegacyStatus(
      WxUserActivityStatusEntity status,
      WxUserAuthExtEntity user,
      String activityId,
      LegacyApplyRow row
  ) {
    status.setUser(user);
    status.setActivityId(activityId);
    status.setRegistered(isRegisteredApplyState(row.applyState));

    if (row.checkIn) {
      // Legacy convention: check_out=1 means already checked out, 0 means not yet checked out.
      status.setStatus(row.checkOut ? UserActivityState.CHECKED_OUT.getCode() : UserActivityState.CHECKED_IN.getCode());
    } else {
      status.setStatus(UserActivityState.NONE.getCode());
    }
  }

  private boolean toBoolean(Object raw) {
    if (raw == null) {
      return false;
    }
    if (raw instanceof Boolean value) {
      return value;
    }
    if (raw instanceof Number number) {
      return number.intValue() != 0;
    }
    if (raw instanceof byte[] bytes && bytes.length > 0) {
    return bytes[0] != 0;
  }
  return "1".equals(String.valueOf(raw));
  }

  private boolean isRegisteredApplyState(int applyState) {
    // 报名资格必须严格对齐 legacy（suda_union）口径：
    // - 0：报名成功
    // - 2：候补成功
    // 其它状态（候补中/候补失败/补报名待审核/拒绝等）均不应视为“已报名可签到”。
    return applyState == 0 || applyState == 2;
  }

	  private static class LegacyActivityRow {
	    int id;
	    String name;
	    String description;
	    String location;
	    Instant startTime;
	    Instant endTime;
	    int type;
	    int state;
	    int registeredCount;
	    int checkinCount;
	    int checkoutCount;
	  }

  private static class LegacyApplyRow {
    long legacyUserId;
    int legacyActivityId;
    int applyState;
    boolean checkIn;
    boolean checkOut;
  }
}
