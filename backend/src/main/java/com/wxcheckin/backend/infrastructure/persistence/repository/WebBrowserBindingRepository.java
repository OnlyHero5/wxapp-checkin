package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WebBrowserBindingEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebBrowserBindingRepository extends JpaRepository<WebBrowserBindingEntity, Long> {
  Optional<WebBrowserBindingEntity> findByBindingFingerprintHashAndStatus(String bindingFingerprintHash, String status);

  Optional<WebBrowserBindingEntity> findTopByBindingFingerprintHashOrderByUpdatedAtDesc(String bindingFingerprintHash);

  Optional<WebBrowserBindingEntity> findByUser_IdAndStatus(Long userId, String status);
}
