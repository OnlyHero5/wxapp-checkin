package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.WebBulkCheckoutRequest;
import com.wxcheckin.backend.api.dto.WebBulkCheckoutResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.BulkCheckoutService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/web")
public class WebStaffController {

  private final BulkCheckoutService bulkCheckoutService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public WebStaffController(
      BulkCheckoutService bulkCheckoutService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.bulkCheckoutService = bulkCheckoutService;
    this.sessionTokenExtractor = sessionTokenExtractor;
  }

  @PostMapping("/staff/activities/{activityId}/bulk-checkout")
  public WebBulkCheckoutResponse bulkCheckout(
      @PathVariable("activityId") String activityId,
      @Valid @RequestBody WebBulkCheckoutRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    return bulkCheckoutService.bulkCheckout(
        token,
        activityId,
        requestBody.confirm(),
        requestBody.reason()
    );
  }
}
