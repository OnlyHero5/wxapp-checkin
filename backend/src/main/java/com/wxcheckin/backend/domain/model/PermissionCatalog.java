package com.wxcheckin.backend.domain.model;

import java.util.List;

/**
 * Central permission dictionary to keep contract values stable.
 */
public final class PermissionCatalog {
  private PermissionCatalog() {
  }

  public static final List<String> STAFF_PERMISSIONS = List.of(
      "activity:checkin",
      "activity:checkout",
      "activity:detail",
      "activity:manage",
      "activity:bulk-checkout",
      "unbind:review"
  );

  public static final List<String> NORMAL_PERMISSIONS = List.of();
}
