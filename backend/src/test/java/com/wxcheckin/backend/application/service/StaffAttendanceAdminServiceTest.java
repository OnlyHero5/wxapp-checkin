package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.wxcheckin.backend.domain.model.PermissionCatalog;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxCheckinEventEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserActivityStatusEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebAdminAuditLogEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxCheckinEventRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSyncOutboxRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserActivityStatusRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebAdminAuditLogRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * StaffAttendanceAdminService 回归测试：锁定管理员手工修正的核心状态机。
 *
 * <p>为什么要单独测这一层：
 * - 名单页允许“补签到 / 撤销签到 / 补签退 / 撤销签退”四种动作；
 * - 这些动作不是单向状态推进，最容易把 projection 统计、audit、outbox 和时间展示一起改坏；
 * - 如果只靠 API 集成测试，很难把每个状态转换的 delta 和 payload 钉牢。</p>
 *
 * <p>测试策略：
 * - 直接调用 service，不把问题混进 controller / JSON 反序列化；
 * - 每个用例都围绕“旧状态 -> patch -> 新状态”验证：
 *   1. `wx_user_activity_status`
 *   2. `wx_activity_projection`
 *   3. `web_admin_audit_log`
 *   4. `wx_sync_outbox`
 *   5. `wx_checkin_event`（仅正向补签到 / 补签退时写入）</p>
 */
@ActiveProfiles("test")
@SpringBootTest
class StaffAttendanceAdminServiceTest {

  @Autowired
  private StaffAttendanceAdminService staffAttendanceAdminService;

  @Autowired
  private WxActivityProjectionRepository activityRepository;

  @Autowired
  private WxUserAuthExtRepository userRepository;

  @Autowired
  private WxUserActivityStatusRepository statusRepository;

  @Autowired
  private WxSessionRepository sessionRepository;

  @Autowired
  private WxCheckinEventRepository checkinEventRepository;

  @Autowired
  private WxSyncOutboxRepository outboxRepository;

  @Autowired
  private WebAdminAuditLogRepository adminAuditLogRepository;

  @Autowired
  private ObjectMapper objectMapper;

  private String staffSessionToken;
  private WxActivityProjectionEntity activity;

  @BeforeEach
  void setUp() {
    checkinEventRepository.deleteAll();
    outboxRepository.deleteAll();
    adminAuditLogRepository.deleteAll();
    statusRepository.deleteAll();
    sessionRepository.deleteAll();
    userRepository.deleteAll();
    activityRepository.deleteAll();

    activity = new WxActivityProjectionEntity();
    activity.setActivityId("act_staff_adjust");
    activity.setActivityTitle("名单修正测试活动");
    activity.setActivityType("活动");
    activity.setStartTime(Instant.now().minusSeconds(60));
    activity.setEndTime(Instant.now().plusSeconds(3600));
    activity.setLocation("测试地点");
    activity.setDescription("用于验证管理员名单修正状态机。");
    activity.setProgressStatus("ongoing");
    activity.setSupportCheckin(true);
    activity.setSupportCheckout(true);
    activity.setHasDetail(true);
    activity.setRegisteredCount(0);
    activity.setCheckinCount(0);
    activity.setCheckoutCount(0);
    activity.setRotateSeconds(10);
    activity.setGraceSeconds(20);
    activity.setActive(true);
    activityRepository.save(activity);

    WxUserAuthExtEntity staff = new WxUserAuthExtEntity();
    staff.setWxIdentity("staff_identity");
    staff.setStudentId("2025000099");
    staff.setName("管理员");
    staff.setPasswordHash("hash");
    staff.setMustChangePassword(false);
    staff.setRoleCode("staff");
    staff.setPermissionsJson(objectToJson(PermissionCatalog.STAFF_PERMISSIONS));
    staff.setRegistered(true);
    userRepository.save(staff);

    WxSessionEntity session = new WxSessionEntity();
    session.setSessionToken("sess_staff_adjust");
    session.setUser(staff);
    session.setRoleSnapshot("staff");
    session.setPermissionsJson(objectToJson(PermissionCatalog.STAFF_PERMISSIONS));
    session.setExpiresAt(Instant.now().plusSeconds(3600));
    sessionRepository.save(session);
    staffSessionToken = session.getSessionToken();
  }

  @Test
  void shouldPromoteNoneToCheckedOutWithoutInflatingCurrentCheckinCount() throws Exception {
    WxUserAuthExtEntity user = createParticipant("2025000011", "待补签退成员");
    bindStatus(user, "none", true);

    staffAttendanceAdminService.adjustAttendanceStates(
        staffSessionToken,
        activity.getActivityId(),
        List.of(user.getId()),
        true,
        true,
        "直接补签到和签退"
    );

    WxUserActivityStatusEntity status = statusRepository.findByUserIdAndActivityId(user.getId(), activity.getActivityId()).orElseThrow();
    WxActivityProjectionEntity reloadedActivity = activityRepository.findByActivityIdAndActiveTrue(activity.getActivityId()).orElseThrow();
    assertEquals("checked_out", status.getStatus());
    // `checkin_count` 是“仍在场人数”，因此 none -> checked_out 只能增加 checkout_count，不能把当前在场人数也抬高。
    assertEquals(0, reloadedActivity.getCheckinCount());
    assertEquals(1, reloadedActivity.getCheckoutCount());
    assertEquals(2L, checkinEventRepository.count());

    WxSyncOutboxEntity outbox = outboxRepository.findAll().get(0);
    Map<String, Object> payload = objectMapper.readValue(outbox.getPayloadJson(), Map.class);
    assertEquals(1, payload.get("check_in"));
    assertEquals(1, payload.get("check_out"));
  }

  @Test
  void shouldClearCheckinAndCheckoutTogetherWhenUncheckedIn() throws Exception {
    WxUserAuthExtEntity user = createParticipant("2025000012", "已签退成员");
    bindStatus(user, "checked_out", true);
    setProjectionCounts(0, 1);

    staffAttendanceAdminService.adjustAttendanceStates(
        staffSessionToken,
        activity.getActivityId(),
        List.of(user.getId()),
        false,
        false,
        "撤销全部状态"
    );

    WxUserActivityStatusEntity status = statusRepository.findByUserIdAndActivityId(user.getId(), activity.getActivityId()).orElseThrow();
    WxActivityProjectionEntity reloadedActivity = activityRepository.findByActivityIdAndActiveTrue(activity.getActivityId()).orElseThrow();
    assertEquals("none", status.getStatus());
    assertEquals(0, reloadedActivity.getCheckinCount());
    assertEquals(0, reloadedActivity.getCheckoutCount());
    // 撤销动作不额外写“负向事件”，页面通过当前状态裁剪时间显示。
    assertEquals(0L, checkinEventRepository.count());

    WebAdminAuditLogEntity audit = adminAuditLogRepository.findAll().get(0);
    Map<String, Object> payload = objectMapper.readValue(audit.getPayloadJson(), Map.class);
    assertEquals("撤销全部状态", payload.get("reason"));
  }

  @Test
  void shouldRestoreCheckedInWhenCheckoutIsCleared() throws Exception {
    WxUserAuthExtEntity user = createParticipant("2025000013", "撤销签退成员");
    bindStatus(user, "checked_out", true);
    setProjectionCounts(0, 1);

    staffAttendanceAdminService.adjustAttendanceStates(
        staffSessionToken,
        activity.getActivityId(),
        List.of(user.getId()),
        true,
        false,
        "撤销签退"
    );

    WxUserActivityStatusEntity status = statusRepository.findByUserIdAndActivityId(user.getId(), activity.getActivityId()).orElseThrow();
    WxActivityProjectionEntity reloadedActivity = activityRepository.findByActivityIdAndActiveTrue(activity.getActivityId()).orElseThrow();
    assertEquals("checked_in", status.getStatus());
    assertEquals(1, reloadedActivity.getCheckinCount());
    assertEquals(0, reloadedActivity.getCheckoutCount());

    WxSyncOutboxEntity outbox = outboxRepository.findAll().get(0);
    Map<String, Object> payload = objectMapper.readValue(outbox.getPayloadJson(), Map.class);
    assertEquals(1, payload.get("check_in"));
    assertEquals(0, payload.get("check_out"));
  }

  private WxUserAuthExtEntity createParticipant(String studentId, String name) {
    WxUserAuthExtEntity user = new WxUserAuthExtEntity();
    user.setWxIdentity("participant_" + studentId);
    user.setStudentId(studentId);
    user.setName(name);
    user.setPasswordHash("hash");
    user.setMustChangePassword(false);
    user.setRoleCode("normal");
    user.setPermissionsJson("[]");
    user.setRegistered(true);
    return userRepository.save(user);
  }

  private void bindStatus(WxUserAuthExtEntity user, String state, boolean registered) {
    WxUserActivityStatusEntity status = new WxUserActivityStatusEntity();
    status.setUser(user);
    status.setActivityId(activity.getActivityId());
    status.setRegistered(registered);
    status.setStatus(state);
    statusRepository.save(status);
  }

  private void setProjectionCounts(int checkinCount, int checkoutCount) {
    // 这里显式 reload 受管实体，避免直接拿测试类字段里的对象回写时丢失 created_at。
    WxActivityProjectionEntity reloaded = activityRepository.findByActivityIdAndActiveTrue(activity.getActivityId()).orElseThrow();
    reloaded.setCheckinCount(checkinCount);
    reloaded.setCheckoutCount(checkoutCount);
    activityRepository.save(reloaded);
  }

  private String objectToJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception ex) {
      throw new IllegalStateException(ex);
    }
  }
}
