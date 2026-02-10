package com.wxcheckin.backend.application.support;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Component;

/**
 * Consistent timestamp formatter for UI-facing date strings.
 */
@Component
public class TimeFormatter {
  private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
  private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

  public String toDisplay(Instant instant) {
    if (instant == null) {
      return "";
    }
    return DATE_TIME.format(instant.atZone(ZONE));
  }
}
