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
  private static final String PASSWORD_CHANGE_REQUIRED_MESSAGE = "请先修改密码";

  private final WxSessionRepository sessionRepository;
  private final JsonCodec jsonCodec;
  private final Clock clock;

  public SessionService(
      WxSessionRepository sessionRepository,
      JsonCodec jsonCodec,
      Clock clock
  ) {
    this.sessionRepository = sessionRepository;
    this.jsonCodec = jsonCodec;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public SessionPrincipal requirePrincipal(String sessionToken) {
    WxSessionEntity session = requireSession(sessionToken);
    List<String> permissions = jsonCodec.readStringList(session.getPermissionsJson());
    return new SessionPrincipal(
        session,
        session.getUser(),
        RoleType.fromCode(session.getRoleSnapshot()),
        permissions
    );
  }

  @Transactional(readOnly = true)
  public SessionPrincipal requireWebPrincipal(String sessionToken) {
    // Web 端账号密码登录要求“首次登录强制改密”，因此这里做统一拦截：
    // - 改密接口自身需要绕过该检查（使用 allowPasswordChange 版本）
    SessionPrincipal principal = requireWebPrincipalAllowPasswordChange(sessionToken);
    if (mustChangePassword(principal.user())) {
      throw new BusinessException("forbidden", PASSWORD_CHANGE_REQUIRED_MESSAGE, "password_change_required");
    }
    return principal;
  }

  /**
   * 仅用于“改密接口”等少数允许在强制改密态下访问的入口。
   *
   * 该方法仍会校验 session token 有效，但不会拦截 must_change_password。
   */
  @Transactional(readOnly = true)
  public SessionPrincipal requireWebPrincipalAllowPasswordChange(String sessionToken) {
    return requirePrincipal(sessionToken);
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

  private boolean mustChangePassword(com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity user) {
    // 允许为 null：代表历史数据尚未初始化密码字段，Web 端按“需要改密”处理更安全。
    Boolean flag = user == null ? null : user.getMustChangePassword();
    return flag == null || Boolean.TRUE.equals(flag);
  }

  private WxSessionEntity requireSession(String sessionToken) {
    String token = normalize(sessionToken);
    if (token.isEmpty()) {
      throw expired();
    }
    WxSessionEntity session = sessionRepository.findBySessionToken(token).orElseThrow(this::expired);
    if (session.getExpiresAt().isBefore(Instant.now(clock))) {
      throw expired();
    }
    return session;
  }

  private String normalize(String text) {
    return text == null ? "" : text.trim();
  }
}
