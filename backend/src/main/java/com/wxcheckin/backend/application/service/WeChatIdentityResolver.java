package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Resolves miniapp login code into a stable internal wx identity.
 *
 * <p>When official WeChat API integration is disabled, the resolver falls back
 * to deterministic hashing of login code so the development environment still
 * works end-to-end.</p>
 */
@Component
public class WeChatIdentityResolver {

  private final AppProperties appProperties;
  private final RestClient restClient;

  public WeChatIdentityResolver(AppProperties appProperties, RestClient restClient) {
    this.appProperties = appProperties;
    this.restClient = restClient;
  }

  public String resolveIdentity(String wxLoginCode) {
    String code = normalize(wxLoginCode);
    if (code.isEmpty() || code.length() > 128 || code.contains(" ")) {
      throw new BusinessException("invalid_param", "登录参数不合法");
    }

    if (!appProperties.getWechat().isEnabled()) {
      return "wx_" + sha256(code).substring(0, 24);
    }

    try {
      String requestUrl = appProperties.getWechat().getJscode2sessionUrl()
          + "?appid={appid}&secret={secret}&js_code={code}&grant_type=authorization_code";

      @SuppressWarnings("unchecked")
      Map<String, Object> payload = restClient.get()
          .uri(requestUrl, appProperties.getWechat().getAppid(), appProperties.getWechat().getSecret(), code)
          .retrieve()
          .body(Map.class);

      if (payload == null) {
        throw new BusinessException("failed", "微信登录校验失败");
      }
      Object errCode = payload.get("errcode");
      if (errCode instanceof Number number && number.intValue() != 0) {
        throw new BusinessException("failed", "微信登录校验失败");
      }
      String openid = normalize((String) payload.get("openid"));
      String unionid = normalize((String) payload.get("unionid"));
      if (openid.isEmpty()) {
        throw new BusinessException("failed", "微信登录校验失败");
      }
      String source = unionid.isEmpty() ? openid : (openid + ":" + unionid);
      return "wx_" + sha256(source).substring(0, 24);
    } catch (BusinessException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new BusinessException("failed", "微信登录校验失败");
    }
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }

  private String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder();
      for (byte current : bytes) {
        sb.append(String.format("%02x", current));
      }
      return sb.toString();
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 unavailable", ex);
    }
  }
}
