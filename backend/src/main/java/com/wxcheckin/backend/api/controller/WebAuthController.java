package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.WebAuthChangePasswordRequest;
import com.wxcheckin.backend.api.dto.WebAuthChangePasswordResponse;
import com.wxcheckin.backend.api.dto.WebAuthLoginRequest;
import com.wxcheckin.backend.api.dto.WebAuthLoginResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.WebPasswordAuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Web-only 认证入口（账号密码版）。
 *
 * 这里刻意保持“只做 HTTP 编排、不落业务状态机”：
 * - 读取请求体
 * - 读取 session token（改密场景）
 * - 交给 service 执行核心认证与落库
 */
@RestController
@RequestMapping("/api/web/auth")
public class WebAuthController {

  private final WebPasswordAuthService webPasswordAuthService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public WebAuthController(
      WebPasswordAuthService webPasswordAuthService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.webPasswordAuthService = webPasswordAuthService;
    this.sessionTokenExtractor = sessionTokenExtractor;
  }

  @PostMapping("/login")
  public WebAuthLoginResponse login(
      @Valid @RequestBody WebAuthLoginRequest requestBody,
      HttpServletRequest request
  ) {
    return webPasswordAuthService.login(
        requestBody.studentId(),
        requestBody.password()
    );
  }

  @PostMapping("/change-password")
  public WebAuthChangePasswordResponse changePassword(
      @Valid @RequestBody WebAuthChangePasswordRequest requestBody,
      HttpServletRequest request
  ) {
    String sessionToken = sessionTokenExtractor.extract(null, request);
    return webPasswordAuthService.changePassword(
        sessionToken,
        requestBody.oldPassword(),
        requestBody.newPassword()
    );
  }
}
