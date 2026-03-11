package com.wxcheckin.backend.api.controller;

import com.wxcheckin.backend.api.dto.WebActivityDetailResponse;
import com.wxcheckin.backend.api.dto.WebActivityListResponse;
import com.wxcheckin.backend.api.support.SessionTokenExtractor;
import com.wxcheckin.backend.application.service.ActivityQueryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/web/activities")
public class WebActivityController {

  private final ActivityQueryService activityQueryService;
  private final SessionTokenExtractor sessionTokenExtractor;

  public WebActivityController(
      ActivityQueryService activityQueryService,
      SessionTokenExtractor sessionTokenExtractor
  ) {
    this.activityQueryService = activityQueryService;
    this.sessionTokenExtractor = sessionTokenExtractor;
  }

  @GetMapping
  public WebActivityListResponse list(
      @RequestParam(name = "page", required = false) Integer page,
      @RequestParam(name = "page_size", required = false) Integer pageSize,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(null, request);
    return activityQueryService.listForWeb(token, page, pageSize);
  }

  @GetMapping("/{activityId}")
  public WebActivityDetailResponse detail(
      @PathVariable("activityId") String activityId,
      HttpServletRequest request
  ) {
    String token = sessionTokenExtractor.extract(null, request);
    return activityQueryService.detailForWeb(token, activityId);
  }
}
