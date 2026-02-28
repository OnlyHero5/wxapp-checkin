package com.wxcheckin.backend.api;

import static org.hamcrest.Matchers.is;
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
import com.wxcheckin.backend.infrastructure.persistence.repository.WxQrIssueLogRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
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
@SpringBootTest(properties = {
    "app.qr.issue-log-enabled=false"
})
@AutoConfigureMockMvc
class ApiFlowNoIssueLogIntegrationTest {

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
  private WxQrIssueLogRepository qrIssueLogRepository;

  @BeforeEach
  void prepareData() {
    qrIssueLogRepository.deleteAll();
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
  }

  @Test
  void shouldIssueAndConsumeWithoutPersistingIssueLogs() throws Exception {
    String staffSession = login("code-staff-no-issue-log-prop");
    register(staffSession, "2025000007", "刘洋");

    String normalSession = login("code-normal-no-issue-log-prop");
    bindUserActivity(normalSession, "act_hackathon_20260215");

    String qrPayload = issueQr(staffSession, "act_hackathon_20260215", "checkin");

    org.junit.jupiter.api.Assertions.assertEquals(0L, qrIssueLogRepository.count());

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
  }

  private void register(String sessionToken, String studentId, String name) throws Exception {
    String department = "学生工作部";
    String club = "活动执行组";
    String payloadEncrypted = buildRegisterPayload(sessionToken, studentId, name, department, club);
    mockMvc.perform(post("/api/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "session_token":"%s",
                  "student_id":"%s",
                  "name":"%s",
                  "department":"%s",
                  "club":"%s",
                  "payload_encrypted":"%s"
                }
                """.formatted(sessionToken, studentId, name, department, club, payloadEncrypted)))
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

  private String buildRegisterPayload(
      String sessionToken,
      String studentId,
      String name,
      String department,
      String club
  ) throws Exception {
    long timestamp = System.currentTimeMillis();
    String nonce = "nonce_" + UUID.randomUUID().toString().replace("-", "");
    String bodyJson = objectMapper.writeValueAsString(Map.of(
        "student_id", studentId,
        "name", name,
        "department", department,
        "club", club
    ));
    String bodyBase64 = Base64.getEncoder().encodeToString(bodyJson.getBytes(StandardCharsets.UTF_8));
    String signText = "v1.%d.%s.%s".formatted(timestamp, nonce, bodyBase64);
    String signature = hmacSha256Hex(sessionToken, signText);
    String envelopeJson = objectMapper.writeValueAsString(Map.of(
        "v", 1,
        "alg", "HMAC-SHA256",
        "ts", timestamp,
        "nonce", nonce,
        "body", bodyBase64,
        "sig", signature
    ));
    return Base64.getEncoder().encodeToString(envelopeJson.getBytes(StandardCharsets.UTF_8));
  }

  private String hmacSha256Hex(String key, String plainText) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    byte[] digest = mac.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
    StringBuilder builder = new StringBuilder(digest.length * 2);
    for (byte b : digest) {
      String hex = Integer.toHexString(b & 0xff);
      if (hex.length() == 1) {
        builder.append('0');
      }
      builder.append(hex);
    }
    return builder.toString();
  }
}

