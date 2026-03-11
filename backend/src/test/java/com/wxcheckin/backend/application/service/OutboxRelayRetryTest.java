package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * 回归用例：outbox relay 遇到临时失败时不应把事件永久标记为 failed。
 *
 * <p>背景（来自联调报告 2026-03-11）：
 * - 旧实现只拉取 status=pending 的事件；
 * - 一旦发生 DataAccessException（例如 legacy 库瞬时不可用/表锁），事件被标记为 failed 且后续不再重试，
 *   会造成“扩展库已成功、legacy 永久不同步”的一致性风险。</p>
 *
 * <p>本测试用“legacy 缺表”模拟一次可恢复失败：
 * - suda_user 存在（能解析 legacy username）
 * - suda_activity_apply 不存在（UPDATE 触发 DataAccessException）
 *
 * <p>期望行为：
 * - 事件仍保持可重试（status 仍为 pending）
 * - 且 available_at 会被延后到未来，避免紧密自旋重试</p>
 */
@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.sync.outbox.enabled=true"
})
class OutboxRelayRetryTest {

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
  private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void setUp() {
    outboxRepository.deleteAll();
    activityRepository.deleteAll();
    // 清理顺序要先删子表再删父表：wx_user_activity_status.user_id -> wx_user_auth_ext.id。
    statusRepository.deleteAll();
    userRepository.deleteAll();

    // legacy 表：只建 suda_user，故意不建 suda_activity_apply 来模拟一次可恢复失败。
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
    jdbcTemplate.update(
        "INSERT INTO suda_user (id, username, name, role) VALUES (?, ?, ?, ?)",
        11L,
        "2025000011",
        "测试用户",
        9
    );
  }

  @Test
  void shouldRetryWhenLegacyUpdateFails() {
    WxUserAuthExtEntity user = new WxUserAuthExtEntity();
    user.setLegacyUserId(11L);
    user.setWxIdentity("web:2025000011");
    user.setStudentId("2025000011");
    user.setName("测试用户");
    user.setRegistered(true);
    userRepository.save(user);

    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId("legacy_act_101");
    activity.setLegacyActivityId(101);
    activity.setActivityTitle("联调活动 101");
    activity.setActivityType("活动");
    Instant now = Instant.now();
    activity.setStartTime(now.minusSeconds(60));
    activity.setEndTime(now.plusSeconds(3600));
    activity.setLocation("测试地点");
    activity.setDescription("用于验证 outbox retry");
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
    event.setAggregateId("rec_test_1");
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

    Instant beforeRelay = Instant.now();
    outboxRelayService.relayToLegacy();

    WxSyncOutboxEntity saved = outboxRepository.findById(event.getId()).orElseThrow();
    assertEquals("pending", saved.getStatus());
    assertEquals(1, saved.getRetryCount());
    assertTrue(saved.getAvailableAt().isAfter(beforeRelay));
  }
}
