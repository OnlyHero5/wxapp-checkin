package com.wxcheckin.backend.application.model;

import com.wxcheckin.backend.domain.model.RoleType;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import java.util.List;

/**
 * Authenticated context derived from a valid session token.
 */
public record SessionPrincipal(
    WxSessionEntity session,
    WxUserAuthExtEntity user,
    RoleType role,
    List<String> permissions
) {
}
