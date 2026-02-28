package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxReplayGuardEntity;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface WxReplayGuardRepository extends JpaRepository<WxReplayGuardEntity, Long> {
  boolean existsByUserIdAndActivityIdAndActionTypeAndSlot(Long userId, String activityId, String actionType, Long slot);

  @Transactional
  @Modifying
  @Query("delete from WxReplayGuardEntity g where g.expiresAt < ?1")
  int deleteByExpiresAtBefore(Instant expiresAt);
}
