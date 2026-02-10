package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxAdminRosterEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WxAdminRosterRepository extends JpaRepository<WxAdminRosterEntity, Long> {
  boolean existsByStudentIdAndNameAndActiveTrue(String studentId, String name);
}
