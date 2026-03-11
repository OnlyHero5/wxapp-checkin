package com.wxcheckin.backend.application.service;

import com.wxcheckin.backend.api.error.BusinessException;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import com.wxcheckin.backend.infrastructure.persistence.repository.WxActivityProjectionRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 活动“可发码/可动作”的统一时间窗判断。
 *
 * 为什么需要抽出来：
 * - staff 发码（动态码）与详情页展示 `can_checkin/can_checkout` 必须使用同一套窗口规则；
 * - 历史 legacy 数据里可能存在“开始/结束时间占位或异常”的情况（例如 start_time == end_time），
 *   发码入口会兜底回查 legacy 表得到真实时间；
 * - 如果详情页不复用相同兜底逻辑，就会出现“前端显示可签到，但管理员无法发码”的契约不一致问题。
 *
 * 统一口径：
 * - 允许发码窗口：活动开始前 30 分钟 ~ 活动结束后 30 分钟（均包含边界）
 * - 如果投影表时间异常，且存在 legacy_activity_id，则尝试回查 legacy 表并回写投影表，避免反复回查。
 */
@Service
public class ActivityTimeWindowService {

  private final WxActivityProjectionRepository activityRepository;
  private final Clock clock;
  private final JdbcTemplate legacyJdbcTemplate;

  public ActivityTimeWindowService(
      WxActivityProjectionRepository activityRepository,
      Clock clock,
      @Qualifier("legacyJdbcTemplate") JdbcTemplate legacyJdbcTemplate
  ) {
    this.activityRepository = activityRepository;
    this.clock = clock;
    this.legacyJdbcTemplate = legacyJdbcTemplate;
  }

  /**
   * 评估活动是否处于“允许发码/允许动作”的时间窗口内。
   *
   * <p>注意：当发现投影表时间异常且能回查 legacy 时间时，会把修复结果回写投影表。</p>
   */
  @Transactional
  public IssueWindowEvaluation evaluateAndFix(WxActivityProjectionEntity activity) {
    if (activity == null) {
      return IssueWindowEvaluation.invalid("activity_time_invalid");
    }

    Instant startTime = activity.getStartTime();
    Instant endTime = activity.getEndTime();
    Integer legacyActivityId = activity.getLegacyActivityId();

    // legacy 同步的早期阶段可能存在占位时间：start==end，或 start/end 为空，或 end<start。
    // 这些情况下如果有 legacy_activity_id，就尝试回查 legacy 的真实时间并回写投影表。
    boolean looksPlaceholder = legacyActivityId != null && startTime != null && startTime.equals(endTime);
    boolean timeInvalid = startTime == null || endTime == null || endTime.isBefore(startTime);
    if (legacyActivityId != null && (looksPlaceholder || timeInvalid)) {
      LegacyTime legacyTime = queryLegacyTime(legacyActivityId);
      if (legacyTime != null) {
        startTime = legacyTime.startTime;
        endTime = legacyTime.endTime;
        activity.setStartTime(startTime);
        activity.setEndTime(endTime);
        activityRepository.save(activity);
      }
    }

    if (startTime == null || endTime == null || endTime.isBefore(startTime)) {
      return IssueWindowEvaluation.invalid("activity_time_invalid");
    }

    Instant now = Instant.now(clock);
    Instant allowedFrom = startTime.minus(Duration.ofMinutes(30));
    Instant allowedUntil = endTime.plus(Duration.ofMinutes(30));
    boolean withinWindow = !now.isBefore(allowedFrom) && !now.isAfter(allowedUntil);
    return new IssueWindowEvaluation(withinWindow, withinWindow ? "" : "outside_activity_time_window");
  }

  public boolean isWithinIssueWindow(WxActivityProjectionEntity activity) {
    return evaluateAndFix(activity).withinWindow();
  }

  public void ensureWithinIssueWindow(WxActivityProjectionEntity activity) {
    IssueWindowEvaluation evaluation = evaluateAndFix(activity);
    if ("activity_time_invalid".equals(evaluation.errorCode())) {
      throw new BusinessException("failed", "活动时间信息异常，无法生成二维码", "activity_time_invalid");
    }
    if (!evaluation.withinWindow()) {
      throw new BusinessException(
          "forbidden",
          "仅可在活动开始前30分钟到结束后30分钟内生成二维码",
          "outside_activity_time_window"
      );
    }
  }

  private LegacyTime queryLegacyTime(Integer legacyActivityId) {
    try {
      List<LegacyTime> result = legacyJdbcTemplate.query(
          "SELECT activity_stime, activity_etime FROM suda_activity WHERE id = ? LIMIT 1",
          (rs, rowNum) -> {
            Instant start = rs.getTimestamp("activity_stime").toInstant();
            Instant end = rs.getTimestamp("activity_etime").toInstant();
            return new LegacyTime(start, end);
          },
          legacyActivityId
      );
      return result.stream().findFirst().orElse(null);
    } catch (DataAccessException | NullPointerException ex) {
      return null;
    }
  }

  private record LegacyTime(Instant startTime, Instant endTime) {
  }

  public record IssueWindowEvaluation(
      boolean withinWindow,
      String errorCode
  ) {
    static IssueWindowEvaluation invalid(String errorCode) {
      return new IssueWindowEvaluation(false, errorCode == null ? "" : errorCode);
    }
  }
}

