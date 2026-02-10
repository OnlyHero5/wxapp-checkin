package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Session read/write service used by all authenticated APIs.
 */
@Service
public class SessionService {

  private static final String SESSION_EXPIRED_MESSAGE = "会话失效，请重新登录";

  private final WxSessionRepository sessionRepository;
  private final JsonCodec jsonCodec;
  private final Clock clock;

  public SessionService(WxSessionRepository sessionRepository, JsonCodec jsonCodec, Clock clock) {
    this.sessionRepository = sessionRepository;
    this.jsonCodec = jsonCodec;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public SessionPrincipal requirePrincipal(String sessionToken) {
    String token = normalize(sessionToken);
    if (token.isEmpty()) {
      throw expired();
    }
    WxSessionEntity session = sessionRepository.findBySessionToken(token).orElseThrow(this::expired);
    if (session.getExpiresAt().isBefore(Instant.now(clock))) {
      throw expired();
    }
    List<String> permissions = jsonCodec.readStringList(session.getPermissionsJson());
    return new SessionPrincipal(
        session,
        session.getUser(),
        RoleType.fromCode(session.getRoleSnapshot()),
        permissions
    );
  }

  @Transactional
  public void touch(WxSessionEntity session) {
    session.setLastAccessAt(Instant.now(clock));
    sessionRepository.save(session);
  }

  @Transactional
  public void cleanupExpired() {
    sessionRepository.deleteByExpiresAtBefore(Instant.now(clock));
  }

  private BusinessException expired() {
    return new BusinessException("forbidden", SESSION_EXPIRED_MESSAGE, "session_expired");
  }

  private String normalize(String text) {
    return text == null ? "" : text.trim();
  }
}
