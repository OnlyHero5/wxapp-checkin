package com.wxcheckin.backend.domain.model;

/**
 * 签到动作类型（Web 动态码与接口契约统一使用）。
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
