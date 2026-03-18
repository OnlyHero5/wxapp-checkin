package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.WebActivityRosterResponse;
import com.wxcheckin.backend.api.dto.WebAttendanceAdjustmentRequest;
import com.wxcheckin.backend.api.dto.WebAttendanceAdjustmentResponse;
import com.wxcheckin.backend.api.dto.WebBulkCheckoutRequest;
import com.wxcheckin.backend.api.dto.WebBulkCheckoutResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.BulkCheckoutService;
import com.wxcheckin.backend.application.service.StaffAttendanceAdminService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/web")
public class WebStaffController {

  private final BulkCheckoutService bulkCheckoutService;
  private final StaffAttendanceAdminService staffAttendanceAdminService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public WebStaffController(
      BulkCheckoutService bulkCheckoutService,
      StaffAttendanceAdminService staffAttendanceAdminService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.bulkCheckoutService = bulkCheckoutService;
    this.staffAttendanceAdminService = staffAttendanceAdminService;
    this.sessionTokenExtractor = sessionTokenExtractor;
  }

  @GetMapping("/staff/activities/{activityId}/roster")
  public WebActivityRosterResponse roster(
      @PathVariable("activityId") String activityId,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(null, request);
    return staffAttendanceAdminService.getActivityRoster(token, activityId);
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

  @PostMapping("/staff/activities/{activityId}/attendance-adjustments")
  public WebAttendanceAdjustmentResponse attendanceAdjustments(
      @PathVariable("activityId") String activityId,
      @Valid @RequestBody WebAttendanceAdjustmentRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    return staffAttendanceAdminService.adjustAttendanceStates(
        token,
        activityId,
        requestBody.userIds(),
        requestBody.patch() == null ? null : requestBody.patch().checkedIn(),
        requestBody.patch() == null ? null : requestBody.patch().checkedOut(),
        requestBody.reason()
    );
  }
}
