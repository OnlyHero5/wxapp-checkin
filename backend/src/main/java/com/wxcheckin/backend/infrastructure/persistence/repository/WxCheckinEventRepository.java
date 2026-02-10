package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxCheckinEventEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WxCheckinEventRepository extends JpaRepository<WxCheckinEventEntity, String> {
  List<WxCheckinEventEntity> findTop100ByUserIdOrderBySubmittedAtDesc(Long userId);
}
