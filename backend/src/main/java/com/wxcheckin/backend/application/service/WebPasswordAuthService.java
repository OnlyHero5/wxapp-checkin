package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.UserProfileDto;
import com.wxcheckin.backend.api.dto.WebAuthChangePasswordResponse;
import com.wxcheckin.backend.api.dto.WebAuthLoginResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.PermissionCatalog;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxAdminRosterRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Web 端账号密码认证服务。
 *
 * 背景与约束：
 * - 访问形态要求支持 HTTP + 内网 IP + 端口，因此无法依赖 Passkey/WebAuthn 的 HTTPS 安全上下文；
 * - 本次认证目标是“能跑通 Web-only 业务链路”，不追求公网级别安全强度；
 * - 当前版本已取消“浏览器绑定”强依赖：登录与业务接口只依赖 session_token（仍保留强制改密）。
 *
 * 关键业务规则：
 * 1) 默认密码固定为 123（只保存 bcrypt hash）
 * 2) 用户首次 Web 登录后必须改密（must_change_password=true 时，业务 API 统一拒绝）
 */
@Service
public class WebPasswordAuthService {

  private static final String DEFAULT_PASSWORD = "123";

  // 改密规则不追求“复杂强度”，只做最低门槛，避免用户继续使用 123。
  private static final int MIN_PASSWORD_LENGTH = 6;
  private static final int MAX_PASSWORD_LENGTH = 64;

  private final LegacyUserLookupService legacyUserLookupService;
  private final WxAdminRosterRepository adminRosterRepository;
  private final WxUserAuthExtRepository userRepository;
  private final WxSessionRepository sessionRepository;
  private final SessionService sessionService;
  private final TokenGenerator tokenGenerator;
  private final JsonCodec jsonCodec;
  private final AppProperties appProperties;
  private final Clock clock;

  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

  public WebPasswordAuthService(
      LegacyUserLookupService legacyUserLookupService,
      WxAdminRosterRepository adminRosterRepository,
      WxUserAuthExtRepository userRepository,
      WxSessionRepository sessionRepository,
      SessionService sessionService,
      TokenGenerator tokenGenerator,
      JsonCodec jsonCodec,
      AppProperties appProperties,
      Clock clock
  ) {
    this.legacyUserLookupService = legacyUserLookupService;
    this.adminRosterRepository = adminRosterRepository;
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.sessionService = sessionService;
    this.tokenGenerator = tokenGenerator;
    this.jsonCodec = jsonCodec;
    this.appProperties = appProperties;
    this.clock = clock;
  }

  @Transactional
  public WebAuthLoginResponse login(String studentId, String password) {
    String normalizedStudentId = normalize(studentId);
    String normalizedPassword = normalize(password);

    LegacyUserLookupService.LegacyUserRow legacyUser = legacyUserLookupService.findLegacyUserByStudentId(normalizedStudentId)
        .orElseThrow(() -> new BusinessException("forbidden", "学号不存在，请确认后重试", "identity_not_found"));

    WxUserAuthExtEntity user = loadOrCreateUser(legacyUser, normalizedStudentId);
    // 先校验密码：避免对未通过认证的请求暴露过多账号/绑定状态细节。
    ensurePasswordMatches(user, normalizedPassword);

    // 每次登录都用“权威来源”刷新用户基本信息与角色权限快照，避免角色变更后旧权限一直保留。
    String legacyName = normalize(legacyUser.name());
    RoleDecision roleDecision = resolveRoleDecision(normalizedStudentId, legacyName, legacyUser);
    user.setLegacyUserId(legacyUser.id());
    user.setStudentId(normalizedStudentId);
    user.setName(legacyName);
    user.setRoleCode(roleDecision.role().getCode());
    user.setPermissionsJson(jsonCodec.writeList(roleDecision.permissions()));
    userRepository.save(user);

    boolean mustChangePassword = mustChangePassword(user);
    String message = mustChangePassword ? "登录成功，请修改密码" : "登录成功";
    return issueSession(user, message, mustChangePassword);
  }

  @Transactional
  public WebAuthChangePasswordResponse changePassword(
      String sessionToken,
      String oldPassword,
      String newPassword
  ) {
    // 改密入口允许在“强制改密态”访问，因此必须绕过 SessionService 的统一拦截。
    SessionPrincipal principal = sessionService.requireWebPrincipalAllowPasswordChange(sessionToken);
    WxUserAuthExtEntity user = principal.user();

    String normalizedOldPassword = normalize(oldPassword);
    String normalizedNewPassword = normalize(newPassword);
    validateNewPassword(normalizedNewPassword);

    if (!isCurrentPassword(user, normalizedOldPassword)) {
      throw new BusinessException("forbidden", "旧密码不正确", "invalid_password");
    }

    // 改密成功后：
    // - 更新 hash
    // - 解除强制改密
    // - 记录时间，方便后续排障与审计（若未来需要）
    user.setPasswordHash(passwordEncoder.encode(normalizedNewPassword));
    user.setMustChangePassword(false);
    user.setPasswordUpdatedAt(now());
    userRepository.save(user);

    return new WebAuthChangePasswordResponse("success", "密码修改成功", false);
  }

  private WxUserAuthExtEntity loadOrCreateUser(LegacyUserLookupService.LegacyUserRow legacyUser, String studentId) {
    Optional<WxUserAuthExtEntity> existing = userRepository.findByLegacyUserId(legacyUser.id())
        .or(() -> userRepository.findByStudentId(studentId));
    if (existing.isPresent()) {
      return existing.get();
    }

    // 首次 Web 登录：创建本地扩展用户记录，并初始化默认密码（bcrypt hash）。
    WxUserAuthExtEntity entity = new WxUserAuthExtEntity();
    entity.setLegacyUserId(legacyUser.id());
    // `wx_identity` 列是 NOT NULL UNIQUE；Web-only 方案用稳定前缀生成。
    entity.setWxIdentity("web:" + studentId);
    entity.setStudentId(studentId);
    entity.setName(normalize(legacyUser.name()));
    entity.setRoleCode(RoleType.NORMAL.getCode());
    entity.setPermissionsJson("[]");
    entity.setRegistered(true);
    entity.setPasswordHash(passwordEncoder.encode(DEFAULT_PASSWORD));
    entity.setMustChangePassword(true);
    return entity;
  }

  private void ensurePasswordMatches(WxUserAuthExtEntity user, String rawPassword) {
    String storedHash = normalize(user.getPasswordHash());
    if (storedHash.isEmpty()) {
      // 历史数据兼容：没有 hash 视为“仍是默认密码 123，且需要改密”。
      if (!DEFAULT_PASSWORD.equals(rawPassword)) {
        throw new BusinessException("forbidden", "密码错误", "invalid_password");
      }
      user.setPasswordHash(passwordEncoder.encode(DEFAULT_PASSWORD));
      user.setMustChangePassword(true);
      return;
    }

    if (!passwordEncoder.matches(rawPassword, storedHash)) {
      throw new BusinessException("forbidden", "密码错误", "invalid_password");
    }
  }

  private boolean isCurrentPassword(WxUserAuthExtEntity user, String rawPassword) {
    String storedHash = normalize(user.getPasswordHash());
    if (storedHash.isEmpty()) {
      return DEFAULT_PASSWORD.equals(rawPassword);
    }
    return passwordEncoder.matches(rawPassword, storedHash);
  }

  private void validateNewPassword(String newPassword) {
    if (newPassword.isEmpty()) {
      throw new BusinessException("invalid_param", "新密码不能为空");
    }
    if (newPassword.length() < MIN_PASSWORD_LENGTH) {
      throw new BusinessException("invalid_param", "新密码过短，请设置至少 " + MIN_PASSWORD_LENGTH + " 位", "password_too_short");
    }
    if (newPassword.length() > MAX_PASSWORD_LENGTH) {
      throw new BusinessException("invalid_param", "新密码过长，请设置不超过 " + MAX_PASSWORD_LENGTH + " 位", "password_too_long");
    }
  }

  private RoleDecision resolveRoleDecision(
      String studentId,
      String name,
      LegacyUserLookupService.LegacyUserRow legacyUser
  ) {
    boolean adminVerified = adminRosterRepository.existsByStudentIdAndNameAndActiveTrue(studentId, name);
    boolean legacyStaff = legacyUser != null
        && legacyUser.role() != null
        && legacyUser.role() >= 0
        && legacyUser.role() <= 3;

    RoleType role = (adminVerified || legacyStaff) ? RoleType.STAFF : RoleType.NORMAL;
    List<String> permissions = role == RoleType.STAFF
        ? PermissionCatalog.STAFF_PERMISSIONS
        : PermissionCatalog.NORMAL_PERMISSIONS;
    return new RoleDecision(role, permissions);
  }

  private WebAuthLoginResponse issueSession(WxUserAuthExtEntity user, String message, boolean mustChangePassword) {
    String sessionToken = tokenGenerator.newSessionToken();
    Instant now = now();
    List<String> permissions = jsonCodec.readStringList(user.getPermissionsJson());

    WxSessionEntity session = new WxSessionEntity();
    session.setSessionToken(sessionToken);
    session.setUser(user);
    session.setRoleSnapshot(normalize(user.getRoleCode()));
    session.setPermissionsJson(jsonCodec.writeList(permissions));
    session.setExpiresAt(now.plusSeconds(appProperties.getSession().getTtlSeconds()));
    session.setLastAccessAt(now);
    sessionRepository.save(session);

    return new WebAuthLoginResponse(
        "success",
        message,
        sessionToken,
        session.getExpiresAt().toEpochMilli(),
        user.getRoleCode(),
        permissions,
        mustChangePassword,
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

  private boolean mustChangePassword(WxUserAuthExtEntity user) {
    Boolean flag = user == null ? null : user.getMustChangePassword();
    return flag == null || Boolean.TRUE.equals(flag);
  }

  private Instant now() {
    return Instant.now(clock);
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private String safe(String value) {
    return value == null ? "" : value;
  }

  private record RoleDecision(RoleType role, List<String> permissions) {
  }
}
