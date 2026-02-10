package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxReplayGuardEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WxReplayGuardRepository extends JpaRepository<WxReplayGuardEntity, Long> {
  boolean existsByUserIdAndActivityIdAndActionTypeAndSlot(Long userId, String activityId, String actionType, Long slot);
}
