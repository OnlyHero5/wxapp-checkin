package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxQrIssueLogRepository;
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
 * Periodic cleanup task for QR related ephemeral tables.
 *
 * <p>Prevents {@code wx_qr_issue_log} and {@code wx_replay_guard} from growing without bound.</p>
 */
@Component
@ConditionalOnProperty(name = "app.qr.cleanup-enabled", havingValue = "true", matchIfMissing = true)
public class QrMaintenanceJob {

  private static final Logger log = LoggerFactory.getLogger(QrMaintenanceJob.class);

  private final WxQrIssueLogRepository qrIssueLogRepository;
  private final WxReplayGuardRepository replayGuardRepository;
  private final AppProperties appProperties;
  private final Clock clock;

  public QrMaintenanceJob(
      WxQrIssueLogRepository qrIssueLogRepository,
      WxReplayGuardRepository replayGuardRepository,
      AppProperties appProperties,
      Clock clock
  ) {
    this.qrIssueLogRepository = qrIssueLogRepository;
    this.replayGuardRepository = replayGuardRepository;
    this.appProperties = appProperties;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${app.qr.cleanup-interval-ms:300000}")
  public void cleanupExpiredQrArtifacts() {
    try {
      Instant now = Instant.now(clock);

      long issueRetentionSeconds = Math.max(0L, appProperties.getQr().getIssueLogRetentionSeconds());
      long issueCutoffMs = now.toEpochMilli() - issueRetentionSeconds * 1000L;
      int issueDeleted = qrIssueLogRepository.deleteByAcceptExpireAtLessThan(issueCutoffMs);

      long replayRetentionSeconds = Math.max(0L, appProperties.getQr().getReplayGuardRetentionSeconds());
      Instant replayCutoff = now.minusSeconds(replayRetentionSeconds);
      int replayDeleted = replayGuardRepository.deleteByExpiresAtBefore(replayCutoff);

      log.debug("QR cleanup completed: issueLogDeleted={}, replayGuardDeleted={}", issueDeleted, replayDeleted);
    } catch (DataAccessException ex) {
      log.debug("QR cleanup skipped due to DB access error: {}", ex.getMessage());
    }
  }
}
