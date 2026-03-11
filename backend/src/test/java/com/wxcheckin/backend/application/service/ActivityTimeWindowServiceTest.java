package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * ActivityTimeWindowService 回归测试：锁定“投影表时间占位时回查 legacy 并回写”的行为。
 *
 * <p>为什么要测这个：
 * - staff 发码入口会依赖 IssueWindowEvaluation（否则会拒绝发码）；
 * - 详情页的 can_checkin/can_checkout 也应复用同一套时间窗规则；
 * - legacy 同步早期可能出现 start_time == end_time 的占位时间（或 end<start 的异常时间），
 *   如果不回查 legacy 表修正，就会出现契约不一致（页面显示可签到但发码报错）。</p>
 *
 * <p>测试策略：
 * - 使用 test profile（H2 MySQL mode）；
 * - legacyJdbcTemplate 默认复用主数据源，因此直接用 JdbcTemplate 建 `suda_activity` 即可；
 * - 构造“投影表占位时间 + legacy 表真实时间”的数据，断言 evaluateAndFix 会回写投影表。</p>
 */
@ActiveProfiles("test")
@SpringBootTest
class ActivityTimeWindowServiceTest {

  @Autowired
  private ActivityTimeWindowService activityTimeWindowService;

  @Autowired
  private WxActivityProjectionRepository activityRepository;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void setUp() {
    activityRepository.deleteAll();

    // legacy 表：仅保留本服务需要的列（id/activity_stime/activity_etime）。
    jdbcTemplate.execute("DROP TABLE IF EXISTS suda_activity");
    jdbcTemplate.execute("""
        CREATE TABLE suda_activity (
          id INT PRIMARY KEY,
          activity_stime TIMESTAMP,
          activity_etime TIMESTAMP
        )
        """);
  }

  @Test
  void shouldFixPlaceholderTimeByQueryingLegacyAndPersist() {
    // ===== Arrange =====
    Instant placeholder = Instant.now();
    Instant legacyStart = placeholder.minusSeconds(60 * 60L);
    Instant legacyEnd = placeholder.plusSeconds(60 * 60L);
    int legacyActivityId = 201;

    jdbcTemplate.update(
        "INSERT INTO suda_activity (id, activity_stime, activity_etime) VALUES (?, ?, ?)",
        legacyActivityId,
        Timestamp.from(legacyStart),
        Timestamp.from(legacyEnd)
    );

    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId("legacy_act_" + legacyActivityId);
    activity.setLegacyActivityId(legacyActivityId);
    activity.setActivityTitle("占位时间活动");
    activity.setActivityType("活动");
    activity.setLocation("测试地点");
    activity.setProgressStatus("ongoing");
    // 关键：占位时间口径是 start == end，触发回查逻辑。
    activity.setStartTime(placeholder);
    activity.setEndTime(placeholder);
    activityRepository.save(activity);

    // ===== Act =====
    // 注意：JPA 对“手动指定 @Id”的实体默认走 merge，返回值可能是新的受管对象；
    // 为避免 created_at/updated_at 在跨事务传递时丢失，这里显式 reload 后再调用 service。
    WxActivityProjectionEntity reloadedForFix = activityRepository.findById(activity.getActivityId()).orElseThrow();
    ActivityTimeWindowService.IssueWindowEvaluation evaluation = activityTimeWindowService.evaluateAndFix(reloadedForFix);

    // ===== Assert =====
    assertTrue(evaluation.withinWindow(), "legacy 时间覆盖 now，应处于允许发码窗口内");
    WxActivityProjectionEntity reloaded = activityRepository.findById(activity.getActivityId()).orElseThrow();

    // 回写断言：start/end 不再等于占位值，并与 legacy 表一致。
    assertNotEquals(placeholder, reloaded.getStartTime());
    assertNotEquals(placeholder, reloaded.getEndTime());
    assertEquals(legacyStart.toEpochMilli(), reloaded.getStartTime().toEpochMilli());
    assertEquals(legacyEnd.toEpochMilli(), reloaded.getEndTime().toEpochMilli());
  }

  @Test
  void shouldReturnInvalidWhenTimeInvalidAndLegacyLookupFails() {
    // ===== Arrange =====
    Instant now = Instant.now();
    int legacyActivityId = 202;

    // 构造一个明显非法的时间（end < start），且 legacy 表没有对应行可修复。
    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId("legacy_act_" + legacyActivityId);
    activity.setLegacyActivityId(legacyActivityId);
    activity.setActivityTitle("异常时间活动");
    activity.setActivityType("活动");
    activity.setLocation("测试地点");
    activity.setProgressStatus("ongoing");
    activity.setStartTime(now);
    activity.setEndTime(now.minusSeconds(1));
    activityRepository.save(activity);

    // ===== Act =====
    WxActivityProjectionEntity reloadedForFix = activityRepository.findById(activity.getActivityId()).orElseThrow();
    ActivityTimeWindowService.IssueWindowEvaluation evaluation = activityTimeWindowService.evaluateAndFix(reloadedForFix);

    // ===== Assert =====
    assertEquals(false, evaluation.withinWindow());
    assertEquals("activity_time_invalid", evaluation.errorCode());
  }
}
