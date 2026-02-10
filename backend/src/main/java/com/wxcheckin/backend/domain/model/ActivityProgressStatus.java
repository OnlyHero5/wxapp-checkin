package com.wxcheckin.backend.domain.model;

/**
 * Activity lifecycle status used by miniapp UI.
 */
public enum ActivityProgressStatus {
  ONGOING("ongoing"),
  COMPLETED("completed");

  private final String code;

  ActivityProgressStatus(String code) {
    this.code = code;
  }

  public String getCode() {
    return code;
  }

  public static ActivityProgressStatus fromCode(String code) {
    if (code == null) {
      return ONGOING;
    }
    for (ActivityProgressStatus value : values()) {
      if (value.code.equalsIgnoreCase(code.trim())) {
        return value;
      }
    }
    return ONGOING;
  }
}
