package com.wxcheckin.backend.application.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodic cleanup task for expired sessions.
 */
@Component
public class SessionMaintenanceJob {

  private static final Logger log = LoggerFactory.getLogger(SessionMaintenanceJob.class);

  private final SessionService sessionService;

  public SessionMaintenanceJob(SessionService sessionService) {
    this.sessionService = sessionService;
  }

  @Scheduled(fixedDelay = 300000L)
  public void cleanupExpiredSessions() {
    try {
      sessionService.cleanupExpired();
    } catch (DataAccessException ex) {
      log.debug("Session cleanup skipped due to DB access error: {}", ex.getMessage());
    }
  }
}
