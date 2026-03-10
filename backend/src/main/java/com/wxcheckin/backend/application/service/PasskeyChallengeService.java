package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.support.TokenGenerator;
import com.wxcheckin.backend.config.AppProperties;
import com.wxcheckin.backend.infrastructure.persistence.entity.WebPasskeyChallengeEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WebPasskeyChallengeRepository;
import java.time.Clock;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 统一管理 bind ticket 与 Passkey challenge。
 *
 * 这里的职责边界故意收得很窄：
 * - 只负责创建、读取、过期校验、消费标记
 * - 不负责实名、角色或会话逻辑
 *
 * 这样可以避免认证状态机散落在 controller / service 多处，
 * 后续要收紧 challenge 规则时只需要在这一层改。
 */
@Service
public class PasskeyChallengeService {

  private static final String FLOW_BIND = "bind";
  private static final String FLOW_LOGIN = "login";
  private static final String FLOW_REGISTER = "register";

  private final WebPasskeyChallengeRepository challengeRepository;
  private final TokenGenerator tokenGenerator;
  private final AppProperties appProperties;
  private final Clock clock;

  public PasskeyChallengeService(
      WebPasskeyChallengeRepository challengeRepository,
      TokenGenerator tokenGenerator,
      AppProperties appProperties,
      Clock clock
  ) {
    this.challengeRepository = challengeRepository;
    this.tokenGenerator = tokenGenerator;
    this.appProperties = appProperties;
    this.clock = clock;
  }

  @Transactional
  public BindTicket createBindTicket(WxUserAuthExtEntity user, String browserBindingKey) {
    cleanupExpired();

    WebPasskeyChallengeEntity entity = new WebPasskeyChallengeEntity();
    entity.setBindTicket("bind_" + tokenGenerator.newNonce());
    entity.setFlowType(FLOW_BIND);
    entity.setUser(user);
    entity.setBrowserBindingKey(browserBindingKey);
    entity.setExpiresAt(now().plusSeconds(appProperties.getWebAuth().getBindTicketTtlSeconds()));
    challengeRepository.save(entity);

    return new BindTicket(entity.getBindTicket(), entity.getExpiresAt().toEpochMilli(), entity.getUser());
  }

  @Transactional
  public RegisterChallenge createRegisterChallenge(
      WxUserAuthExtEntity user,
      String browserBindingKey,
      String bindTicket
  ) {
    cleanupExpired();

    WebPasskeyChallengeEntity entity = new WebPasskeyChallengeEntity();
    entity.setRequestId("req_" + tokenGenerator.newNonce());
    entity.setBindTicket(bindTicket);
    entity.setFlowType(FLOW_REGISTER);
    entity.setUser(user);
    entity.setBrowserBindingKey(browserBindingKey);
    entity.setChallenge(tokenGenerator.newNonce());
    entity.setExpiresAt(now().plusSeconds(appProperties.getWebAuth().getChallengeTtlSeconds()));
    challengeRepository.save(entity);

    return new RegisterChallenge(
        entity.getRequestId(),
        entity.getChallenge(),
        entity.getExpiresAt().toEpochMilli(),
        entity.getUser()
    );
  }

  @Transactional
  public LoginChallenge createLoginChallenge(
      WxUserAuthExtEntity user,
      String browserBindingKey,
      String credentialId
  ) {
    cleanupExpired();

    WebPasskeyChallengeEntity entity = new WebPasskeyChallengeEntity();
    entity.setRequestId("req_" + tokenGenerator.newNonce());
    entity.setFlowType(FLOW_LOGIN);
    entity.setUser(user);
    entity.setBrowserBindingKey(browserBindingKey);
    entity.setCredentialId(credentialId);
    entity.setChallenge(tokenGenerator.newNonce());
    entity.setExpiresAt(now().plusSeconds(appProperties.getWebAuth().getChallengeTtlSeconds()));
    challengeRepository.save(entity);

    return new LoginChallenge(
        entity.getRequestId(),
        entity.getChallenge(),
        entity.getExpiresAt().toEpochMilli(),
        entity.getCredentialId(),
        entity.getUser()
    );
  }

  @Transactional(readOnly = true)
  public WebPasskeyChallengeEntity requireBindTicket(String bindTicket, String browserBindingKey) {
    WebPasskeyChallengeEntity entity = challengeRepository
        .findFirstByBindTicketAndFlowTypeOrderByCreatedAtDesc(normalize(bindTicket), FLOW_BIND)
        .orElseThrow(() -> new BusinessException("forbidden", "绑定凭据已失效，请重新验证身份", "challenge_expired"));
    validateChallenge(entity, FLOW_BIND, browserBindingKey);
    return entity;
  }

  @Transactional(readOnly = true)
  public WebPasskeyChallengeEntity requireRegisterChallenge(String requestId, String browserBindingKey) {
    WebPasskeyChallengeEntity entity = challengeRepository.findByRequestId(normalize(requestId))
        .orElseThrow(() -> new BusinessException("forbidden", "注册凭据已失效，请重新发起", "challenge_expired"));
    validateChallenge(entity, FLOW_REGISTER, browserBindingKey);
    return entity;
  }

  @Transactional(readOnly = true)
  public WebPasskeyChallengeEntity requireLoginChallenge(String requestId, String browserBindingKey) {
    WebPasskeyChallengeEntity entity = challengeRepository.findByRequestId(normalize(requestId))
        .orElseThrow(() -> new BusinessException("forbidden", "登录凭据已失效，请重新发起", "challenge_expired"));
    validateChallenge(entity, FLOW_LOGIN, browserBindingKey);
    return entity;
  }

  @Transactional
  public void markUsed(WebPasskeyChallengeEntity entity) {
    entity.setUsedAt(now());
    challengeRepository.save(entity);
  }

  @Transactional
  public void cleanupExpired() {
    challengeRepository.deleteByExpiresAtBefore(now());
  }

  private void validateChallenge(WebPasskeyChallengeEntity entity, String expectedFlow, String browserBindingKey) {
    if (!expectedFlow.equalsIgnoreCase(normalize(entity.getFlowType()))) {
      throw new BusinessException("forbidden", "认证上下文不匹配，请重新发起", "challenge_expired");
    }
    if (!normalize(browserBindingKey).equals(normalize(entity.getBrowserBindingKey()))) {
      throw new BusinessException("forbidden", "当前浏览器认证上下文不匹配", "challenge_expired");
    }
    if (entity.getUsedAt() != null || entity.getExpiresAt().isBefore(now())) {
      throw new BusinessException("forbidden", "认证凭据已过期，请重新发起", "challenge_expired");
    }
  }

  private Instant now() {
    return Instant.now(clock);
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  public record BindTicket(
      String bindTicket,
      long expiresAt,
      WxUserAuthExtEntity user
  ) {
  }

  public record RegisterChallenge(
      String requestId,
      String challenge,
      long expiresAt,
      WxUserAuthExtEntity user
  ) {
  }

  public record LoginChallenge(
      String requestId,
      String challenge,
      long expiresAt,
      String credentialId,
      WxUserAuthExtEntity user
  ) {
  }
}
