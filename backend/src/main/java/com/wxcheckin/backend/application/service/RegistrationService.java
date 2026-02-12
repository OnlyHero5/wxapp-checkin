package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.RegisterRequest;
import com.wxcheckin.backend.api.dto.RegisterResponse;
import com.wxcheckin.backend.api.dto.UserProfileDto;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.domain.model.PermissionCatalog;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxAdminRosterRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implements A-02 registration binding and role determination.
 */
@Service
public class RegistrationService {

  private final SessionService sessionService;
  private final WxUserAuthExtRepository userRepository;
  private final WxAdminRosterRepository adminRosterRepository;
  private final WxSessionRepository sessionRepository;
  private final LegacyUserLookupService legacyUserLookupService;
  private final RegisterPayloadIntegrityService registerPayloadIntegrityService;
  private final JsonCodec jsonCodec;

  public RegistrationService(
      SessionService sessionService,
      WxUserAuthExtRepository userRepository,
      WxAdminRosterRepository adminRosterRepository,
      WxSessionRepository sessionRepository,
      LegacyUserLookupService legacyUserLookupService,
      RegisterPayloadIntegrityService registerPayloadIntegrityService,
      JsonCodec jsonCodec
  ) {
    this.sessionService = sessionService;
    this.userRepository = userRepository;
    this.adminRosterRepository = adminRosterRepository;
    this.sessionRepository = sessionRepository;
    this.legacyUserLookupService = legacyUserLookupService;
    this.registerPayloadIntegrityService = registerPayloadIntegrityService;
    this.jsonCodec = jsonCodec;
  }

  @Transactional
  public RegisterResponse register(RegisterRequest request) {
    SessionPrincipal principal = sessionService.requirePrincipal(request.sessionToken());
    registerPayloadIntegrityService.verify(request);
    WxUserAuthExtEntity user = principal.user();

    String studentId = normalize(request.studentId());
    String name = normalize(request.name());
    String department = normalize(request.department());
    String club = normalize(request.club());

    if (Boolean.TRUE.equals(user.getRegistered())) {
      boolean sameBinding = studentId.equals(normalize(user.getStudentId()))
          && name.equals(normalize(user.getName()));
      if (!sameBinding) {
        throw new BusinessException("wx_already_bound", "当前微信已绑定其他学号姓名，请勿重复绑定");
      }
    }

    Optional<WxUserAuthExtEntity> existingBinding = userRepository.findByStudentId(studentId);
    if (existingBinding.isPresent() && !existingBinding.get().getId().equals(user.getId())) {
      throw new BusinessException("student_already_bound", "该学号已绑定其他微信，请联系管理员");
    }

    boolean adminVerified = adminRosterRepository.existsByStudentIdAndNameAndActiveTrue(studentId, name);
    RoleType role = adminVerified ? RoleType.STAFF : RoleType.NORMAL;
    List<String> permissions = role == RoleType.STAFF
        ? PermissionCatalog.STAFF_PERMISSIONS
        : PermissionCatalog.NORMAL_PERMISSIONS;

    user.setStudentId(studentId);
    user.setName(name);
    user.setDepartment(department);
    user.setClub(club);
    user.setRegistered(true);
    user.setRoleCode(role.getCode());
    user.setPermissionsJson(jsonCodec.writeList(permissions));
    if (user.getLegacyUserId() == null) {
      legacyUserLookupService.findLegacyUserIdByStudentId(studentId).ifPresent(user::setLegacyUserId);
    }
    userRepository.save(user);

    WxSessionEntity currentSession = principal.session();
    currentSession.setRoleSnapshot(role.getCode());
    currentSession.setPermissionsJson(jsonCodec.writeList(permissions));
    sessionRepository.save(currentSession);

    return new RegisterResponse(
        "success",
        "注册绑定成功",
        role.getCode(),
        permissions,
        adminVerified,
        true,
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

  private String normalize(String text) {
    return text == null ? "" : text.trim();
  }

  private String safe(String value) {
    return value == null ? "" : value;
  }
}
