package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxActivityProjectionEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WxActivityProjectionRepository extends JpaRepository<WxActivityProjectionEntity, String> {
  List<WxActivityProjectionEntity> findByActiveTrueOrderByStartTimeDesc();

  Optional<WxActivityProjectionEntity> findByActivityIdAndActiveTrue(String activityId);

  Optional<WxActivityProjectionEntity> findByLegacyActivityId(Integer legacyActivityId);
}
