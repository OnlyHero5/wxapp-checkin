package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxSyncOutboxEntity;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WxSyncOutboxRepository extends JpaRepository<WxSyncOutboxEntity, Long> {
  List<WxSyncOutboxEntity> findTop100ByStatusAndAvailableAtLessThanEqualOrderByIdAsc(String status, Instant now);
}
