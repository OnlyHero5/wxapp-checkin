package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxQrIssueLogEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WxQrIssueLogRepository extends JpaRepository<WxQrIssueLogEntity, Long> {
  boolean existsByActivityIdAndActionTypeAndSlotAndNonce(String activityId, String actionType, Long slot, String nonce);

  Optional<WxQrIssueLogEntity> findTopByQrPayloadOrderByIdDesc(String qrPayload);
}
