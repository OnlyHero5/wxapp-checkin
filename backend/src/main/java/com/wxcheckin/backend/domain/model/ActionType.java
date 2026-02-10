package com.wxcheckin.backend.domain.model;

/**
 * Check-in action type from QR payload and API contracts.
 */
public enum ActionType {
  CHECKIN("checkin"),
  CHECKOUT("checkout");

  private final String code;

  ActionType(String code) {
    this.code = code;
  }

  public String getCode() {
    return code;
  }

  public static ActionType fromCode(String code) {
    if (code == null) {
      return null;
    }
    for (ActionType value : values()) {
      if (value.code.equalsIgnoreCase(code.trim())) {
        return value;
      }
    }
    return null;
  }
}
