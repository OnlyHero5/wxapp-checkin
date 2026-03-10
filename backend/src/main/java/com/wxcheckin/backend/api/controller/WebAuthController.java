package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.WebAuthSessionResponse;
import com.wxcheckin.backend.api.dto.WebBindVerifyRequest;
import com.wxcheckin.backend.api.dto.WebBindVerifyResponse;
import com.wxcheckin.backend.api.dto.WebPasskeyLoginCompleteRequest;
import com.wxcheckin.backend.api.dto.WebPasskeyLoginOptionsResponse;
import com.wxcheckin.backend.api.dto.WebPasskeyRegisterCompleteRequest;
import com.wxcheckin.backend.api.dto.WebPasskeyRegisterOptionsRequest;
import com.wxcheckin.backend.api.dto.WebPasskeyRegisterOptionsResponse;
import com.wxcheckin.backend.application.service.WebIdentityService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Web-only 认证入口。
 *
 * 这层只做 HTTP 协议编排：
 * - 读取请求体
 * - 读取浏览器绑定键 header
 * - 交给 `WebIdentityService`
 *
 * 认证状态机和业务约束都集中放在 service，
 * 避免 controller 成为下一轮维护时最难读的分支堆。
 */
@RestController
@RequestMapping("/api/web")
public class WebAuthController {

  private static final String BROWSER_BINDING_KEY_HEADER = "X-Browser-Binding-Key";

  private final WebIdentityService webIdentityService;

  public WebAuthController(WebIdentityService webIdentityService) {
    this.webIdentityService = webIdentityService;
  }

  @PostMapping("/bind/verify-identity")
  public WebBindVerifyResponse verifyIdentity(
      @Valid @RequestBody WebBindVerifyRequest requestBody,
      HttpServletRequest request
  ) {
    return webIdentityService.verifyIdentity(
        request.getHeader(BROWSER_BINDING_KEY_HEADER),
        requestBody.studentId(),
        requestBody.name()
    );
  }

  @PostMapping("/passkey/register/options")
  public WebPasskeyRegisterOptionsResponse registerOptions(
      @Valid @RequestBody WebPasskeyRegisterOptionsRequest requestBody,
      HttpServletRequest request
  ) {
    return webIdentityService.getRegisterOptions(
        request.getHeader(BROWSER_BINDING_KEY_HEADER),
        requestBody.bindTicket()
    );
  }

  @PostMapping("/passkey/register/complete")
  public WebAuthSessionResponse registerComplete(
      @Valid @RequestBody WebPasskeyRegisterCompleteRequest requestBody,
      HttpServletRequest request
  ) {
    return webIdentityService.completeRegistration(request.getHeader(BROWSER_BINDING_KEY_HEADER), requestBody);
  }

  @PostMapping("/passkey/login/options")
  public WebPasskeyLoginOptionsResponse loginOptions(HttpServletRequest request) {
    return webIdentityService.getLoginOptions(request.getHeader(BROWSER_BINDING_KEY_HEADER));
  }

  @PostMapping("/passkey/login/complete")
  public WebAuthSessionResponse loginComplete(
      @Valid @RequestBody WebPasskeyLoginCompleteRequest requestBody,
      HttpServletRequest request
  ) {
    return webIdentityService.completeLogin(request.getHeader(BROWSER_BINDING_KEY_HEADER), requestBody);
  }
}
