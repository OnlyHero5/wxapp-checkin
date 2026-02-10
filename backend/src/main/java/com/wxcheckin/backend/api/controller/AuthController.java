package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.RegisterRequest;
import com.wxcheckin.backend.api.dto.RegisterResponse;
import com.wxcheckin.backend.api.dto.WxLoginRequest;
import com.wxcheckin.backend.api.dto.WxLoginResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.AuthService;
import com.wxcheckin.backend.application.service.RegistrationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Auth and registration APIs.
 */
@RestController
@RequestMapping("/api")
public class AuthController {

  private final AuthService authService;
  private final RegistrationService registrationService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public AuthController(
      AuthService authService,
      RegistrationService registrationService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.authService = authService;
    this.registrationService = registrationService;
    this.sessionTokenExtractor = sessionTokenExtractor;
  }

  @PostMapping("/auth/wx-login")
  public WxLoginResponse wxLogin(@Valid @RequestBody WxLoginRequest request) {
    return authService.login(request.wxLoginCode());
  }

  @PostMapping("/register")
  public RegisterResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
    String token = sessionTokenExtractor.extract(request.sessionToken(), httpRequest);
    RegisterRequest normalized = new RegisterRequest(
        token,
        request.studentId(),
        request.name(),
        request.department(),
        request.club(),
        request.payloadEncrypted()
    );
    return registrationService.register(normalized);
  }
}
