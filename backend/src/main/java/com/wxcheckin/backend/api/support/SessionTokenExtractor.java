package com.wxcheckin.backend.api.support;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * Normalizes session token acquisition across body/query/header channels.
 */
@Component
public class SessionTokenExtractor {

  public String extract(String bodyToken, HttpServletRequest request) {
    String token = normalize(bodyToken);
    if (!token.isEmpty()) {
      return token;
    }

    token = normalize(request.getParameter("session_token"));
    if (!token.isEmpty()) {
      return token;
    }

    token = normalize(request.getHeader("X-Session-Token"));
    if (!token.isEmpty()) {
      return token;
    }

    String auth = normalize(request.getHeader("Authorization"));
    if (auth.toLowerCase().startsWith("bearer ")) {
      return normalize(auth.substring(7));
    }
    return auth;
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim();
  }
}
