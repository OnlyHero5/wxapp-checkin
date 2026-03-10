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
import com.wxcheckin.backend.infrastructure.persistence.repository.WebAdminAuditLogRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebBrowserBindingRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebPasskeyChallengeRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebPasskeyCredentialRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebUnbindReviewRepository;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
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
  private WebUnbindReviewRepository webUnbindReviewRepository;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @Autowired
  private WebPasskeyChallengeRepository webPasskeyChallengeRepository;

  @Autowired
  private WebPasskeyCredentialRepository webPasskeyCredentialRepository;

  @Autowired
  private WebBrowserBindingRepository webBrowserBindingRepository;

  @Autowired
  private WebAdminAuditLogRepository webAdminAuditLogRepository;

  @BeforeEach
  void prepareData() {
    checkinEventRepository.deleteAll();
    replayGuardRepository.deleteAll();
    qrIssueLogRepository.deleteAll();
    outboxRepository.deleteAll();
    webAdminAuditLogRepository.deleteAll();
    webUnbindReviewRepository.deleteAll();
    webPasskeyCredentialRepository.deleteAll();
    webBrowserBindingRepository.deleteAll();
    webPasskeyChallengeRepository.deleteAll();
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
  void shouldCompleteWebBindRegisterAndLoginFlow() throws Exception {
    String registerSession = bindAndRegister("browser-normal", "2025000011", "测试用户");

    MvcResult loginOptionsResult = mockMvc.perform(post("/api/web/passkey/login/options")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Browser-Binding-Key", "browser-normal")
            .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andReturn();

    JsonNode loginOptionsJson = objectMapper.readTree(loginOptionsResult.getResponse().getContentAsString());
    String requestId = loginOptionsJson.get("request_id").asText();
    String challenge = loginOptionsJson.get("public_key_options").get("challenge").asText();

    mockMvc.perform(post("/api/web/passkey/login/complete")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Browser-Binding-Key", "browser-normal")
            .content("""
                {
                  "request_id":"%s",
                  "assertion_response":{
                    "id":"%s",
                    "raw_id":"%s",
                    "type":"public-key",
                    "response":{
                      "client_data_json":"%s",
                      "authenticator_data":"authenticator-data",
                      "signature":"signature",
                      "user_handle":"%s"
                    }
                  }
                }
                """.formatted(
                requestId,
                credentialIdForBrowser("browser-normal"),
                rawCredentialIdForBrowser("browser-normal"),
                encodeClientDataJson(challenge, "webauthn.get"),
                userHandleForId(1L)
            )))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.session_token").exists());

    org.junit.jupiter.api.Assertions.assertFalse(registerSession.isBlank());
  }

  @Test
  void shouldReturnPasskeyNotRegisteredWhenBrowserHasNoBinding() throws Exception {
    mockMvc.perform(post("/api/web/passkey/login/options")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Browser-Binding-Key", "browser-missing")
            .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("passkey_not_registered")));
  }

  @Test
  void shouldRejectBindWhenAccountAlreadyBoundElsewhere() throws Exception {
    String existingSession = bindAndRegister("browser-old", "2025000011", "测试用户");

    mockMvc.perform(post("/api/web/bind/verify-identity")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Browser-Binding-Key", "browser-new")
            .content("""
                {
                  "student_id":"2025000011",
                  "name":"测试用户"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("account_bound_elsewhere")));

    org.junit.jupiter.api.Assertions.assertFalse(existingSession.isBlank());
  }

  @Test
  void shouldExposeWebActivitiesListAndDetail() throws Exception {
    String staffSession = bindAndRegister("browser-web-staff-list", "2025000007", "刘洋");

    mockMvc.perform(get("/api/web/activities")
            .header("Authorization", "Bearer " + staffSession)
            .header("X-Browser-Binding-Key", "browser-web-staff-list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.activities[0].activity_id", is("act_hackathon_20260215")))
        .andExpect(jsonPath("$.server_time_ms").exists());

    mockMvc.perform(get("/api/web/activities/{activityId}", "act_hackathon_20260215")
            .header("Authorization", "Bearer " + staffSession)
            .header("X-Browser-Binding-Key", "browser-web-staff-list"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.activity_id", is("act_hackathon_20260215")))
        .andExpect(jsonPath("$.activity_title", is("校园 HackDay")))
        .andExpect(jsonPath("$.server_time_ms").exists());
  }

  @Test
  void shouldIssueWebCodeSessionAndConsumeCode() throws Exception {
    String staffSession = bindAndRegister("browser-web-staff-code", "2025000007", "刘洋");

    String normalSession = bindAndRegister("browser-web-normal-code", "2025000011", "测试用户");
    bindUserActivity(normalSession, "act_hackathon_20260215");

    MvcResult codeResult = mockMvc.perform(get("/api/web/activities/{activityId}/code-session", "act_hackathon_20260215")
            .header("Authorization", "Bearer " + staffSession)
            .header("X-Browser-Binding-Key", "browser-web-staff-code")
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
            .header("X-Browser-Binding-Key", "browser-web-normal-code")
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
            .header("X-Browser-Binding-Key", "browser-web-normal-code")
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
  void shouldRequireMatchingBrowserBindingKeyForWebApis() throws Exception {
    String normalSession = bindAndRegister("browser-web-binding-lock", "2025000011", "测试用户");

    mockMvc.perform(get("/api/web/activities")
            .header("Authorization", "Bearer " + normalSession)
            .header("X-Browser-Binding-Key", "browser-web-binding-other"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("session_expired")));
  }

  @Test
  void shouldRejectCheckinWhenActivityDisablesCheckin() throws Exception {
    String staffSession = bindAndRegister("browser-web-staff-checkin-disabled", "2025000007", "刘洋");
    String normalSession = bindAndRegister("browser-web-normal-checkin-disabled", "2025000011", "测试用户");
    bindUserActivity(normalSession, "act_hackathon_20260215");

    MvcResult codeResult = mockMvc.perform(get("/api/web/activities/{activityId}/code-session", "act_hackathon_20260215")
            .header("Authorization", "Bearer " + staffSession)
            .header("X-Browser-Binding-Key", "browser-web-staff-checkin-disabled")
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
            .header("X-Browser-Binding-Key", "browser-web-normal-checkin-disabled")
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
            .header("X-Browser-Binding-Key", "browser-web-staff-checkin-disabled")
            .param("action_type", "checkin"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")));
  }

  @Test
  void shouldSupportBulkCheckoutAndUnbindReviewFlow() throws Exception {
    String staffSession = bindAndRegister("browser-web-staff-manage", "2025000007", "刘洋");

    String normalSession = bindAndRegister("browser-web-normal-review", "2025000011", "测试用户");
    bindUserActivity(normalSession, "act_hackathon_20260215");
    setUserActivityState(normalSession, "act_hackathon_20260215", "checked_in");

    mockMvc.perform(post("/api/web/staff/activities/{activityId}/bulk-checkout", "act_hackathon_20260215")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + staffSession)
            .header("X-Browser-Binding-Key", "browser-web-staff-manage")
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

    MvcResult createReviewResult = mockMvc.perform(post("/api/web/unbind-reviews")
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + normalSession)
            .header("X-Browser-Binding-Key", "browser-web-normal-review")
            .content("""
                {
                  "reason":"更换手机",
                  "requested_new_binding_hint":"iPhone 16"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andReturn();

    String reviewId = objectMapper.readTree(createReviewResult.getResponse().getContentAsString()).get("review_id").asText();

    mockMvc.perform(get("/api/web/staff/unbind-reviews")
            .header("Authorization", "Bearer " + staffSession)
            .header("X-Browser-Binding-Key", "browser-web-staff-manage")
            .param("status", "pending"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andExpect(jsonPath("$.items[0].review_id", is(reviewId)));

    mockMvc.perform(post("/api/web/staff/unbind-reviews/{reviewId}/approve", reviewId)
            .contentType(MediaType.APPLICATION_JSON)
            .header("Authorization", "Bearer " + staffSession)
            .header("X-Browser-Binding-Key", "browser-web-staff-manage")
            .content("""
                {
                  "review_comment":"确认已更换设备"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")));

    org.junit.jupiter.api.Assertions.assertTrue(sessionRepository.findBySessionToken(normalSession).isEmpty());
    org.junit.jupiter.api.Assertions.assertEquals(1L, webAdminAuditLogRepository.count());

    mockMvc.perform(post("/api/web/passkey/login/options")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Browser-Binding-Key", "browser-web-normal-review")
            .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("forbidden")))
        .andExpect(jsonPath("$.error_code", is("binding_revoked")));
  }

  private String bindAndRegister(String browserKey, String studentId, String name) throws Exception {
    MvcResult verifyResult = mockMvc.perform(post("/api/web/bind/verify-identity")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Browser-Binding-Key", browserKey)
            .content("""
                {
                  "student_id":"%s",
                  "name":"%s"
                }
                """.formatted(studentId, name)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andReturn();

    String bindTicket = objectMapper.readTree(verifyResult.getResponse().getContentAsString()).get("bind_ticket").asText();

    MvcResult registerOptionsResult = mockMvc.perform(post("/api/web/passkey/register/options")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Browser-Binding-Key", browserKey)
            .content("""
                {
                  "bind_ticket":"%s"
                }
                """.formatted(bindTicket)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andReturn();

    JsonNode registerOptionsJson = objectMapper.readTree(registerOptionsResult.getResponse().getContentAsString());
    String requestId = registerOptionsJson.get("request_id").asText();
    String challenge = registerOptionsJson.get("public_key_options").get("challenge").asText();

    MvcResult completeResult = mockMvc.perform(post("/api/web/passkey/register/complete")
            .contentType(MediaType.APPLICATION_JSON)
            .header("X-Browser-Binding-Key", browserKey)
            .content("""
                {
                  "request_id":"%s",
                  "bind_ticket":"%s",
                  "attestation_response":{
                    "id":"cred-%s",
                    "raw_id":"%s",
                    "type":"public-key",
                    "response":{
                      "client_data_json":"%s",
                      "attestation_object":"attestation-object"
                    }
                  }
                }
                """.formatted(
                requestId,
                bindTicket,
                browserKey,
                rawCredentialIdForBrowser(browserKey),
                encodeClientDataJson(challenge, "webauthn.create")
            )))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status", is("success")))
        .andReturn();

    JsonNode json = objectMapper.readTree(completeResult.getResponse().getContentAsString());
    return json.get("session_token").asText();
  }

  private String encodeClientDataJson(String challenge, String type) throws Exception {
    String payload = objectMapper.writeValueAsString(Map.of(
        "challenge", challenge,
        "type", type,
        "origin", "http://localhost"
    ));
    return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes());
  }

  private String credentialIdForBrowser(String browserKey) {
    return "cred-" + browserKey;
  }

  private String rawCredentialIdForBrowser(String browserKey) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(("raw-" + browserKey).getBytes());
  }

  private String userHandleForId(Long userId) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(("user:" + userId).getBytes());
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
