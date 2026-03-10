package com.wxcheckin.backend.infrastructure.persistence.repository;

import com.wxcheckin.backend.infrastructure.persistence.entity.WebUnbindReviewEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebUnbindReviewRepository extends JpaRepository<WebUnbindReviewEntity, String> {
  List<WebUnbindReviewEntity> findByStatusOrderBySubmittedAtDesc(String status);
}
