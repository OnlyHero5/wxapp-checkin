package com.wxcheckin.backend.api;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxAdminRosterEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxAdminRosterRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxCheckinEventRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxQrIssueLogRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxReplayGuardRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
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

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class ApiFlowIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private ObjectMapper objectMapper;

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

  @Autowired
  private WxCheckinEventRepository checkinEventRepository;

  @Autowired
  private WxReplayGuardRepository replayGuardRepository;

  @Autowired
  private WxQrIssueLogRepository qrIssueLogRepository;

  @Autowired
  private WxSyncOutboxRepository outboxRepository;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @BeforeEach
  void prepareData() {
    checkinEventRepository.deleteAll();
    replayGuardRepository.deleteAll();
    qrIssueLogRepository.deleteAll();
    outboxRepository.deleteAll();
    statusRepository.deleteAll();
    sessionRepository.deleteAll();
    adminRosterRepository.deleteAll();
    userRepository.deleteAll();
    activityRepository.deleteAll();

    WxAdminRosterEntity admin = new WxAdminRosterEntity();
    admin.setStudentId("2025000007");
    admin.setName("刘洋");
    admin.setActive(true);
    adminRosterRepository.save(admin);

    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId("act_hackathon_20260215");
    activity.setActivityTitle("校园 HackDay");
    activity.setActivityType("竞赛");
    Instant now = Instant.now();
    activity.setStartTime(now.minusSeconds(10 * 60L));
    activity.setEndTime(now.plusSeconds(60 * 60L));
    activity.setLocation("创新中心 1F");
    activity.setDescription("48 小时团队赛，支持签到与签退。");
    activity.setProgressStatus("ongoing");
    activity.setSupportCheckout(true);
    activity.setHasDetail(true);
    activity.setCheckinCount(0);
    activity.setCheckoutCount(0);
    activity.setRotateSeconds(10);
    activity.setGraceSeconds(20);
    activity.setActive(true);
    activityRepository.save(activity);

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
        7L,
        "2025000007",
        "刘洋",
        1
    );
    jdbcTemplate.update(
        "INSERT INTO suda_user (id, username, name, role) VALUES (?, ?, ?, ?)",
        11L,
        "2025000011",
        "测试用户",
        9
    );
  }

  @Test
  void shouldReturnSessionExpiredSignalWhenTokenInvalid() throws Exception {
    mockMvc.perform(get("/api/web/activities")
            .header("Authorization", "Bearer invalid-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("session_expired")));
  }

  @Test
  void shouldRequirePasswordChangeBeforeAccessingWebApis() throws Exception {
    String staffSession = login("2025000007", "123");

    mockMvc.perform(get("/api/web/activities")
            .header("Authorization", "Bearer " + staffSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("password_change_required")));

    changePassword(staffSession, "123", "new-pass-staff");

    mockMvc.perform(get("/api/web/activities")
            .header("Authorization", "Bearer " + staffSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")));
  }

  @Test
  void shouldRejectLoginWhenPasswordInvalid() throws Exception {
    mockMvc.perform(post("/api/web/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "student_id":"2025000011",
                  "password":"wrong"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("invalid_password")));
  }

  @Test
  void shouldAllowMultipleSessionsForSameAccountAfterLogin() throws Exception {
    String firstSession = login("2025000011", "123");
    String secondSession = login("2025000011", "123");

    org.junit.jupiter.api.Assertions.assertFalse(firstSession.isBlank());
    org.junit.jupiter.api.Assertions.assertFalse(secondSession.isBlank());
    org.junit.jupiter.api.Assertions.assertNotEquals(firstSession, secondSession);
  }

  @Test
  void shouldExposeWebActivitiesListAndDetail() throws Exception {
    String staffSession = loginAndChangePassword("2025000007", "new-pass-staff-list");

    mockMvc.perform(get("/api/web/activities")
            .header("Authorization", "Bearer " + staffSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.activities[0].activity_id", is("act_hackathon_20260215")))
        .andExpect(jsonPath("$.server_time_ms").exists());

    mockMvc.perform(get("/api/web/activities/{activityId}", "act_hackathon_20260215")
            .header("Authorization", "Bearer " + staffSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.activity_id", is("act_hackathon_20260215")))
        .andExpect(jsonPath("$.activity_title", is("校园 HackDay")))
        .andExpect(jsonPath("$.server_time_ms").exists());
  }

  @Test
  void shouldAlignActivityCanCheckinWithCodeSessionTimeWindow() throws Exception {
    String staffSession = loginAndChangePassword("2025000007", "new-pass-staff-window");
    String normalSession = loginAndChangePassword("2025000011", "new-pass-normal-window");

    WxActivityProjectionEntity futureActivity = new WxActivityProjectionEntity();
    futureActivity.setActivityId("act_future_window");
    futureActivity.setActivityTitle("未来活动");
    futureActivity.setActivityType("讲座");
    Instant now = Instant.now();
    futureActivity.setStartTime(now.plusSeconds(5 * 60L * 60L));
    futureActivity.setEndTime(now.plusSeconds(6 * 60L * 60L));
    futureActivity.setLocation("未来教室");
    futureActivity.setDescription("用于验证 can_checkin 与发码时间窗一致。");
    futureActivity.setProgressStatus("ongoing");
    futureActivity.setSupportCheckin(true);
    futureActivity.setSupportCheckout(true);
    futureActivity.setHasDetail(true);
    futureActivity.setCheckinCount(0);
    futureActivity.setCheckoutCount(0);
    futureActivity.setRotateSeconds(10);
    futureActivity.setGraceSeconds(20);
    futureActivity.setActive(true);
    activityRepository.save(futureActivity);

    bindUserActivity(normalSession, "act_future_window");

    mockMvc.perform(get("/api/web/activities/{activityId}", "act_future_window")
            .header("Authorization", "Bearer " + normalSession))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.can_checkin", is(false)))
        .andExpect(jsonPath("$.can_checkout", is(false)));

    mockMvc.perform(get("/api/web/activities/{activityId}/code-session", "act_future_window")
            .header("Authorization", "Bearer " + staffSession)
            .param("action_type", "checkin"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("outside_activity_time_window")));
  }

  @Test
  void shouldIssueWebCodeSessionAndConsumeCode() throws Exception {
    String staffSession = loginAndChangePassword("2025000007", "new-pass-staff-code");

    String normalSession = loginAndChangePassword("2025000011", "new-pass-normal-code");
    bindUserActivity(normalSession, "act_hackathon_20260215");

    MvcResult codeResult = mockMvc.perform(get("/api/web/activities/{activityId}/code-session", "act_hackathon_20260215")
            .header("Authorization", "Bearer " + staffSession)
            .param("action_type", "checkin"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.action_type", is("checkin")))
        .andExpect(jsonPath("$.activity_id", is("act_hackathon_20260215")))
        .andExpect(jsonPath("$.code").exists())
        .andReturn();

    String code = objectMapper.readTree(codeResult.getResponse().getContentAsString()).get("code").asText();

    mockMvc.perform(post("/api/web/activities/{activityId}/code-consume", "act_hackathon_20260215")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + normalSession)
            .content("""
                {
                  "action_type":"checkin",
                  "code":"%s"
                }
                """.formatted(code)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.action_type", is("checkin")))
        .andExpect(jsonPath("$.activity_id", is("act_hackathon_20260215")));

    mockMvc.perform(post("/api/web/activities/{activityId}/code-consume", "act_hackathon_20260215")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + normalSession)
            .content("""
                {
                  "action_type":"checkin",
                  "code":"%s"
                }
                """.formatted(code)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("duplicate")));
  }

  @Test
  void shouldRejectCheckinWhenActivityDisablesCheckin() throws Exception {
    String staffSession = loginAndChangePassword(
        "2025000007",
        "new-pass-staff-checkin-disabled"
    );
    String normalSession = loginAndChangePassword(
        "2025000011",
        "new-pass-normal-checkin-disabled"
    );
    bindUserActivity(normalSession, "act_hackathon_20260215");

    MvcResult codeResult = mockMvc.perform(get("/api/web/activities/{activityId}/code-session", "act_hackathon_20260215")
            .header("Authorization", "Bearer " + staffSession)
            .param("action_type", "checkin"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andReturn();

    String code = objectMapper.readTree(codeResult.getResponse().getContentAsString()).get("code").asText();
    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue("act_hackathon_20260215").orElseThrow();
    activity.setSupportCheckin(false);
    activityRepository.save(activity);

    mockMvc.perform(post("/api/web/activities/{activityId}/code-consume", "act_hackathon_20260215")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + normalSession)
            .content("""
                {
                  "action_type":"checkin",
                  "code":"%s"
                }
                """.formatted(code)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")));

    mockMvc.perform(get("/api/web/activities/{activityId}/code-session", "act_hackathon_20260215")
            .header("Authorization", "Bearer " + staffSession)
            .param("action_type", "checkin"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")));
  }

  @Test
  void shouldSupportBulkCheckoutFlow() throws Exception {
    String staffSession = loginAndChangePassword("2025000007", "new-pass-staff-manage");

    String normalSession = loginAndChangePassword(
        "2025000011",
        "new-pass-normal-review"
    );
    bindUserActivity(normalSession, "act_hackathon_20260215");
    setUserActivityState(normalSession, "act_hackathon_20260215", "checked_in");

    mockMvc.perform(post("/api/web/staff/activities/{activityId}/bulk-checkout", "act_hackathon_20260215")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + staffSession)
            .content("""
                {
                  "confirm":true,
                  "reason":"活动结束统一签退"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.affected_count", is(1)));

    WxSessionEntity session = sessionRepository.findBySessionToken(normalSession).orElseThrow();
    WxUserActivityStatusEntity status = statusRepository
        .findByUserIdAndActivityId(session.getUser().getId(), "act_hackathon_20260215")
        .orElseThrow();
    org.junit.jupiter.api.Assertions.assertEquals("checked_out", status.getStatus());
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

  private String loginAndChangePassword(String studentId, String newPassword) throws Exception {
    String sessionToken = login(studentId, "123");
    changePassword(sessionToken, "123", newPassword);
    return sessionToken;
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

  private void bindUserActivity(String sessionToken, String activityId) {
    WxSessionEntity session = sessionRepository.findBySessionToken(sessionToken).orElseThrow();
    WxUserActivityStatusEntity status = new WxUserActivityStatusEntity();
    status.setUser(session.getUser());
    status.setActivityId(activityId);
    status.setRegistered(true);
    status.setStatus("none");
    statusRepository.save(status);
  }

  private void setUserActivityState(String sessionToken, String activityId, String state) {
    WxSessionEntity session = sessionRepository.findBySessionToken(sessionToken).orElseThrow();
    WxUserActivityStatusEntity status = statusRepository
        .findByUserIdAndActivityId(session.getUser().getId(), activityId)
        .orElseThrow();
    status.setStatus(state);
    statusRepository.save(status);
  }

}
