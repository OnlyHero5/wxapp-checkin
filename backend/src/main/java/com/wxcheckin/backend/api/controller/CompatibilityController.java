package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.ActivitySummaryDto;
import com.wxcheckin.backend.api.dto.CreateQrSessionResponse;
import com.wxcheckin.backend.api.dto.CurrentActivityResponse;
import com.wxcheckin.backend.api.dto.RecordDetailResponse;
import com.wxcheckin.backend.api.dto.RecordListResponse;
import com.wxcheckin.backend.api.dto.SimpleStatusResponse;
import com.wxcheckin.backend.api.dto.StaffActivityActionRequest;
import com.wxcheckin.backend.api.dto.VerifyCheckinRequest;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.QrSessionService;
import com.wxcheckin.backend.application.service.RecordQueryService;
import com.wxcheckin.backend.application.service.SessionService;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Compatibility endpoints still present in the frontend API wrapper.
 */
@RestController
@RequestMapping("/api")
public class CompatibilityController {

  private final SessionService sessionService;
  private final SessionTokenExtractor sessionTokenExtractor;
  private final RecordQueryService recordQueryService;
  private final WxActivityProjectionRepository activityRepository;
  private final QrSessionService qrSessionService;

  public CompatibilityController(
      SessionService sessionService,
      SessionTokenExtractor sessionTokenExtractor,
      RecordQueryService recordQueryService,
      WxActivityProjectionRepository activityRepository,
      QrSessionService qrSessionService
  ) {
    this.sessionService = sessionService;
    this.sessionTokenExtractor = sessionTokenExtractor;
    this.recordQueryService = recordQueryService;
    this.activityRepository = activityRepository;
    this.qrSessionService = qrSessionService;
  }

  @PostMapping("/checkin/verify")
  public SimpleStatusResponse verify(@Valid @RequestBody VerifyCheckinRequest request, HttpServletRequest httpRequest) {
    String token = sessionTokenExtractor.extract(request.sessionToken(), httpRequest);
    sessionService.requirePrincipal(token);
    return new SimpleStatusResponse("success", "校验通过");
  }

  @GetMapping("/checkin/records")
  public RecordListResponse listRecords(
      @RequestParam(name = "session_token", required = false) String sessionToken,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(sessionToken, request);
    return recordQueryService.listRecords(token);
  }

  @GetMapping("/checkin/records/{recordId}")
  public RecordDetailResponse recordDetail(@PathVariable("recordId") String recordId) {
    return recordQueryService.getRecordDetail(recordId);
  }

  @GetMapping("/activity/current")
  public CurrentActivityResponse currentActivity() {
    var first = activityRepository.findByActiveTrueOrderByStartTimeDesc().stream().findFirst().orElse(null);
    if (first == null) {
      return new CurrentActivityResponse("success", "暂无活动", null);
    }
    ActivitySummaryDto dto = new ActivitySummaryDto(
        first.getActivityId(),
        first.getActivityTitle(),
        first.getActivityType(),
        first.getStartTime().toString(),
        first.getLocation(),
        first.getDescription(),
        first.getProgressStatus(),
        first.getSupportCheckout(),
        first.getHasDetail(),
        first.getCheckinCount(),
        first.getCheckoutCount(),
        null,
        null,
        null
    );
    return new CurrentActivityResponse("success", "当前活动获取成功", dto);
  }

  @PostMapping("/staff/activity-action")
  public Map<String, Object> staffActivityAction(
      @Valid @RequestBody StaffActivityActionRequest requestBody,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(requestBody.sessionToken(), request);
    CreateQrSessionResponse response = qrSessionService.issue(
        token,
        requestBody.activityId(),
        requestBody.actionType(),
        null,
        null
    );
    return Map.of(
        "status", "success",
        "message", "操作成功",
        "activity_id", response.activityId(),
        "action_type", response.actionType(),
        "qr_token", response.qrPayload(),
        "display_expire_at", response.displayExpireAt(),
        "accept_expire_at", response.acceptExpireAt(),
        "server_time", response.serverTime()
    );
  }
}
