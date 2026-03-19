package com.wxcheckin.backend.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

import com.wxcheckin.backend.api.dto.WebCodeSessionResponse;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.ActionType;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * DynamicCodeService 回归测试：锁定“动态码时长必须跟活动配置一致”的契约。
 *
 * <p>这组测试直接对应本次 UI 联调里 staff 页的异常：
 * - 页面刚出现 6 位码就立即过期，脚本跨一步读取时变成空值；
 * - API 对照脚本里 `expires_in_ms` 只有约 1 秒，和投影表 `rotate_seconds=300` 明显冲突。
 *
 * <p>因此这里不测 Web 页面，而是直接锁定服务层两件事：
 * 1. 发码返回的过期时间必须使用活动自己的 `rotate_seconds`
 * 2. 验码也必须使用同一套 rotate 口径，否则“发出来的码”和“验码窗口”会错位
 */
@ExtendWith(MockitoExtension.class)
class DynamicCodeServiceTest {

  @Mock
  private SessionService sessionService;

  @Mock
  private ActivityTimeWindowService activityTimeWindowService;

  @Mock
  private WxActivityProjectionRepository activityRepository;

  private DynamicCodeService dynamicCodeService;

  private static final String SIGNING_KEY = "dynamic-code-test-key";

  @BeforeEach
  void setUp() {
    // 选一个会让“10 秒轮换”和“300 秒轮换”落在不同 slot 的固定时间，
    // 这样测试才能准确抓到服务是否偷用了写死常量。
    Clock fixedClock = Clock.fixed(Instant.ofEpochMilli(120_001L), ZoneOffset.UTC);

    AppProperties appProperties = new AppProperties();
    appProperties.getQr().setSigningKey(SIGNING_KEY);

    dynamicCodeService = new DynamicCodeService(
        sessionService,
        activityTimeWindowService,
        activityRepository,
        fixedClock,
        appProperties
    );
  }

  @Test
  void issueShouldUseActivityRotateSecondsWhenComputingExpiry() {
    WxActivityProjectionEntity activity = buildActivity("legacy_act_301", 300);
    SessionPrincipal principal = new SessionPrincipal(
        null,
        new WxUserAuthExtEntity(),
        RoleType.STAFF,
        List.of("activity:manage")
    );

    when(sessionService.requireWebPrincipal("staff-session")).thenReturn(principal);
    when(activityRepository.findByActivityIdAndActiveTrue(activity.getActivityId())).thenReturn(Optional.of(activity));
    doNothing().when(activityTimeWindowService).ensureWithinIssueWindow(activity);

    WebCodeSessionResponse response = dynamicCodeService.issue("staff-session", activity.getActivityId(), "checkin");

    // 若 rotate_seconds=300 生效，当前时间 120001ms 仍在第一个 300s 窗口内，
    // 剩余寿命应接近 180s，而不是 10s 内。
    assertTrue(response.expiresInMs() > 150_000L, "发码寿命应反映活动配置的 300 秒轮换窗口");
    assertEquals("success", response.status());
  }

  @Test
  void validateCodeShouldUseActivityRotateSecondsForCurrentSlot() {
    WxActivityProjectionEntity activity = buildActivity("legacy_act_302", 300);
    when(activityRepository.findByActivityIdAndActiveTrue(activity.getActivityId())).thenReturn(Optional.of(activity));

    // 按活动 rotate_seconds=300 计算，此时仍应落在 slot=0；
    // 如果服务错误地使用 10 秒常量，就会把同一时刻算到 slot=12，从而误判 invalid_code。
    String currentCode = generateCode(activity.getActivityId(), ActionType.CHECKIN, 0L);

    DynamicCodeService.ValidatedCode validated = dynamicCodeService.validateCode(
        activity.getActivityId(),
        ActionType.CHECKIN,
        currentCode
    );

    assertEquals(0L, validated.slot());
    assertEquals("web-code:" + currentCode, validated.rawPayload());
  }

  private WxActivityProjectionEntity buildActivity(String activityId, int rotateSeconds) {
    WxActivityProjectionEntity activity = new WxActivityProjectionEntity();
    activity.setActivityId(activityId);
    activity.setActivityTitle("动态码测试活动");
    activity.setActivityType("活动");
    activity.setLocation("测试地点");
    activity.setProgressStatus("ongoing");
    activity.setSupportCheckin(true);
    activity.setSupportCheckout(true);
    activity.setRotateSeconds(rotateSeconds);
    activity.setGraceSeconds(20);
    activity.setRegisteredCount(10);
    activity.setCheckinCount(0);
    activity.setCheckoutCount(0);
    activity.setActive(true);
    activity.setStartTime(Instant.ofEpochMilli(0L));
    activity.setEndTime(Instant.ofEpochMilli(600_000L));
    return activity;
  }

  private String generateCode(String activityId, ActionType actionType, long slot) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(SIGNING_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] digest = mac.doFinal(
          ("web-code:v1|%s|%s|%d".formatted(activityId, actionType.getCode(), slot))
              .getBytes(StandardCharsets.UTF_8)
      );
      int value = Math.floorMod(ByteBuffer.wrap(digest).getInt(), 1_000_000);
      return "%06d".formatted(value);
    } catch (Exception ex) {
      throw new IllegalStateException(ex);
    }
  }
}
