package com.wxcheckin.backend.api;

import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
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
    activity.setStartTime(Instant.parse("2026-02-15T01:00:00Z"));
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
  }

  @Test
  void shouldReturnSessionExpiredSignalWhenTokenInvalid() throws Exception {
    mockMvc.perform(get("/api/staff/activities")
            .param("session_token", "invalid-token"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("session_expired")));
  }

  @Test
  void shouldCompleteStaffIssueAndNormalConsumeFlow() throws Exception {
    String staffSession = login("code-staff");
    register(staffSession, "2025000007", "刘洋");

    String normalSession = login("code-normal");
    bindUserActivity(normalSession, "act_hackathon_20260215");

    String qrPayload = issueQr(staffSession, "act_hackathon_20260215", "checkin");

    mockMvc.perform(post("/api/checkin/consume")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "session_token":"%s",
                  "qr_payload":"%s"
                }
                """.formatted(normalSession, qrPayload)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.action_type", is("checkin")));

    mockMvc.perform(post("/api/checkin/consume")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "session_token":"%s",
                  "qr_payload":"%s"
                }
                """.formatted(normalSession, qrPayload)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("duplicate")));
  }

  private void register(String sessionToken, String studentId, String name) throws Exception {
    mockMvc.perform(post("/api/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "session_token":"%s",
                  "student_id":"%s",
                  "name":"%s",
                  "department":"学生工作部",
                  "club":"活动执行组"
                }
                """.formatted(sessionToken, studentId, name)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")));
  }

  private String issueQr(String staffSession, String activityId, String actionType) throws Exception {
    MvcResult qrResult = mockMvc.perform(post("/api/staff/activities/{activityId}/qr-session", activityId)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "session_token":"%s",
                  "action_type":"%s"
                }
                """.formatted(staffSession, actionType)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andReturn();

    JsonNode json = objectMapper.readTree(qrResult.getResponse().getContentAsString());
    return json.get("qr_payload").asText();
  }

  private String login(String wxCode) throws Exception {
    MvcResult loginResult = mockMvc.perform(post("/api/auth/wx-login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "wx_login_code":"%s"
                }
                """.formatted(wxCode)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andReturn();
    JsonNode json = objectMapper.readTree(loginResult.getResponse().getContentAsString());
    return json.get("session_token").asText();
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
}
