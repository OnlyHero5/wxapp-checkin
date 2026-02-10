package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxSessionEntity;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WxSessionRepository extends JpaRepository<WxSessionEntity, Long> {
  Optional<WxSessionEntity> findBySessionToken(String sessionToken);

  long deleteByExpiresAtBefore(Instant now);
}
