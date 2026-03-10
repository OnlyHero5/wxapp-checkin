package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.WebBulkCheckoutRequest;
import com.wxcheckin.backend.api.dto.WebBulkCheckoutResponse;
import com.wxcheckin.backend.api.dto.WebUnbindReviewActionRequest;
import com.wxcheckin.backend.api.dto.WebUnbindReviewActionResponse;
import com.wxcheckin.backend.api.dto.WebUnbindReviewCreateRequest;
import com.wxcheckin.backend.api.dto.WebUnbindReviewCreateResponse;
import com.wxcheckin.backend.api.dto.WebUnbindReviewListResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.BulkCheckoutService;
import com.wxcheckin.backend.application.service.UnbindReviewService;
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
@RequestMapping("/api/web")
public class WebStaffController {

  private static final String BROWSER_BINDING_KEY_HEADER = "X-Browser-Binding-Key";

  private final BulkCheckoutService bulkCheckoutService;
  private final UnbindReviewService unbindReviewService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public WebStaffController(
      BulkCheckoutService bulkCheckoutService,
      UnbindReviewService unbindReviewService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.bulkCheckoutService = bulkCheckoutService;
    this.unbindReviewService = unbindReviewService;
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
        request.getHeader(BROWSER_BINDING_KEY_HEADER),
        activityId,
        requestBody.confirm(),
        requestBody.reason()
    );
  }

  @PostMapping("/unbind-reviews")
  public WebUnbindReviewCreateResponse createReview(
      @Valid @RequestBody WebUnbindReviewCreateRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    return unbindReviewService.create(
        token,
        request.getHeader(BROWSER_BINDING_KEY_HEADER),
        requestBody.reason(),
        requestBody.requestedNewBindingHint()
    );
  }

  @GetMapping("/staff/unbind-reviews")
  public WebUnbindReviewListResponse listReviews(
      @RequestParam(name = "status", required = false) String status,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(null, request);
    return unbindReviewService.list(token, request.getHeader(BROWSER_BINDING_KEY_HEADER), status);
  }

  @PostMapping("/staff/unbind-reviews/{reviewId}/approve")
  public WebUnbindReviewActionResponse approve(
      @PathVariable("reviewId") String reviewId,
      @RequestBody WebUnbindReviewActionRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    return unbindReviewService.approve(
        token,
        request.getHeader(BROWSER_BINDING_KEY_HEADER),
        reviewId,
        requestBody.reviewComment()
    );
  }

  @PostMapping("/staff/unbind-reviews/{reviewId}/reject")
  public WebUnbindReviewActionResponse reject(
      @PathVariable("reviewId") String reviewId,
      @RequestBody WebUnbindReviewActionRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    return unbindReviewService.reject(
        token,
        request.getHeader(BROWSER_BINDING_KEY_HEADER),
        reviewId,
        requestBody.reviewComment()
    );
  }
}
