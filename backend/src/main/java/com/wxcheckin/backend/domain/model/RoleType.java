package com.wxcheckin.backend.domain.model;

/**
 * Supported application roles.
 */
public enum RoleType {
  NORMAL("normal"),
  STAFF("staff");

  private final String code;

  RoleType(String code) {
    this.code = code;
  }

  public String getCode() {
    return code;
  }

  public static RoleType fromCode(String code) {
    if (code == null) {
      return NORMAL;
    }
    for (RoleType value : values()) {
      if (value.code.equalsIgnoreCase(code.trim())) {
        return value;
      }
    }
    return NORMAL;
  }
}
