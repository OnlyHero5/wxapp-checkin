package com.wxcheckin.backend.application.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Periodic cleanup task for expired sessions.
 */
@Component
public class SessionMaintenanceJob {

  private final SessionService sessionService;

  public SessionMaintenanceJob(SessionService sessionService) {
    this.sessionService = sessionService;
  }

  @Scheduled(fixedDelay = 300000L)
  public void cleanupExpiredSessions() {
    sessionService.cleanupExpired();
  }
}
