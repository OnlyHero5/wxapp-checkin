package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxReplayGuardRepository;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 动态码相关表的定期清理任务。
 *
 * <p>当前 Web-only 正式链路仍会写 {@code wx_replay_guard} 用于防重放，
 * 因此需要定期清理过期数据，避免表无限增长。</p>
 */
@Component
@ConditionalOnProperty(name = "app.qr.cleanup-enabled", havingValue = "true", matchIfMissing = true)
public class QrMaintenanceJob {

  private static final Logger log = LoggerFactory.getLogger(QrMaintenanceJob.class);

  private final WxReplayGuardRepository replayGuardRepository;
  private final AppProperties appProperties;
  private final Clock clock;

  public QrMaintenanceJob(
      WxReplayGuardRepository replayGuardRepository,
      AppProperties appProperties,
      Clock clock
  ) {
    this.replayGuardRepository = replayGuardRepository;
    this.appProperties = appProperties;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${app.qr.cleanup-interval-ms:300000}")
  public void cleanupExpiredQrArtifacts() {
    try {
      Instant now = Instant.now(clock);

      long replayRetentionSeconds = Math.max(0L, appProperties.getQr().getReplayGuardRetentionSeconds());
      Instant replayCutoff = now.minusSeconds(replayRetentionSeconds);
      int replayDeleted = replayGuardRepository.deleteByExpiresAtBefore(replayCutoff);

      log.debug("Dynamic code cleanup completed: replayGuardDeleted={}", replayDeleted);
    } catch (DataAccessException ex) {
      log.debug("Dynamic code cleanup skipped due to DB access error: {}", ex.getMessage());
    }
  }
}
