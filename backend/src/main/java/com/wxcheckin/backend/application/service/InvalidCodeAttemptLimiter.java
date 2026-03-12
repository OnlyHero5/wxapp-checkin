package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.config.AppProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * 动态码验码失败的限流器（内存版，按窗口计数）。
 *
 * <p>为什么需要限流：
 * - 6 位数字码理论上可被暴力猜测；
 * - 动态码时效短（10 秒），但如果没有“尝试次数”限制，仍可能被高并发撞库式猜中；
 * - 本仓库当前部署形态多为校内内网，限流策略优先保证“不会影响正常用户”，再逐步增强为更严格的风控。
 *
 * <p>实现取舍：
 * - 当前先实现“单实例内存窗口计数”，避免引入 Redis 依赖导致测试/本地环境复杂度上升；
 * - 若后续需要多实例一致性，可把该实现替换为 Redis INCR + EXPIRE（接口保持不变）。
 */
@Component
public class InvalidCodeAttemptLimiter {

  private static final int CLEANUP_THRESHOLD = 10_000;

  private final AppProperties appProperties;
  private final Clock clock;

  private final ConcurrentHashMap<String, AttemptWindow> windows = new ConcurrentHashMap<>();

  public InvalidCodeAttemptLimiter(AppProperties appProperties, Clock clock) {
    this.appProperties = appProperties;
    this.clock = clock;
  }

  /**
   * 记录一次“验码失败”并在超过阈值时抛出限流异常。
   *
   * <p>当前同时按两种维度计数（任一超限都拦截）：
   * - user_id + activity_id
   * - ip + activity_id
   */
  public void recordInvalidAttemptOrThrow(Long userId, String activityId, String clientIp) {
    String normalizedActivityId = normalize(activityId);
    if (normalizedActivityId.isEmpty()) {
      return;
    }

    AppProperties.InvalidCodeProperties config = appProperties.getRisk().getInvalidCode();
    int windowSeconds = config.getWindowSeconds() <= 0 ? 60 : config.getWindowSeconds();
    long nowMs = Instant.now(clock).toEpochMilli();
    long windowMs = windowSeconds * 1000L;

    int maxPerUser = config.getMaxAttemptsPerUser();
    int maxPerIp = config.getMaxAttemptsPerIp();

    if (maxPerUser > 0 && userId != null) {
      int count = incrementAndGet("u:" + userId + ":" + normalizedActivityId, nowMs, windowMs);
      if (count > maxPerUser) {
        throw rateLimited(windowSeconds);
      }
    }

    String normalizedIp = normalize(clientIp);
    if (maxPerIp > 0 && !normalizedIp.isEmpty()) {
      int count = incrementAndGet("ip:" + normalizedIp + ":" + normalizedActivityId, nowMs, windowMs);
      if (count > maxPerIp) {
        throw rateLimited(windowSeconds);
      }
    }
  }

  private int incrementAndGet(String key, long nowMs, long windowMs) {
    AttemptWindow updated = windows.compute(key, (ignored, existing) -> {
      if (existing == null || existing.expiresAtMs <= nowMs) {
        return new AttemptWindow(nowMs + windowMs, 1);
      }
      existing.count += 1;
      return existing;
    });

    // best-effort 清理：避免 map 无限增长（不追求严格 LRU，优先简单可靠）。
    if (windows.size() > CLEANUP_THRESHOLD) {
      windows.entrySet().removeIf((entry) -> entry.getValue().expiresAtMs <= nowMs);
    }

    return updated.count;
  }

  private BusinessException rateLimited(int windowSeconds) {
    return new BusinessException(
        "forbidden",
        "验证码尝试次数过多，请稍后再试（" + windowSeconds + " 秒后重试）",
        "rate_limited"
    );
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private static class AttemptWindow {
    private final long expiresAtMs;
    private int count;

    AttemptWindow(long expiresAtMs, int count) {
      this.expiresAtMs = expiresAtMs;
      this.count = count;
    }
  }
}
