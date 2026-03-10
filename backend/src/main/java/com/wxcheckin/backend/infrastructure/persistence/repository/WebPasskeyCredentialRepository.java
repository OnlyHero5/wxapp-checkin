package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WebPasskeyCredentialEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebPasskeyCredentialRepository extends JpaRepository<WebPasskeyCredentialEntity, Long> {
  Optional<WebPasskeyCredentialEntity> findByCredentialIdAndActiveTrue(String credentialId);

  Optional<WebPasskeyCredentialEntity> findByBinding_IdAndActiveTrue(Long bindingId);
}
