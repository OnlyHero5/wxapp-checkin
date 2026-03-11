package com.wxcheckin.backend.api;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxAdminRosterRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 回归用例：普通用户首次登录改密后，活动可见性不应依赖“定时 pull”等待窗口。
 *
 * <p>背景（来自联调报告 2026-03-11）：
 * - 普通用户活动列表依赖 wx_user_activity_status（报名/状态）才能可见；
 * - 该表通常由 LegacySyncService 的定时 pull 补齐；
 * - 若 pull interval 默认 60s，会出现用户改密后列表空白几十秒的体验问题。</p>
 *
 * <p>期望行为：
 * - 当普通用户首次访问活动列表且本地没有任何 status 时，后端应 best-effort 触发一次“按用户即时同步”，
 *   让用户无需等待定时任务即可看到自己报名的活动。</p>
 */
@ActiveProfiles("test")
@SpringBootTest(properties = {
    "app.sync.legacy.enabled=true"
})
@AutoConfigureMockMvc
class OnDemandLegacySyncFlowTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private WxActivityProjectionRepository activityRepository;

  @Autowired
  private WxSessionRepository sessionRepository;

  @Autowired
  private WxUserActivityStatusRepository statusRepository;

  @Autowired
  private WxUserAuthExtRepository userRepository;

  @Autowired
  private WxAdminRosterRepository adminRosterRepository;

  @BeforeEach
  void prepare() {
    // 清理扩展库（H2）里的投影/会话/状态，确保“首次进入列表时本地无 status”成立。
    statusRepository.deleteAll();
    sessionRepository.deleteAll();
    adminRosterRepository.deleteAll();
    userRepository.deleteAll();
    activityRepository.deleteAll();

    // 构造最小 legacy 表数据：用户 + 活动 + 报名（未签到未签退）。
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

    jdbcTemplate.update(
        "INSERT INTO suda_user (id, username, name, role) VALUES (?, ?, ?, ?)",
        11L,
        "2025000011",
        "测试用户",
        9
    );

    Instant now = Instant.now();
    jdbcTemplate.update(
        """
            INSERT INTO suda_activity (id, name, description, location, activity_stime, activity_etime, type, state)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
        101,
        "联调活动 101",
        "用于验证 on-demand legacy sync",
        "测试地点",
        Timestamp.from(now.minusSeconds(60)),
        Timestamp.from(now.plusSeconds(3600)),
        0,
        3
    );

    jdbcTemplate.execute("""
        INSERT INTO suda_activity_apply (activity_id, username, state, check_in, check_out)
        VALUES (101, '2025000011', 0, 0, 0)
        """);
  }

  @Test
  void shouldExposeActivitiesForNormalUserWithoutWaitingScheduledPull() throws Exception {
    // 登录后强制改密，通过后立刻请求活动列表。
    String sessionToken = loginAndChangePassword("2025000011", "new-pass-normal");

    mockMvc.perform(get("/api/web/activities")
            .header("Authorization", "Bearer " + sessionToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        // 关键断言：无需等待定时 pull，立即能看到本人报名的 legacy 活动。
        .andExpect(jsonPath("$.activities[0].activity_id", is("legacy_act_101")));
  }

  private String loginAndChangePassword(String studentId, String newPassword) throws Exception {
    String sessionToken = login(studentId, "123");
    changePassword(sessionToken, "123", newPassword);
    return sessionToken;
  }

  private String login(String studentId, String password) throws Exception {
    MvcResult result = mockMvc.perform(post("/api/web/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "student_id":"%s",
                  "password":"%s"
                }
                """.formatted(studentId, password)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.session_token").exists())
        .andReturn();
    return objectMapper.readTree(result.getResponse().getContentAsString()).get("session_token").asText();
  }

  private void changePassword(
      String sessionToken,
      String oldPassword,
      String newPassword
  ) throws Exception {
    mockMvc.perform(post("/api/web/auth/change-password")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + sessionToken)
            .content("""
                {
                  "old_password":"%s",
                  "new_password":"%s"
                }
                """.formatted(oldPassword, newPassword)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.must_change_password", is(false)));
  }
}

