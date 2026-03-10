package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.ConsumeCheckinRequest;
import com.wxcheckin.backend.api.dto.ConsumeCheckinResponse;
import com.wxcheckin.backend.api.dto.WebCodeConsumeRequest;
import com.wxcheckin.backend.api.dto.WebCodeConsumeResponse;
import com.wxcheckin.backend.api.dto.WebCodeSessionResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.CheckinConsumeService;
import com.wxcheckin.backend.application.service.DynamicCodeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/web/activities")
public class WebAttendanceController {

  private final DynamicCodeService dynamicCodeService;
  private final CheckinConsumeService checkinConsumeService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public WebAttendanceController(
      DynamicCodeService dynamicCodeService,
      CheckinConsumeService checkinConsumeService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.dynamicCodeService = dynamicCodeService;
    this.checkinConsumeService = checkinConsumeService;
    this.sessionTokenExtractor = sessionTokenExtractor;
  }

  @GetMapping("/{activityId}/code-session")
  public WebCodeSessionResponse codeSession(
      @PathVariable("activityId") String activityId,
      @RequestParam("action_type") String actionType,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(null, request);
    return dynamicCodeService.issue(token, activityId, actionType);
  }

  @PostMapping("/{activityId}/code-consume")
  public WebCodeConsumeResponse consume(
      @PathVariable("activityId") String activityId,
      @Valid @RequestBody WebCodeConsumeRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    ConsumeCheckinResponse response = checkinConsumeService.consume(
        new ConsumeCheckinRequest(
            token,
            null,
            null,
            null,
            null,
            activityId,
            requestBody.actionType(),
            null,
            null,
            requestBody.code()
        )
    );
    return new WebCodeConsumeResponse(
        response.status(),
        response.message(),
        response.actionType(),
        response.activityId(),
        response.activityTitle(),
        response.checkinRecordId(),
        response.serverTime()
    );
  }
}
