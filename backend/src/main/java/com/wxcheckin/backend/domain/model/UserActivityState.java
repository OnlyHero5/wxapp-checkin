package com.wxcheckin.backend.domain.model;

/**
 * User participation state machine.
 */
public enum UserActivityState {
  NONE("none"),
  CHECKED_IN("checked_in"),
  CHECKED_OUT("checked_out");

  private final String code;

  UserActivityState(String code) {
    this.code = code;
  }

  public String getCode() {
    return code;
  }

  public static UserActivityState fromCode(String code) {
    if (code == null) {
      return NONE;
    }
    for (UserActivityState value : values()) {
      if (value.code.equalsIgnoreCase(code.trim())) {
        return value;
      }
    }
    return NONE;
  }
}
