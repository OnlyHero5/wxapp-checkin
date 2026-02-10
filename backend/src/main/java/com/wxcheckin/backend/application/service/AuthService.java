package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.UserProfileDto;
import com.wxcheckin.backend.api.dto.WxLoginResponse;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.PermissionCatalog;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implements A-01 login flow.
 */
@Service
public class AuthService {

  private final WeChatIdentityResolver identityResolver;
  private final WxUserAuthExtRepository userRepository;
  private final WxSessionRepository sessionRepository;
  private final TokenGenerator tokenGenerator;
  private final JsonCodec jsonCodec;
  private final AppProperties appProperties;
  private final Clock clock;

  public AuthService(
      WeChatIdentityResolver identityResolver,
      WxUserAuthExtRepository userRepository,
      WxSessionRepository sessionRepository,
      TokenGenerator tokenGenerator,
      JsonCodec jsonCodec,
      AppProperties appProperties,
      Clock clock
  ) {
    this.identityResolver = identityResolver;
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.tokenGenerator = tokenGenerator;
    this.jsonCodec = jsonCodec;
    this.appProperties = appProperties;
    this.clock = clock;
  }

  @Transactional
  public WxLoginResponse login(String wxLoginCode) {
    String wxIdentity = identityResolver.resolveIdentity(wxLoginCode);

    WxUserAuthExtEntity user = userRepository.findByWxIdentity(wxIdentity)
        .orElseGet(() -> {
          WxUserAuthExtEntity entity = new WxUserAuthExtEntity();
          entity.setWxIdentity(wxIdentity);
          entity.setRoleCode(RoleType.NORMAL.getCode());
          entity.setPermissionsJson("[]");
          entity.setRegistered(false);
          return userRepository.save(entity);
        });

    RoleType role = RoleType.fromCode(user.getRoleCode());
    List<String> permissions = jsonCodec.readStringList(user.getPermissionsJson());
    if (permissions.isEmpty()) {
      permissions = defaultPermissions(role);
      user.setPermissionsJson(jsonCodec.writeList(permissions));
      userRepository.save(user);
    }

    String sessionToken = tokenGenerator.newSessionToken();
    Instant now = Instant.now(clock);
    WxSessionEntity session = new WxSessionEntity();
    session.setSessionToken(sessionToken);
    session.setUser(user);
    session.setRoleSnapshot(role.getCode());
    session.setPermissionsJson(jsonCodec.writeList(permissions));
    session.setExpiresAt(now.plusSeconds(appProperties.getSession().getTtlSeconds()));
    session.setLastAccessAt(now);
    sessionRepository.save(session);

    return new WxLoginResponse(
        "success",
        "登录成功",
        sessionToken,
        user.getWxIdentity(),
        role.getCode(),
        permissions,
        Boolean.TRUE.equals(user.getRegistered()),
        buildProfile(user)
    );
  }

  private UserProfileDto buildProfile(WxUserAuthExtEntity user) {
    return new UserProfileDto(
        safe(user.getStudentId()),
        safe(user.getName()),
        safe(user.getDepartment()),
        safe(user.getClub()),
        safe(user.getAvatarUrl()),
        user.getSocialScore() == null ? 0 : user.getSocialScore(),
        user.getLectureScore() == null ? 0 : user.getLectureScore()
    );
  }

  private List<String> defaultPermissions(RoleType role) {
    return role == RoleType.STAFF
        ? PermissionCatalog.STAFF_PERMISSIONS
        : PermissionCatalog.NORMAL_PERMISSIONS;
  }

  private String safe(String value) {
    return value == null ? "" : value;
  }
}
