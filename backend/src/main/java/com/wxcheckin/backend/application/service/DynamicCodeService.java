package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.WebCodeSessionResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.ActionType;
import com.wxcheckin.backend.domain.model.ActivityProgressStatus;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class DynamicCodeService {

  private static final int ROTATE_SECONDS = 10;

  private final SessionService sessionService;
  private final ActivityTimeWindowService activityTimeWindowService;
  private final WxActivityProjectionRepository activityRepository;
  private final Clock clock;
  private final SecretKeySpec keySpec;

  public DynamicCodeService(
      SessionService sessionService,
      ActivityTimeWindowService activityTimeWindowService,
      WxActivityProjectionRepository activityRepository,
      Clock clock,
      AppProperties appProperties
  ) {
    this.sessionService = sessionService;
    this.activityTimeWindowService = activityTimeWindowService;
    this.activityRepository = activityRepository;
    this.clock = clock;
    this.keySpec = new SecretKeySpec(
        appProperties.getQr().getSigningKey().getBytes(StandardCharsets.UTF_8),
        "HmacSHA256"
    );
  }

  public WebCodeSessionResponse issue(String sessionToken, String activityId, String actionTypeText) {
    // 动态码发码入口必须同时满足三类条件：
    // 1) 必须是 staff 且会话有效（并已完成强制改密）
    // 2) 活动存在且允许当前动作（签到/签退）
    // 3) 当前处于允许发码的时间窗内（与详情页 can_checkin/can_checkout 同一口径）
    SessionPrincipal principal = sessionService.requireWebPrincipal(sessionToken);
    if (principal.role() != RoleType.STAFF) {
      throw new BusinessException("forbidden", "仅工作人员可获取动态码");
    }

    String normalizedActivityId = normalize(activityId);
    if (normalizedActivityId.isEmpty()) {
      throw new BusinessException("invalid_param", "activity_id 参数缺失");
    }

    ActionType actionType = ActionType.fromCode(actionTypeText);
    if (actionType == null) {
      throw new BusinessException("invalid_param", "action_type 仅支持 checkin/checkout");
    }

    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(normalizedActivityId)
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));
    if (ActivityProgressStatus.fromCode(activity.getProgressStatus()) == ActivityProgressStatus.COMPLETED) {
      throw new BusinessException("forbidden", "活动已结束，无法生成动态码");
    }
    if (actionType == ActionType.CHECKIN && !Boolean.TRUE.equals(activity.getSupportCheckin())) {
      throw new BusinessException("forbidden", "该活动暂不支持签到动态码");
    }
    if (actionType == ActionType.CHECKOUT && !Boolean.TRUE.equals(activity.getSupportCheckout())) {
      throw new BusinessException("forbidden", "该活动暂不支持签退动态码");
    }

    activityTimeWindowService.ensureWithinIssueWindow(activity);

    long serverTimeMs = Instant.now(clock).toEpochMilli();
    long slotWindowMs = ROTATE_SECONDS * 1000L;
    long slot = serverTimeMs / slotWindowMs;
    long expiresAt = (slot + 1) * slotWindowMs;
    long expiresInMs = Math.max(0L, expiresAt - serverTimeMs);
    String code = generateCode(activity.getActivityId(), actionType, slot);
    return new WebCodeSessionResponse(
        "success",
        "动态码获取成功",
        activity.getActivityId(),
        actionType.getCode(),
        code,
        slot,
        expiresAt,
        expiresInMs,
        serverTimeMs,
        safeCount(activity.getCheckinCount()),
        safeCount(activity.getCheckoutCount())
    );
  }

  public ValidatedCode validateCode(String activityId, ActionType actionType, String code) {
    String normalizedCode = normalizeCode(code);
    if (normalizedCode.isEmpty()) {
      throw new BusinessException("invalid_code", "动态码错误，请重新确认");
    }
    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(normalize(activityId))
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));
    long now = Instant.now(clock).toEpochMilli();
    long rotateWindowMs = ROTATE_SECONDS * 1000L;
    long currentSlot = now / rotateWindowMs;

    // Web 正式链路只认当前 slot 的数字码；
    // 若命中上一 slot，明确按“已过期”返回，而不是笼统地报错码。
    if (generateCode(activity.getActivityId(), actionType, currentSlot).equals(normalizedCode)) {
      return new ValidatedCode(currentSlot, "web-code:" + normalizedCode);
    }
    if (currentSlot > 0 && generateCode(activity.getActivityId(), actionType, currentSlot - 1).equals(normalizedCode)) {
      throw new BusinessException("expired", "动态码已过期，请重新输入最新验证码");
    }
    throw new BusinessException("invalid_code", "动态码错误，请重新确认");
  }

  private String generateCode(String activityId, ActionType actionType, long slot) {
    try {
      // 这里故意不依赖数据库或 issue log，
      // 只要服务端 secret、一致的 activity/action/slot 输入相同，就能算出同一码值。
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(keySpec);
      byte[] digest = mac.doFinal(("web-code:v1|%s|%s|%d".formatted(activityId, actionType.getCode(), slot))
          .getBytes(StandardCharsets.UTF_8));
      int value = Math.floorMod(ByteBuffer.wrap(digest).getInt(), 1_000_000);
      return "%06d".formatted(value);
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to generate dynamic code", ex);
    }
  }

  private int safeCount(Integer value) {
    return value == null ? 0 : value;
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private String normalizeCode(String value) {
    return normalize(value).replaceAll("\\D", "");
  }

  public record ValidatedCode(
      long slot,
      String rawPayload
  ) {
  }
}
