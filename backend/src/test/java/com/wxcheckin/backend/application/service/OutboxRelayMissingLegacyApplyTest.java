package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebAdminAuditLogRepository;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * 回归用例：outbox relay 回写 legacy 时必须保证“确实命中了一条报名记录”。
 *
 * <p>风险背景：
 * - 旧实现对 legacy 做 UPDATE 后不校验命中行数，直接把事件标记为 processed；
 * - 当 legacy 侧缺报名行（suda_activity_apply 无对应记录）时，会造成“扩展库已成功、legacy 永久不同步”的静默不一致；
 * - 本用例用“legacy 表存在但记录缺失”来模拟该场景。</p>
 *
 * <p>期望行为（策略 A）：
 * - 若 UPDATE 0 行且确认 legacy 不存在该行，则事件应被标记为 dead（不可恢复）而不是 processed。</p>
 */
@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.sync.outbox.enabled=true"
})
class OutboxRelayMissingLegacyApplyTest {

  @Autowired
  private OutboxRelayService outboxRelayService;

  @Autowired
  private WxSyncOutboxRepository outboxRepository;

  @Autowired
  private WxUserAuthExtRepository userRepository;

  @Autowired
  private WxUserActivityStatusRepository statusRepository;

  @Autowired
  private WxActivityProjectionRepository activityRepository;

  @Autowired
  private WxSessionRepository sessionRepository;

  @Autowired
  private WebAdminAuditLogRepository adminAuditLogRepository;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void setUp() {
    outboxRepository.deleteAll();
    adminAuditLogRepository.deleteAll();
    activityRepository.deleteAll();
    // 清理顺序要先删子表再删父表：wx_user_activity_status.user_id -> wx_user_auth_ext.id。
    statusRepository.deleteAll();
    sessionRepository.deleteAll();
    userRepository.deleteAll();

    // legacy 表：建 suda_user + suda_activity_apply，但故意不插入报名记录。
    jdbcTemplate.execute("DROP TABLE IF EXISTS suda_activity_apply");
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
        CREATE TABLE suda_activity_apply (
          activity_id INT NOT NULL,
          username VARCHAR(32) NOT NULL,
          state INT NOT NULL,
          check_in BIT NOT NULL,
          check_out BIT NOT NULL
        )
        """);
    jdbcTemplate.update(
        "INSERT INTO suda_user (id, username, name, role) VALUES (?, ?, ?, ?)",
        11L,
        "2025000011",
        "测试用户",
        9
    );
  }

  @Test
  void shouldMarkDeadWhenLegacyApplyRowMissing() {
    WxUserAuthExtEntity user = new WxUserAuthExtEntity();
    user.setLegacyUserId(11L);
    user.setWxIdentity("web:2025000011");
    user.setStudentId("2025000011");
    user.setName("测试用户");
    user.setRegistered(true);
    userRepository.save(user);

    Instant now = Instant.now();
    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId("legacy_act_101");
    activity.setLegacyActivityId(101);
    activity.setActivityTitle("联调活动 101");
    activity.setActivityType("活动");
    activity.setStartTime(now.minusSeconds(60));
    activity.setEndTime(now.plusSeconds(3600));
    activity.setLocation("测试地点");
    activity.setDescription("用于验证 outbox relay missing legacy apply row");
    activity.setProgressStatus("ongoing");
    activity.setSupportCheckout(true);
    activity.setSupportCheckin(true);
    activity.setHasDetail(true);
    activity.setCheckinCount(0);
    activity.setCheckoutCount(0);
    activity.setRotateSeconds(10);
    activity.setGraceSeconds(20);
    activity.setActive(true);
    activityRepository.save(activity);

    WxSyncOutboxEntity event = new WxSyncOutboxEntity();
    event.setAggregateType("checkin_event");
    event.setAggregateId("rec_missing_1");
    event.setEventType("CHECKIN_CONSUMED");
    event.setPayloadJson("""
        {
          "user_id":%d,
          "activity_id":"%s",
          "action_type":"checkin"
        }
        """.formatted(user.getId(), activity.getActivityId()));
    event.setStatus("pending");
    event.setAvailableAt(now.minusSeconds(1));
    outboxRepository.save(event);

    outboxRelayService.relayToLegacy();

    WxSyncOutboxEntity saved = outboxRepository.findById(event.getId()).orElseThrow();
    assertEquals("dead", saved.getStatus());
    assertEquals(0, saved.getRetryCount());
    assertNotNull(saved.getProcessedAt());
  }
}
