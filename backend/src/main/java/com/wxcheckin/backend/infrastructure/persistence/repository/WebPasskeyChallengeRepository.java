package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WebPasskeyChallengeEntity;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebPasskeyChallengeRepository extends JpaRepository<WebPasskeyChallengeEntity, Long> {
  Optional<WebPasskeyChallengeEntity> findFirstByBindTicketAndFlowTypeOrderByCreatedAtDesc(String bindTicket, String flowType);

  Optional<WebPasskeyChallengeEntity> findByRequestId(String requestId);

  long deleteByExpiresAtBefore(Instant now);
}
