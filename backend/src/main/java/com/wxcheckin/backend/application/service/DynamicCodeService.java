package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.CreateQrSessionResponse;
import com.wxcheckin.backend.api.dto.WebCodeSessionResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.ActionType;
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

  private final QrSessionService qrSessionService;
  private final WxActivityProjectionRepository activityRepository;
  private final Clock clock;
  private final SecretKeySpec keySpec;
  private final AppProperties appProperties;

  public DynamicCodeService(
      QrSessionService qrSessionService,
      WxActivityProjectionRepository activityRepository,
      Clock clock,
      AppProperties appProperties
  ) {
    this.qrSessionService = qrSessionService;
    this.activityRepository = activityRepository;
    this.clock = clock;
    this.appProperties = appProperties;
    this.keySpec = new SecretKeySpec(
        appProperties.getQr().getSigningKey().getBytes(StandardCharsets.UTF_8),
        "HmacSHA256"
    );
  }

  public WebCodeSessionResponse issue(String sessionToken, String browserBindingKey, String activityId, String actionTypeText) {
    // 发码入口继续复用既有的 staff 权限、活动时间窗和配置持久化规则，
    // 避免 Web 动态码和旧二维码在“什么时候允许发码”上分叉。
    CreateQrSessionResponse qrSession = qrSessionService.issue(
        sessionToken,
        browserBindingKey,
        activityId,
        actionTypeText,
        null,
        null
    );
    ActionType actionType = ActionType.fromCode(qrSession.actionType());
    WxActivityProjectionEntity activity = activityRepository.findByActivityIdAndActiveTrue(qrSession.activityId())
        .orElseThrow(() -> new BusinessException("invalid_activity", "活动不存在或已下线"));
    String code = generateCode(qrSession.activityId(), actionType, qrSession.slot());
    long expiresInMs = Math.max(0L, qrSession.displayExpireAt() - qrSession.serverTime());
    return new WebCodeSessionResponse(
        "success",
        "动态码获取成功",
        qrSession.activityId(),
        qrSession.actionType(),
        code,
        qrSession.slot(),
        qrSession.displayExpireAt(),
        expiresInMs,
        qrSession.serverTime(),
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
    int rotateSeconds = resolveRotateSeconds(activity);
    long rotateWindowMs = rotateSeconds * 1000L;
    long now = Instant.now(clock).toEpochMilli();
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

  private int resolveRotateSeconds(WxActivityProjectionEntity activity) {
    if (activity.getRotateSeconds() != null && activity.getRotateSeconds() > 0) {
      return activity.getRotateSeconds();
    }
    return appProperties.getQr().getDefaultRotateSeconds();
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
