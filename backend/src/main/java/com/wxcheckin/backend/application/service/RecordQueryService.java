package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.dto.RecordDetailResponse;
import com.wxcheckin.backend.api.dto.RecordItemDto;
import com.wxcheckin.backend.api.dto.RecordListResponse;
import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.application.model.SessionPrincipal;
import com.wxcheckin.backend.application.support.TimeFormatter;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxCheckinEventEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxCheckinEventRepository;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Compatibility read APIs for record list/detail wrappers.
 */
@Service
public class RecordQueryService {

  private final SessionService sessionService;
  private final WxCheckinEventRepository checkinEventRepository;
  private final WxActivityProjectionRepository activityRepository;
  private final TimeFormatter timeFormatter;

  public RecordQueryService(
      SessionService sessionService,
      WxCheckinEventRepository checkinEventRepository,
      WxActivityProjectionRepository activityRepository,
      TimeFormatter timeFormatter
  ) {
    this.sessionService = sessionService;
    this.checkinEventRepository = checkinEventRepository;
    this.activityRepository = activityRepository;
    this.timeFormatter = timeFormatter;
  }

  @Transactional(readOnly = true)
  public RecordListResponse listRecords(String sessionToken) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken);
    List<WxCheckinEventEntity> events = checkinEventRepository
        .findTop100ByUserIdOrderBySubmittedAtDesc(principal.user().getId());

    Map<String, WxActivityProjectionEntity> activityMap = activityRepository.findAll().stream()
        .collect(Collectors.toMap(WxActivityProjectionEntity::getActivityId, Function.identity(), (a, b) -> b));

    List<RecordItemDto> records = events.stream()
        .map(event -> {
          WxActivityProjectionEntity activity = activityMap.get(event.getActivityId());
          String title = activity == null ? event.getActivityId() : activity.getActivityTitle();
          String location = activity == null ? "" : activity.getLocation();
          String description = "checkin".equals(event.getActionType()) ? "签到完成" : "签退完成";
          return new RecordItemDto(
              event.getRecordId(),
              timeFormatter.toDisplay(event.getSubmittedAt()),
              location,
              title,
              description
          );
        })
        .toList();

    return new RecordListResponse("success", "记录获取成功", records);
  }

  @Transactional(readOnly = true)
  public RecordDetailResponse getRecordDetail(String sessionToken, String recordId) {
    SessionPrincipal principal = sessionService.requirePrincipal(sessionToken);
    WxCheckinEventEntity event = checkinEventRepository.findById(recordId)
        .orElseThrow(() -> new BusinessException("invalid_param", "记录不存在"));
    if (event.getUser() == null || !event.getUser().getId().equals(principal.user().getId())) {
      throw new BusinessException("forbidden", "无权查看该记录");
    }
    WxActivityProjectionEntity activity = activityRepository.findById(event.getActivityId()).orElse(null);
    return new RecordDetailResponse(
        "success",
        "记录详情获取成功",
        event.getRecordId(),
        timeFormatter.toDisplay(event.getSubmittedAt()),
        activity == null ? "" : activity.getLocation(),
        activity == null ? event.getActivityId() : activity.getActivityTitle(),
        "checkin".equals(event.getActionType()) ? "签到完成" : "签退完成",
        event.getActionType()
    );
  }
}
