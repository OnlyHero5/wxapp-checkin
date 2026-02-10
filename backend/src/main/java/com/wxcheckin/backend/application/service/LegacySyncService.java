package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.ActivityProgressStatus;
import com.wxcheckin.backend.domain.model.UserActivityState;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pull-style synchronization from legacy schema to new projection tables.
 *
 * <p>This is intentionally best-effort and guarded by feature flags so deployment
 * can start without coupling startup health to legacy DB readiness.</p>
 */
@Service
public class LegacySyncService {
  private static final Logger log = LoggerFactory.getLogger(LegacySyncService.class);

  private final AppProperties appProperties;
  private final JdbcTemplate jdbcTemplate;
  private final WxActivityProjectionRepository activityRepository;
  private final WxUserAuthExtRepository userRepository;
  private final WxUserActivityStatusRepository statusRepository;

  public LegacySyncService(
      AppProperties appProperties,
      JdbcTemplate jdbcTemplate,
      WxActivityProjectionRepository activityRepository,
      WxUserAuthExtRepository userRepository,
      WxUserActivityStatusRepository statusRepository
  ) {
    this.appProperties = appProperties;
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
    syncLegacyActivities();
    syncLegacyUserActivityStatus();
  }

  private void syncLegacyActivities() {
    final String sql = """
        SELECT
          a.id,
          a.name,
          a.description,
          a.location,
          a.activity_stime,
          a.type,
          a.state,
          COALESCE(SUM(CASE WHEN aa.check_in = b'1' THEN 1 ELSE 0 END), 0) AS checkin_count,
          COALESCE(SUM(CASE WHEN aa.check_in = b'1' AND aa.check_out = b'0' THEN 1 ELSE 0 END), 0) AS checkout_count
        FROM suda_activity a
        LEFT JOIN suda_activity_apply aa ON aa.activity_id = a.id
        GROUP BY a.id, a.name, a.description, a.location, a.activity_stime, a.type, a.state
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
        row.type = rs.getInt("type");
        row.state = rs.getInt("state");
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
        entity.setProgressStatus(row.state >= 4
            ? ActivityProgressStatus.COMPLETED.getCode()
            : ActivityProgressStatus.ONGOING.getCode());
        entity.setSupportCheckout(true);
        entity.setHasDetail(true);
        entity.setCheckinCount(Math.max(0, row.checkinCount));
        entity.setCheckoutCount(Math.max(0, row.checkoutCount));
        entity.setActive(true);
        activityRepository.save(entity);
      }
    } catch (DataAccessException ex) {
      log.debug("Legacy activity sync skipped: {}", ex.getMessage());
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
        var userOpt = userRepository.findByLegacyUserId(row.legacyUserId);
        var activityOpt = activityRepository.findByLegacyActivityId(row.legacyActivityId);
        if (userOpt.isEmpty() || activityOpt.isEmpty()) {
          continue;
        }

        var user = userOpt.get();
        var activity = activityOpt.get();
        WxUserActivityStatusEntity status = statusRepository
            .findByUserIdAndActivityId(user.getId(), activity.getActivityId())
            .orElseGet(WxUserActivityStatusEntity::new);
        status.setUser(user);
        status.setActivityId(activity.getActivityId());
        status.setRegistered(row.applyState != 3);

        if (row.checkIn) {
          // Legacy convention: check_out=0 means already checked out, 1 means not yet checked out.
          status.setStatus(row.checkOut ? UserActivityState.CHECKED_IN.getCode() : UserActivityState.CHECKED_OUT.getCode());
        } else {
          status.setStatus(UserActivityState.NONE.getCode());
        }
        statusRepository.save(status);
      }
    } catch (DataAccessException ex) {
      log.debug("Legacy user-status sync skipped: {}", ex.getMessage());
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

  private static class LegacyActivityRow {
    int id;
    String name;
    String description;
    String location;
    Instant startTime;
    int type;
    int state;
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
