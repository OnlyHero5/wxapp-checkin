package com.wxcheckin.backend.application.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wxcheckin.backend.api.dto.UserProfileDto;
import com.wxcheckin.backend.api.dto.WebAuthSessionResponse;
import com.wxcheckin.backend.api.dto.WebBindVerifyResponse;
import com.wxcheckin.backend.api.dto.WebPasskeyLoginCompleteRequest;
import com.wxcheckin.backend.api.dto.WebPasskeyLoginOptionsResponse;
import com.wxcheckin.backend.api.dto.WebPasskeyRegisterCompleteRequest;
import com.wxcheckin.backend.api.dto.WebPasskeyRegisterOptionsResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.support.JsonCodec;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.domain.model.PermissionCatalog;
import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebBrowserBindingEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebPasskeyChallengeEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebPasskeyCredentialEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebBrowserBindingRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebPasskeyCredentialRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxAdminRosterRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxSessionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxUserAuthExtRepository;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Web-only 身份服务。
 *
 * 当前版本的目标不是“生产级完整 WebAuthn 验签”，而是：
 * 1. 实名校验、浏览器绑定、Passkey challenge、会话签发全部真实落库；
 * 2. 对 `client_data_json` 做基础 challenge/origin/type 校验；
 * 3. 给本地开发和自动化测试提供完整可运行的认证闭环。
 *
 * 也正因为如此，这里显式保留了较多中文注释，避免后续维护者误以为
 * “这里已经是正式安全方案，可以继续往上叠业务而不用补验签”。
 */
@Service
public class WebIdentityService {

  private static final String ACTIVE_STATUS = "active";
  private static final String UNBOUND_STATUS = "unbound";

  private final LegacyUserLookupService legacyUserLookupService;
  private final WxAdminRosterRepository adminRosterRepository;
  private final WxUserAuthExtRepository userRepository;
  private final WxSessionRepository sessionRepository;
  private final WebBrowserBindingRepository browserBindingRepository;
  private final WebPasskeyCredentialRepository credentialRepository;
  private final PasskeyChallengeService passkeyChallengeService;
  private final JsonCodec jsonCodec;
  private final TokenGenerator tokenGenerator;
  private final AppProperties appProperties;
  private final ObjectMapper objectMapper;
  private final Clock clock;

  public WebIdentityService(
      LegacyUserLookupService legacyUserLookupService,
      WxAdminRosterRepository adminRosterRepository,
      WxUserAuthExtRepository userRepository,
      WxSessionRepository sessionRepository,
      WebBrowserBindingRepository browserBindingRepository,
      WebPasskeyCredentialRepository credentialRepository,
      PasskeyChallengeService passkeyChallengeService,
      JsonCodec jsonCodec,
      TokenGenerator tokenGenerator,
      AppProperties appProperties,
      ObjectMapper objectMapper,
      Clock clock
  ) {
    this.legacyUserLookupService = legacyUserLookupService;
    this.adminRosterRepository = adminRosterRepository;
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
    this.browserBindingRepository = browserBindingRepository;
    this.credentialRepository = credentialRepository;
    this.passkeyChallengeService = passkeyChallengeService;
    this.jsonCodec = jsonCodec;
    this.tokenGenerator = tokenGenerator;
    this.appProperties = appProperties;
    this.objectMapper = objectMapper;
    this.clock = clock;
  }

  @Transactional
  public WebBindVerifyResponse verifyIdentity(String browserBindingKey, String studentId, String name) {
    String normalizedBrowserKey = requireBrowserBindingKey(browserBindingKey);
    String normalizedStudentId = normalize(studentId);
    String normalizedName = normalize(name);

    LegacyUserLookupService.LegacyUserRow legacyUser = legacyUserLookupService.findLegacyUserByStudentId(normalizedStudentId)
        .orElseThrow(() -> new BusinessException("forbidden", "学号不存在，请确认后重试", "identity_not_found"));
    if (!normalizedName.equals(normalize(legacyUser.name()))) {
      throw new BusinessException("forbidden", "学号与姓名不匹配，请确认后重试", "identity_mismatch");
    }

    Optional<WebBrowserBindingEntity> browserBinding = findActiveBindingByBrowser(normalizedBrowserKey);
    if (browserBinding.isPresent()
        && !normalizedStudentId.equals(normalize(browserBinding.get().getUser().getStudentId()))) {
      throw new BusinessException("forbidden", "当前浏览器已绑定其他账号，请先申请解绑", "binding_conflict");
    }

    WxUserAuthExtEntity user = loadOrCreateUser(legacyUser, normalizedStudentId, normalizedName);
    Optional<WebBrowserBindingEntity> activeUserBinding = findActiveBindingByUser(user.getId());
    if (activeUserBinding.isPresent()
        && !normalizedBrowserKey.equals(normalize(activeUserBinding.get().getBindingFingerprintHash()))) {
      throw new BusinessException("forbidden", "该账号已在其他浏览器完成绑定，请先申请解绑", "account_bound_elsewhere");
    }

    RoleDecision roleDecision = resolveRoleDecision(normalizedStudentId, normalizedName, legacyUser);
    // 这里先把实名信息和角色 hint 写回用户表，后续 register/complete 就不必再重新拼装。
    user.setLegacyUserId(legacyUser.id());
    user.setStudentId(normalizedStudentId);
    user.setName(normalizedName);
    user.setRoleCode(roleDecision.role().getCode());
    user.setPermissionsJson(jsonCodec.writeList(roleDecision.permissions()));
    userRepository.save(user);

    PasskeyChallengeService.BindTicket bindTicket = passkeyChallengeService.createBindTicket(user, normalizedBrowserKey);
    return new WebBindVerifyResponse(
        "success",
        "实名校验通过",
        bindTicket.bindTicket(),
        bindTicket.expiresAt(),
        roleDecision.role().getCode(),
        buildProfile(user)
    );
  }

  @Transactional
  public WebPasskeyRegisterOptionsResponse getRegisterOptions(String browserBindingKey, String bindTicket) {
    String normalizedBrowserKey = requireBrowserBindingKey(browserBindingKey);
    WebPasskeyChallengeEntity bindContext = passkeyChallengeService.requireBindTicket(bindTicket, normalizedBrowserKey);
    WxUserAuthExtEntity user = bindContext.getUser();

    Optional<WebBrowserBindingEntity> activeUserBinding = findActiveBindingByUser(user.getId());
    if (activeUserBinding.isPresent()
        && !normalizedBrowserKey.equals(normalize(activeUserBinding.get().getBindingFingerprintHash()))) {
      throw new BusinessException("forbidden", "该账号已在其他浏览器完成绑定，请先申请解绑", "account_bound_elsewhere");
    }

    PasskeyChallengeService.RegisterChallenge challenge = passkeyChallengeService.createRegisterChallenge(
        user,
        normalizedBrowserKey,
        normalize(bindTicket)
    );

    return new WebPasskeyRegisterOptionsResponse(
        "success",
        "注册 challenge 获取成功",
        challenge.requestId(),
        challenge.expiresAt(),
        buildRegisterOptions(user, challenge.challenge()),
        normalize(appProperties.getWebAuth().getRpId()),
        normalize(appProperties.getWebAuth().getRpName()),
        buildUserHandle(user)
    );
  }

  @Transactional
  public WebAuthSessionResponse completeRegistration(
      String browserBindingKey,
      WebPasskeyRegisterCompleteRequest request
  ) {
    String normalizedBrowserKey = requireBrowserBindingKey(browserBindingKey);
    WebPasskeyChallengeEntity registerChallenge = passkeyChallengeService.requireRegisterChallenge(
        request.requestId(),
        normalizedBrowserKey
    );
    if (!normalize(request.bindTicket()).equals(normalize(registerChallenge.getBindTicket()))) {
      throw new BusinessException("forbidden", "绑定上下文已失效，请重新验证身份", "challenge_expired");
    }
    validateClientDataJson(
        request.attestationResponse().response().clientDataJson(),
        registerChallenge.getChallenge(),
        "webauthn.create"
    );

    WxUserAuthExtEntity user = registerChallenge.getUser();
    RoleDecision roleDecision = resolveRoleDecision(
        normalize(user.getStudentId()),
        normalize(user.getName()),
        legacyUserLookupService.findLegacyUserByStudentId(user.getStudentId()).orElse(null)
    );
    user.setRegistered(true);
    user.setRoleCode(roleDecision.role().getCode());
    user.setPermissionsJson(jsonCodec.writeList(roleDecision.permissions()));
    userRepository.save(user);

    WebBrowserBindingEntity binding = upsertActiveBinding(user, normalizedBrowserKey);
    WebPasskeyCredentialEntity credential = upsertCredential(binding, request);

    passkeyChallengeService.markUsed(registerChallenge);
    passkeyChallengeService.markUsed(passkeyChallengeService.requireBindTicket(request.bindTicket(), normalizedBrowserKey));

    return issueSession(user, "注册并登录成功");
  }

  @Transactional(readOnly = true)
  public WebPasskeyLoginOptionsResponse getLoginOptions(String browserBindingKey) {
    String normalizedBrowserKey = requireBrowserBindingKey(browserBindingKey);
    WebBrowserBindingEntity binding = findActiveBindingByBrowser(normalizedBrowserKey)
        .orElseThrow(() -> new BusinessException("forbidden", "当前浏览器尚未完成绑定", "passkey_not_registered"));
    WebPasskeyCredentialEntity credential = credentialRepository.findByBinding_IdAndActiveTrue(binding.getId())
        .orElseThrow(() -> new BusinessException("forbidden", "当前浏览器尚未完成绑定", "passkey_not_registered"));

    PasskeyChallengeService.LoginChallenge challenge = passkeyChallengeService.createLoginChallenge(
        binding.getUser(),
        normalizedBrowserKey,
        credential.getCredentialId()
    );

    return new WebPasskeyLoginOptionsResponse(
        "success",
        "登录 challenge 获取成功",
        challenge.requestId(),
        challenge.expiresAt(),
        buildLoginOptions(challenge.challenge(), credential),
        normalize(appProperties.getWebAuth().getRpId())
    );
  }

  @Transactional
  public WebAuthSessionResponse completeLogin(String browserBindingKey, WebPasskeyLoginCompleteRequest request) {
    String normalizedBrowserKey = requireBrowserBindingKey(browserBindingKey);
    WebPasskeyChallengeEntity loginChallenge = passkeyChallengeService.requireLoginChallenge(
        request.requestId(),
        normalizedBrowserKey
    );
    validateClientDataJson(
        request.assertionResponse().response().clientDataJson(),
        loginChallenge.getChallenge(),
        "webauthn.get"
    );
    if (!normalize(request.assertionResponse().id()).equals(normalize(loginChallenge.getCredentialId()))) {
      throw new BusinessException("forbidden", "Passkey 校验失败，请重试", "passkey_verification_failed");
    }

    WebBrowserBindingEntity binding = findActiveBindingByBrowser(normalizedBrowserKey)
        .orElseThrow(() -> new BusinessException("forbidden", "当前浏览器尚未完成绑定", "passkey_not_registered"));
    WebPasskeyCredentialEntity credential = credentialRepository.findByBinding_IdAndActiveTrue(binding.getId())
        .orElseThrow(() -> new BusinessException("forbidden", "当前浏览器尚未完成绑定", "passkey_not_registered"));
    if (!normalize(credential.getCredentialId()).equals(normalize(request.assertionResponse().id()))) {
      throw new BusinessException("forbidden", "Passkey 校验失败，请重试", "passkey_verification_failed");
    }

    credential.setLastUsedAt(now());
    credentialRepository.save(credential);
    binding.setLastSeenAt(now());
    browserBindingRepository.save(binding);
    passkeyChallengeService.markUsed(loginChallenge);

    return issueSession(binding.getUser(), "登录成功");
  }

  private WxUserAuthExtEntity loadOrCreateUser(
      LegacyUserLookupService.LegacyUserRow legacyUser,
      String studentId,
      String name
  ) {
    return userRepository.findByLegacyUserId(legacyUser.id())
        .or(() -> userRepository.findByStudentId(studentId))
        .map(existing -> {
          existing.setLegacyUserId(legacyUser.id());
          existing.setStudentId(studentId);
          existing.setName(name);
          return existing;
        })
        .orElseGet(() -> {
          WxUserAuthExtEntity entity = new WxUserAuthExtEntity();
          entity.setLegacyUserId(legacyUser.id());
          // `wx_identity` 列当前仍是 NOT NULL UNIQUE，因此 Web-only 阶段先生成稳定 Web identity。
          entity.setWxIdentity("web:" + studentId);
          entity.setStudentId(studentId);
          entity.setName(name);
          entity.setRoleCode(RoleType.NORMAL.getCode());
          entity.setPermissionsJson("[]");
          entity.setRegistered(false);
          return entity;
        });
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

  private WebBrowserBindingEntity upsertActiveBinding(WxUserAuthExtEntity user, String browserBindingKey) {
    Optional<WebBrowserBindingEntity> otherBinding = findActiveBindingByBrowser(browserBindingKey);
    if (otherBinding.isPresent() && !otherBinding.get().getUser().getId().equals(user.getId())) {
      throw new BusinessException("forbidden", "当前浏览器已绑定其他账号，请先申请解绑", "binding_conflict");
    }
    Optional<WebBrowserBindingEntity> userBinding = findActiveBindingByUser(user.getId());
    if (userBinding.isPresent()
        && !browserBindingKey.equals(normalize(userBinding.get().getBindingFingerprintHash()))) {
      throw new BusinessException("forbidden", "该账号已在其他浏览器完成绑定，请先申请解绑", "account_bound_elsewhere");
    }

    WebBrowserBindingEntity binding = userBinding.orElseGet(WebBrowserBindingEntity::new);
    if (binding.getBindingId() == null) {
      binding.setBindingId("wb_" + tokenGenerator.newNonce());
    }
    binding.setUser(user);
    binding.setBindingFingerprintHash(browserBindingKey);
    binding.setStatus(ACTIVE_STATUS);
    binding.setRevokedAt(null);
    binding.setRevokedReason("");
    binding.setApprovedUnbindReviewId("");
    binding.setLastSeenAt(now());
    return browserBindingRepository.save(binding);
  }

  private WebPasskeyCredentialEntity upsertCredential(
      WebBrowserBindingEntity binding,
      WebPasskeyRegisterCompleteRequest request
  ) {
    WebPasskeyCredentialEntity credential = credentialRepository.findByBinding_IdAndActiveTrue(binding.getId())
        .orElseGet(WebPasskeyCredentialEntity::new);
    credential.setUser(binding.getUser());
    credential.setBinding(binding);
    credential.setCredentialId(normalize(request.attestationResponse().id()));
    credential.setRawCredentialId(normalize(request.attestationResponse().rawId()));
    credential.setClientDataJson(request.attestationResponse().response().clientDataJson());
    credential.setAttestationObject(request.attestationResponse().response().attestationObject());
    credential.setActive(true);
    credential.setRevokedAt(null);
    return credentialRepository.save(credential);
  }

  private WebAuthSessionResponse issueSession(WxUserAuthExtEntity user, String message) {
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

    return new WebAuthSessionResponse(
        "success",
        message,
        sessionToken,
        session.getExpiresAt().toEpochMilli(),
        user.getRoleCode(),
        permissions,
        Boolean.TRUE.equals(user.getRegistered()),
        buildProfile(user)
    );
  }

  private Map<String, Object> buildRegisterOptions(WxUserAuthExtEntity user, String challenge) {
    Map<String, Object> rp = new LinkedHashMap<>();
    rp.put("name", normalize(appProperties.getWebAuth().getRpName()));
    if (!normalize(appProperties.getWebAuth().getRpId()).isEmpty()) {
      rp.put("id", normalize(appProperties.getWebAuth().getRpId()));
    }

    Map<String, Object> publicKeyOptions = new LinkedHashMap<>();
    publicKeyOptions.put("challenge", challenge);
    publicKeyOptions.put("rp", rp);
    publicKeyOptions.put("user", Map.of(
        "id", buildUserHandle(user),
        "name", normalize(user.getStudentId()),
        "displayName", normalize(user.getName())
    ));
    publicKeyOptions.put("pubKeyCredParams", List.of(
        Map.of("alg", -7, "type", "public-key"),
        Map.of("alg", -257, "type", "public-key")
    ));
    publicKeyOptions.put("timeout", appProperties.getWebAuth().getChallengeTtlSeconds() * 1000L);
    publicKeyOptions.put("attestation", "none");
    publicKeyOptions.put("authenticatorSelection", Map.of(
        "residentKey", "preferred",
        "userVerification", "preferred"
    ));
    return publicKeyOptions;
  }

  private Map<String, Object> buildLoginOptions(String challenge, WebPasskeyCredentialEntity credential) {
    Map<String, Object> publicKeyOptions = new LinkedHashMap<>();
    publicKeyOptions.put("challenge", challenge);
    publicKeyOptions.put("timeout", appProperties.getWebAuth().getChallengeTtlSeconds() * 1000L);
    publicKeyOptions.put("userVerification", "preferred");
    if (!normalize(appProperties.getWebAuth().getRpId()).isEmpty()) {
      publicKeyOptions.put("rpId", normalize(appProperties.getWebAuth().getRpId()));
    }
    publicKeyOptions.put("allowCredentials", List.of(Map.of(
        "id", normalize(credential.getRawCredentialId()),
        "type", "public-key"
    )));
    return publicKeyOptions;
  }

  private void validateClientDataJson(String encodedClientDataJson, String expectedChallenge, String expectedType) {
    Map<String, Object> clientData = decodeClientDataJson(encodedClientDataJson);
    String challenge = normalize(asString(clientData.get("challenge")));
    String type = normalize(asString(clientData.get("type")));
    if (!normalize(expectedChallenge).equals(challenge)) {
      throw new BusinessException("forbidden", "认证 challenge 已失效，请重新发起", "challenge_expired");
    }
    if (!normalize(expectedType).equals(type)) {
      throw new BusinessException("forbidden", "Passkey 校验失败，请重试", "passkey_verification_failed");
    }

    String expectedOrigin = normalize(appProperties.getWebAuth().getAllowedOrigin());
    if (!expectedOrigin.isEmpty()) {
      String actualOrigin = normalize(asString(clientData.get("origin")));
      if (!expectedOrigin.equals(actualOrigin)) {
        throw new BusinessException("forbidden", "当前访问来源不受信任", "passkey_verification_failed");
      }
    }
  }

  private Map<String, Object> decodeClientDataJson(String encodedClientDataJson) {
    try {
      byte[] bytes = Base64.getUrlDecoder().decode(padBase64(normalize(encodedClientDataJson)));
      String json = new String(bytes, StandardCharsets.UTF_8);
      return objectMapper.readValue(json, new TypeReference<>() {
      });
    } catch (Exception ex) {
      throw new BusinessException("forbidden", "Passkey 校验失败，请重试", "passkey_verification_failed");
    }
  }

  private Optional<WebBrowserBindingEntity> findActiveBindingByBrowser(String browserBindingKey) {
    return browserBindingRepository.findByBindingFingerprintHashAndStatus(browserBindingKey, ACTIVE_STATUS);
  }

  private Optional<WebBrowserBindingEntity> findActiveBindingByUser(Long userId) {
    return browserBindingRepository.findByUser_IdAndStatus(userId, ACTIVE_STATUS);
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

  private String requireBrowserBindingKey(String browserBindingKey) {
    String normalized = normalize(browserBindingKey);
    if (normalized.isEmpty()) {
      throw new BusinessException("invalid_param", "浏览器标识缺失，请刷新页面后重试");
    }
    return normalized;
  }

  private String buildUserHandle(WxUserAuthExtEntity user) {
    return Base64.getUrlEncoder().withoutPadding()
        .encodeToString(("user:" + user.getId()).getBytes(StandardCharsets.UTF_8));
  }

  private String asString(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String padBase64(String value) {
    int mod = value.length() % 4;
    if (mod == 0) {
      return value;
    }
    return value + "=".repeat(4 - mod);
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

  private record RoleDecision(
      RoleType role,
      List<String> permissions
  ) {
  }
}
