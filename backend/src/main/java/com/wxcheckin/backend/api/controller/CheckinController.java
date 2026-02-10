package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.ConsumeCheckinRequest;
import com.wxcheckin.backend.api.dto.ConsumeCheckinResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.CheckinConsumeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Check-in consume APIs.
 */
@RestController
@RequestMapping("/api/checkin")
public class CheckinController {

  private final CheckinConsumeService checkinConsumeService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public CheckinController(
      CheckinConsumeService checkinConsumeService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.checkinConsumeService = checkinConsumeService;
    this.sessionTokenExtractor = sessionTokenExtractor;
  }

  @PostMapping("/consume")
  public ConsumeCheckinResponse consume(
      @Valid @RequestBody ConsumeCheckinRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    ConsumeCheckinRequest normalized = new ConsumeCheckinRequest(
        token,
        requestBody.qrPayload(),
        requestBody.scanType(),
        requestBody.rawResult(),
        requestBody.path(),
        requestBody.activityId(),
        requestBody.actionType(),
        requestBody.slot(),
        requestBody.nonce()
    );
    return checkinConsumeService.consume(normalized);
  }
}
