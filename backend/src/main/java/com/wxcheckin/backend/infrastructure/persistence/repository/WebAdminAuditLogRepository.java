package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WebAdminAuditLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebAdminAuditLogRepository extends JpaRepository<WebAdminAuditLogEntity, Long> {
}

