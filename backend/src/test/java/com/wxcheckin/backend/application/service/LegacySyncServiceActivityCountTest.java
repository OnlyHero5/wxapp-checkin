package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
 * 回归用例：对齐 legacy pull 的活动统计口径。
 *
 * <p>背景（来自联调报告 2026-03-11）：
 * - 投影表的业务口径：checkin_count 表示“已签到未签退”的人数（在签退时会 checkin_count -= 1）。
 * - 但 legacy pull 口径曾把 checkin_count 统计为“check_in=1 的总人数（包含已签退）”，
 *   导致定时 pull 会周期性覆盖投影计数，最终出现不可能状态（如 checkin_count < checkout_count）。</p>
 *
 * <p>本测试用最小的 legacy 表数据复现并锁定口径：
 * - 1 人：check_in=1, check_out=0 -> 应计入 checkin_count
 * - 1 人：check_in=1, check_out=1 -> 应计入 checkout_count，但不应计入 checkin_count</p>
 */
@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.sync.legacy.enabled=true"
})
class LegacySyncServiceActivityCountTest {

  @Autowired
  private LegacySyncService legacySyncService;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private WxActivityProjectionRepository activityRepository;

  @BeforeEach
  void setUp() {
    // 说明：测试 profile 下 legacyJdbcTemplate 会复用主数据源（H2），因此直接用 JdbcTemplate 建表即可。
    activityRepository.deleteAll();

    jdbcTemplate.execute("DROP TABLE IF EXISTS suda_activity_apply");
    jdbcTemplate.execute("DROP TABLE IF EXISTS suda_activity");
    jdbcTemplate.execute("DROP TABLE IF EXISTS suda_user");

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

    // 给 user-status 同步的 JOIN 提供最小表结构，避免产生“表不存在”的噪声日志。
    jdbcTemplate.execute("""
        CREATE TABLE suda_user (
          id BIGINT PRIMARY KEY,
          username VARCHAR(32) NOT NULL,
          name VARCHAR(64) NOT NULL,
          role INT NOT NULL
        )
        """);
  }

  @Test
  void shouldCountOnlyCheckedInButNotCheckedOutAsCheckinCount() {
    Instant now = Instant.now();
    jdbcTemplate.update(
        """
            INSERT INTO suda_activity (id, name, description, location, activity_stime, activity_etime, type, state)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
        101,
        "测试活动",
        "用于验证 checkin_count 统计口径",
        "测试地点",
        Timestamp.from(now.minusSeconds(60)),
        Timestamp.from(now.plusSeconds(3600)),
        0,
        3
    );

    jdbcTemplate.execute("""
        INSERT INTO suda_activity_apply (activity_id, username, state, check_in, check_out)
        VALUES (101, 'u_checked_in', 0, 1, 0)
        """);
    jdbcTemplate.execute("""
        INSERT INTO suda_activity_apply (activity_id, username, state, check_in, check_out)
        VALUES (101, 'u_checked_out', 0, 1, 1)
        """);
    jdbcTemplate.execute("""
        INSERT INTO suda_activity_apply (activity_id, username, state, check_in, check_out)
        VALUES (101, 'u_not_checked_in', 0, 0, 0)
        """);

    legacySyncService.syncFromLegacy();

    WxActivityProjectionEntity projection = activityRepository.findById("legacy_act_101").orElseThrow();
    assertEquals(3, projection.getRegisteredCount());
    assertEquals(1, projection.getCheckinCount());
    assertEquals(1, projection.getCheckoutCount());
  }
}
