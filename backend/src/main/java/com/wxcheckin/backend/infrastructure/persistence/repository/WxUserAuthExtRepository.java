package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxUserAuthExtEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WxUserAuthExtRepository extends JpaRepository<WxUserAuthExtEntity, Long> {
  Optional<WxUserAuthExtEntity> findByWxIdentity(String wxIdentity);

  Optional<WxUserAuthExtEntity> findByStudentId(String studentId);

  Optional<WxUserAuthExtEntity> findByLegacyUserId(Long legacyUserId);
}
