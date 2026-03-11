package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.domain.model.ActivityProgressStatus;
import com.wxcheckin.backend.domain.model.UserActivityState;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * 回归用例：修复“批量签退后存在最终一致性窗口（状态回退）”。
 *
 * <p>背景（来自联调报告 2026-03-11，问题 WX-SYNC-001）：
 * - bulk-checkout 会先在扩展库（wxcheckin_ext）里把用户状态改成 checked_out，并写入 outbox；
 * - outbox relay 会把签退写回 legacy（suda_activity_apply.check_out=1）；
 * - 但如果 legacy pull 比 outbox relay 先执行，pull 会读取到旧 legacy 状态（check_out=0），
 *   从而把本地刚更新的 checked_out 覆盖回 checked_in，造成 Web 端短暂显示“未签退”。</p>
 *
 * <p>本测试用最小数据构造“本地已签退 + legacy 尚未写回 + outbox pending”的窗口，
 * 并要求一次 syncFromLegacy() 能优先 relay outbox 再 pull，从根上消除“状态回退”。</p>
 */
@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.sync.legacy.enabled=true",
    "app.sync.outbox.enabled=true"
})
class LegacySyncServiceOutboxOrderingTest {

  @Autowired
  private LegacySyncService legacySyncService;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private JsonCodec jsonCodec;

  @Autowired
  private WxUserAuthExtRepository userRepository;

  @Autowired
  private WxActivityProjectionRepository activityRepository;

  @Autowired
  private WxUserActivityStatusRepository statusRepository;

  @Autowired
  private WxSyncOutboxRepository outboxRepository;

  @BeforeEach
  void setUp() {
    // 清理扩展库数据：确保测试只围绕一个用户/一个活动/一个 outbox 事件，避免干扰。
    outboxRepository.deleteAll();
    statusRepository.deleteAll();
    userRepository.deleteAll();
    activityRepository.deleteAll();

    // 构造最小 legacy 表：用户 + 活动 + 报名记录（初始为已签到未签退）。
    jdbcTemplate.execute("DROP TABLE IF EXISTS suda_activity_apply");
    jdbcTemplate.execute("DROP TABLE IF EXISTS suda_activity");
    jdbcTemplate.execute("DROP TABLE IF EXISTS suda_user");

    jdbcTemplate.execute("""
        CREATE TABLE suda_user (
          id BIGINT PRIMARY KEY,
          username VARCHAR(32) NOT NULL,
          name VARCHAR(64) NOT NULL,
          role INT NOT NULL
        )
        """);
    jdbcTemplate.execute("""
        CREATE TABLE suda_activity (
          id INT PRIMARY KEY,
          name VARCHAR(128),
          description VARCHAR(255),
          location VARCHAR(128),
          activity_stime TIMESTAMP,
          activity_etime TIMESTAMP,
          type INT,
          state INT
        )
        """);
    jdbcTemplate.execute("""
        CREATE TABLE suda_activity_apply (
          activity_id INT NOT NULL,
          username VARCHAR(32) NOT NULL,
          state INT NOT NULL,
          check_in BIT NOT NULL,
          check_out BIT NOT NULL
        )
        """);
  }

  @Test
  void shouldRelayOutboxBeforePullToAvoidStatusRollbackAfterBulkCheckout() {
    // ===== Arrange: legacy 基线（尚未写回 check_out） =====
    long legacyUserId = 11L;
    String legacyUsername = "2025000011";
    int legacyActivityId = 101;

    jdbcTemplate.update(
        "INSERT INTO suda_user (id, username, name, role) VALUES (?, ?, ?, ?)",
        legacyUserId,
        legacyUsername,
        "测试用户",
        9
    );

    Instant now = Instant.now();
    jdbcTemplate.update(
        """
            INSERT INTO suda_activity (id, name, description, location, activity_stime, activity_etime, type, state)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
        legacyActivityId,
        "联调活动 101",
        "用于复现 WX-SYNC-001",
        "测试地点",
        Timestamp.from(now.minusSeconds(60)),
        Timestamp.from(now.plusSeconds(3600)),
        0,
        3
    );

    // legacy 仍是“已签到未签退”（模拟：outbox 尚未被 relay 到 legacy 的那一瞬间）。
    jdbcTemplate.update(
        """
            INSERT INTO suda_activity_apply (activity_id, username, state, check_in, check_out)
            VALUES (?, ?, ?, 1, 0)
            """,
        legacyActivityId,
        legacyUsername,
        0
    );

    // ===== Arrange: 扩展库本地状态（已签退） + outbox pending =====
    WxUserAuthExtEntity user = new WxUserAuthExtEntity();
    user.setLegacyUserId(legacyUserId);
    user.setWxIdentity("wx:legacy:" + legacyUserId);
    userRepository.save(user);

    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId("legacy_act_" + legacyActivityId);
    activity.setLegacyActivityId(legacyActivityId);
    activity.setActivityTitle("联调活动 101");
    activity.setActivityType("讲座");
    activity.setStartTime(now.minusSeconds(60));
    activity.setEndTime(now.plusSeconds(3600));
    activity.setLocation("测试地点");
    activity.setDescription("用于复现 WX-SYNC-001");
    activity.setProgressStatus(ActivityProgressStatus.ONGOING.getCode());
    activity.setSupportCheckout(true);
    activity.setSupportCheckin(true);
    activity.setHasDetail(true);
    activity.setCheckinCount(0);
    activity.setCheckoutCount(1);
    activity.setRotateSeconds(10);
    activity.setGraceSeconds(20);
    activity.setActive(true);
    activityRepository.save(activity);

    // 本地状态先被 bulk-checkout 写成 checked_out（这是“最终期望”，不应被 pull 回退）。
    WxUserActivityStatusEntity status = new WxUserActivityStatusEntity();
    status.setUser(user);
    status.setActivityId(activity.getActivityId());
    status.setRegistered(true);
    status.setStatus(UserActivityState.CHECKED_OUT.getCode());
    statusRepository.save(status);

    // outbox pending：表示“本地已写，但 legacy 尚未落地”，需要 relay 优先执行。
    Map<String, Object> payload = new HashMap<>();
    payload.put("record_id", "r1");
    payload.put("user_id", user.getId());
    payload.put("activity_id", activity.getActivityId());
    payload.put("action_type", "checkout");
    payload.put("server_time", now.toEpochMilli());

    WxSyncOutboxEntity outbox = new WxSyncOutboxEntity();
    outbox.setAggregateType("checkin_event");
    outbox.setAggregateId("r1");
    outbox.setEventType("CHECKIN_CONSUMED");
    outbox.setPayloadJson(jsonCodec.writeMap(payload));
    outbox.setStatus("pending");
    outbox.setAvailableAt(now);
    outboxRepository.save(outbox);

    // ===== Act: 一次 syncFromLegacy 应做到“先 push(outbox) 再 pull(legacy)” =====
    legacySyncService.syncFromLegacy();

    // ===== Assert: legacy 被写回 + outbox 被处理 + 本地状态不回退 =====
    Integer legacyCheckOut = jdbcTemplate.queryForObject(
        "SELECT (check_out+0) FROM suda_activity_apply WHERE activity_id = ? AND username = ?",
        Integer.class,
        legacyActivityId,
        legacyUsername
    );
    assertEquals(1, legacyCheckOut);

    WxSyncOutboxEntity reloadedOutbox = outboxRepository.findAll().stream().findFirst().orElseThrow();
    assertEquals("processed", reloadedOutbox.getStatus());

    WxUserActivityStatusEntity reloadedStatus = statusRepository
        .findByUserIdAndActivityId(user.getId(), activity.getActivityId())
        .orElseThrow();
    assertEquals(UserActivityState.CHECKED_OUT.getCode(), reloadedStatus.getStatus());

    WxActivityProjectionEntity reloadedActivity = activityRepository.findById(activity.getActivityId()).orElseThrow();
    assertEquals(0, reloadedActivity.getCheckinCount());
    assertEquals(1, reloadedActivity.getCheckoutCount());
  }
}

