package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WxQrIssueLogEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface WxQrIssueLogRepository extends JpaRepository<WxQrIssueLogEntity, Long> {
  boolean existsByActivityIdAndActionTypeAndSlotAndNonce(String activityId, String actionType, Long slot, String nonce);

  Optional<WxQrIssueLogEntity> findTopByQrPayloadOrderByIdDesc(String qrPayload);

  @Transactional
  @Modifying
  @Query("delete from WxQrIssueLogEntity l where l.acceptExpireAt < ?1")
  int deleteByAcceptExpireAtLessThan(Long acceptExpireAt);
}
