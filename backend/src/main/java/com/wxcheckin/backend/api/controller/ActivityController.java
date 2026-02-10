package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.ActivityDetailResponse;
import com.wxcheckin.backend.api.dto.ActivityListResponse;
import com.wxcheckin.backend.api.dto.CreateQrSessionRequest;
import com.wxcheckin.backend.api.dto.CreateQrSessionResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.ActivityQueryService;
import com.wxcheckin.backend.application.service.QrSessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Activity list/detail and staff QR issuance APIs.
 */
@RestController
@RequestMapping("/api/staff/activities")
public class ActivityController {

  private final ActivityQueryService activityQueryService;
  private final QrSessionService qrSessionService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public ActivityController(
      ActivityQueryService activityQueryService,
      QrSessionService qrSessionService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.activityQueryService = activityQueryService;
    this.qrSessionService = qrSessionService;
    this.sessionTokenExtractor = sessionTokenExtractor;
  }

  @GetMapping
  public ActivityListResponse list(
      @RequestParam(name = "session_token", required = false) String sessionToken,
      @RequestParam(name = "role_hint", required = false) String roleHint,
      @RequestParam(name = "visibility_scope", required = false) String visibilityScope,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(sessionToken, request);
    return activityQueryService.listActivities(token);
  }

  @GetMapping("/{activityId}")
  public ActivityDetailResponse detail(
      @PathVariable("activityId") String activityId,
      @RequestParam(name = "session_token", required = false) String sessionToken,
      @RequestParam(name = "role_hint", required = false) String roleHint,
      @RequestParam(name = "visibility_scope", required = false) String visibilityScope,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(sessionToken, request);
    return activityQueryService.detail(token, activityId);
  }

  @PostMapping("/{activityId}/qr-session")
  public CreateQrSessionResponse createQrSession(
      @PathVariable("activityId") String activityId,
      @Valid @RequestBody CreateQrSessionRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    return qrSessionService.issue(
        token,
        activityId,
        requestBody.actionType(),
        requestBody.rotateSeconds(),
        requestBody.graceSeconds()
    );
  }
}
